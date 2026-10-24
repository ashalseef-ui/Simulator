import {
  Device,
  Link,
  SimulationStep,
  DeviceInterface,
} from '../types/network';
import { areSameSubnet, getNetworkAddress } from '../utils/ipUtils';
import { calculatePvst } from './stpEngine';
import { computeOspf } from './ospfEngine';
import { computeEigrpNetworkState } from './protocols/eigrpEngine';
import { resolveHsrpGateway } from './protocols/hsrpEngine';
import { computeMplsNetworkState } from './protocols/mplsEngine';
import { computeIsisNetworkState } from './protocols/isisEngine';
import { checkAcl, lookupRoute, type RouteMatch } from './simulation/routeLookup';
import { findL2L3ForwardPath } from './simulation/forwardPathFinder';
import { simulateDhcp } from './simulation/serviceSimulators';

// Re-export modular simulation helpers for backward compatibility across engine and tests
export { lookupRoute, checkAcl, type RouteMatch };
export { simulateDhcp };

export function simulatePing(
  srcDeviceId: string,
  dstIp: string,
  devices: Device[],
  links: Link[]
): { steps: SimulationStep[]; success: boolean; error?: string } {
  // Defensive input validation
  if (!srcDeviceId || typeof srcDeviceId !== 'string') {
    return { steps: [], success: false, error: 'Invalid source device ID.' };
  }
  if (!dstIp || typeof dstIp !== 'string') {
    return { steps: [], success: false, error: 'Invalid destination IP address.' };
  }
  if (!Array.isArray(devices) || !Array.isArray(links)) {
    return { steps: [], success: false, error: 'Topology devices and links must be arrays.' };
  }

  const srcDev = devices.find((d) => d && d.id === srcDeviceId);
  if (!srcDev || !srcDev.config || !srcDev.config.interfaces) {
    return { steps: [], success: false, error: 'Source device not found or unconfigured.' };
  }

  // Find source active IP & interface
  let srcIfaceName = '';
  let srcIface: DeviceInterface | undefined;

  for (const [name, iface] of Object.entries(srcDev.config.interfaces)) {
    if (iface && iface.ip && iface.status === 'up') {
      srcIface = iface;
      srcIfaceName = name;
      break;
    }
  }

  if (!srcIface) {
    const firstKey = Object.keys(srcDev.config.interfaces)[0];
    if (firstKey) {
      srcIface = srcDev.config.interfaces[firstKey];
      srcIfaceName = firstKey;
    }
  }

  if (!srcIface || !srcIface.ip || !srcIface.mask) {
    return {
      steps: [],
      success: false,
      error: `Device ${srcDev.name || 'Source'} has no valid IPv4 address configured on its interfaces.`,
    };
  }

  // Find destination device & interface
  let dstDev: Device | undefined;

  for (const d of devices) {
    if (!d || !d.config || !d.config.interfaces) continue;
    for (const [, iface] of Object.entries(d.config.interfaces)) {
      if (iface && iface.ip === dstIp && iface.status === 'up') {
        dstDev = d;
        break;
      }
    }
    if (dstDev) break;
  }

  // HSRP Virtual IP check for destination
  if (!dstDev) {
    const hsrpDest = resolveHsrpGateway(dstIp, devices);
    if (hsrpDest) {
      dstDev = hsrpDest.activeDevice;
    }
  }

  const steps: SimulationStep[] = [];
  const srcIp = srcIface.ip;
  const srcMask = srcIface.mask;
  const srcMac = srcIface.mac;
  const isLocalSubnet = areSameSubnet(srcIp, dstIp, srcMask);

  // STP & Dynamic Routing Protocol State Calculations (OSPF, IS-IS, EIGRP, MPLS)
  const stpTopology = calculatePvst(devices, links);
  const ospfState = computeOspf(devices, links, stpTopology);
  const isisState = computeIsisNetworkState(devices, links);
  const eigrpState = computeEigrpNetworkState(devices, links);
  const mplsState = computeMplsNetworkState(devices, links);

  // Check Layer 3 Gateway on Source Host if destination is non-local
  let nextHopIp = dstIp;
  if (!isLocalSubnet) {
    if (!srcDev.config.defaultGateway) {
      steps.push({
        id: `step_err_${Date.now()}_0`,
        stepIndex: 1,
        totalSteps: 1,
        type: 'ICMP',
        stage: 'Host Subnet Check Failed',
        fromDeviceId: srcDev.id,
        toDeviceId: srcDev.id,
        fromPort: srcIfaceName,
        toPort: srcIfaceName,
        status: 'drop',
        message: `Destination IP ${dstIp} is outside local subnet (${getNetworkAddress(srcIp, srcMask)}/${srcMask}) and no Default Gateway is configured on ${srcDev.name}.`,
        l2Frame: { preamble: '10101011', srcMac, dstMac: '00:00:00:00:00:00', type: '0x0800 (IPv4)' },
        l3Packet: { version: 4, ihl: 5, tos: 0, totalLength: 84, ttl: 128, protocol: 'ICMP', srcIp, dstIp },
        l4Payload: { protocol: 'ICMP', summary: 'Echo Request - Dropped (No Default Gateway)', details: { reason: 'No default gateway configured' } },
      });
      return { steps, success: false, error: `No Default Gateway configured on ${srcDev.name} for non-local destination ${dstIp}.` };
    }

    // Check HSRP Virtual Gateway resolution
    const hsrpGw = resolveHsrpGateway(srcDev.config.defaultGateway, devices);
    const resolvedGwIp = hsrpGw
      ? (hsrpGw.activeDevice.config.interfaces[hsrpGw.interfaceName]?.ip || srcDev.config.defaultGateway)
      : srcDev.config.defaultGateway;

    if (!areSameSubnet(srcIp, srcDev.config.defaultGateway, srcMask)) {
      steps.push({
        id: `step_err_${Date.now()}_0`,
        stepIndex: 1,
        totalSteps: 1,
        type: 'ICMP',
        stage: 'Gateway Unreachable',
        fromDeviceId: srcDev.id,
        toDeviceId: srcDev.id,
        fromPort: srcIfaceName,
        toPort: srcIfaceName,
        status: 'drop',
        message: `Default Gateway ${srcDev.config.defaultGateway} is on a different subnet than ${srcDev.name} (${srcIp}/${srcMask}).`,
        l2Frame: { preamble: '10101011', srcMac, dstMac: '00:00:00:00:00:00', type: '0x0800 (IPv4)' },
        l3Packet: { version: 4, ihl: 5, tos: 0, totalLength: 84, ttl: 128, protocol: 'ICMP', srcIp, dstIp },
        l4Payload: { protocol: 'ICMP', summary: 'Echo Request - Dropped (Gateway Subnet Mismatch)', details: { gateway: srcDev.config.defaultGateway } },
      });
      return { steps, success: false, error: `Configured Default Gateway ${srcDev.config.defaultGateway} is not in the same subnet.` };
    }

    nextHopIp = resolvedGwIp;
  }

  // Find physical forwarding path with VLAN & Multi-Protocol L2/L3 awareness
  const forwardPath = findL2L3ForwardPath(
    srcDev,
    srcIfaceName,
    dstDev,
    dstIp,
    nextHopIp,
    devices,
    links,
    stpTopology,
    ospfState,
    isisState,
    eigrpState,
    mplsState
  );

  if (!forwardPath.success || forwardPath.hops.length === 0) {
    // Generate drop step with explicit diagnostic reason
    steps.push({
      id: `step_err_${Date.now()}_0`,
      stepIndex: 1,
      totalSteps: 1,
      type: 'ICMP',
      stage: 'Destination Host Unreachable',
      fromDeviceId: srcDev.id,
      toDeviceId: srcDev.id,
      fromPort: srcIfaceName,
      toPort: srcIfaceName,
      status: 'drop',
      message: forwardPath.errorMessage || `Destination IP ${dstIp} is unreachable from ${srcDev.name}.`,
      l2Frame: { preamble: '10101011', srcMac, dstMac: '00:00:00:00:00:00', type: '0x0800 (IPv4)' },
      l3Packet: { version: 4, ihl: 5, tos: 0, totalLength: 84, ttl: 128, protocol: 'ICMP', srcIp, dstIp },
      l4Payload: {
        protocol: 'ICMP',
        summary: 'Echo Request - Destination Unreachable',
        details: { reason: forwardPath.errorMessage || 'No forwarding path exists' },
      },
    });
    return { steps, success: false, error: forwardPath.errorMessage || 'Destination host unreachable.' };
  }

  let stepCounter = 1;
  const totalHopsCount = forwardPath.hops.length * 2 + 2;

  // Step 1: Initial ARP Resolution (Broadcast & Unicast Reply)
  const firstHop = forwardPath.hops[0];
  steps.push({
    id: `arp_req_${Date.now()}_${stepCounter}`,
    stepIndex: stepCounter++,
    totalSteps: totalHopsCount,
    type: 'ARP',
    stage: 'ARP Request (Broadcast)',
    fromDeviceId: srcDev.id,
    toDeviceId: firstHop.toDev.id,
    fromPort: firstHop.fromPort,
    toPort: firstHop.toPort,
    linkId: firstHop.linkId,
    status: 'broadcast',
    message: `ARP Broadcast: Who has ${nextHopIp}? Tell ${srcIp}`,
    l2Frame: {
      preamble: '10101011',
      srcMac,
      dstMac: 'FF:FF:FF:FF:FF:FF',
      type: '0x0806 (ARP)',
      vlan: firstHop.vlanTag,
    },
    l3Packet: {
      version: 4,
      ihl: 5,
      tos: 0,
      totalLength: 28,
      ttl: 1,
      protocol: 'ARP',
      srcIp,
      dstIp: nextHopIp,
    },
    l4Payload: {
      protocol: 'ARP',
      summary: `ARP Request for IP ${nextHopIp}`,
      details: { senderIp: srcIp, targetIp: nextHopIp, senderMac: srcMac },
    },
  });

  // Step 2: Forward Path ICMP Echo Request
  let currentSrcIp = srcIp;
  let currentDstIp = dstIp;
  let ttl = 128;

  for (let i = 0; i < forwardPath.hops.length; i++) {
    const hop = forwardPath.hops[i];
    const isLastHop = i === forwardPath.hops.length - 1;

    // Check Port Security if entering a switch port
    const ingressIface = hop.toDev.config.interfaces[hop.toPort];
    if (ingressIface?.portSecurity?.enabled) {
      const ps = ingressIface.portSecurity;
      const srcMac = hop.srcMac;
      const knownMacs = ps.stickyMacs || [];

      // If interface is already err-disabled
      if (ps.state === 'err-disabled' || ingressIface.status === 'down') {
        steps.push({
          id: `step_psec_drop_${Date.now()}_${stepCounter}`,
          stepIndex: stepCounter++,
          totalSteps: totalHopsCount,
          type: 'ICMP',
          stage: 'Port-Security Err-Disable Drop',
          fromDeviceId: hop.fromDev.id,
          toDeviceId: hop.toDev.id,
          fromPort: hop.fromPort,
          toPort: hop.toPort,
          linkId: hop.linkId,
          status: 'drop',
          message: `Frame dropped on ${hop.toDev.name} ${hop.toPort}: Interface is in err-disabled state due to port-security violation.`,
          l2Frame: { preamble: '10101011', srcMac: hop.srcMac, dstMac: hop.dstMac, type: '0x0800', vlan: hop.vlanTag },
          l3Packet: { version: 4, ihl: 5, tos: 0, totalLength: 84, ttl, protocol: 'ICMP', srcIp: currentSrcIp, dstIp: currentDstIp },
          l4Payload: { protocol: 'ICMP', summary: 'Dropped: Port is in err-disabled state', details: { port: hop.toPort, device: hop.toDev.name } },
        });
        return { steps, success: false, error: `Port ${hop.toPort} on ${hop.toDev.name} is err-disabled.` };
      }

      // Check if MAC is authorized or can be learned
      if (!knownMacs.includes(srcMac)) {
        if (knownMacs.length >= (ps.maxMacs || 1)) {
          // Security Violation Triggered!
          ps.violationCount = (ps.violationCount || 0) + 1;
          const violationMode = ps.violation || 'shutdown';

          if (violationMode === 'shutdown') {
            ps.state = 'err-disabled';
            ingressIface.status = 'down';
            steps.push({
              id: `step_psec_violation_${Date.now()}_${stepCounter}`,
              stepIndex: stepCounter++,
              totalSteps: totalHopsCount,
              type: 'ICMP',
              stage: 'Port-Security Violation (Shutdown)',
              fromDeviceId: hop.fromDev.id,
              toDeviceId: hop.toDev.id,
              fromPort: hop.fromPort,
              toPort: hop.toPort,
              linkId: hop.linkId,
              status: 'drop',
              message: `%PM-4-ERR_DISABLE: psecure-violation error detected on ${hop.toPort}, putting ${hop.toPort} in err-disable state (Source MAC: ${srcMac})`,
              l2Frame: { preamble: '10101011', srcMac: hop.srcMac, dstMac: hop.dstMac, type: '0x0800', vlan: hop.vlanTag },
              l3Packet: { version: 4, ihl: 5, tos: 0, totalLength: 84, ttl, protocol: 'ICMP', srcIp: currentSrcIp, dstIp: currentDstIp },
              l4Payload: { protocol: 'ICMP', summary: 'Port Security Violation - Port Shutdown', details: { srcMac, maxAllowed: ps.maxMacs || 1 } },
            });
            return { steps, success: false, error: `Port-security violation: ${hop.toPort} placed into err-disable state.` };
          } else {
            // restrict or protect
            steps.push({
              id: `step_psec_drop_${Date.now()}_${stepCounter}`,
              stepIndex: stepCounter++,
              totalSteps: totalHopsCount,
              type: 'ICMP',
              stage: `Port-Security Violation (${violationMode})`,
              fromDeviceId: hop.fromDev.id,
              toDeviceId: hop.toDev.id,
              fromPort: hop.fromPort,
              toPort: hop.toPort,
              linkId: hop.linkId,
              status: 'drop',
              message: `Frame dropped on ${hop.toDev.name} ${hop.toPort}: Port-security violation count incremented to ${ps.violationCount} (mode: ${violationMode}).`,
              l2Frame: { preamble: '10101011', srcMac: hop.srcMac, dstMac: hop.dstMac, type: '0x0800', vlan: hop.vlanTag },
              l3Packet: { version: 4, ihl: 5, tos: 0, totalLength: 84, ttl, protocol: 'ICMP', srcIp: currentSrcIp, dstIp: currentDstIp },
              l4Payload: { protocol: 'ICMP', summary: `Port Security Violation - ${violationMode}`, details: { srcMac, violationCount: ps.violationCount } },
            });
            return { steps, success: false, error: `Port-security ${violationMode} dropped unauthorized MAC ${srcMac}.` };
          }
        } else {
          // Dynamically learn sticky MAC if capacity allows
          if (!ps.stickyMacs) ps.stickyMacs = [];
          ps.stickyMacs.push(srcMac);
        }
      }
    }

    // Check Inbound ACL if entering a routed device
    if (hop.toDev.type === 'router' || hop.toDev.type === 'firewall' || hop.toDev.type === 'l3switch') {
      const inIface = hop.toDev.config.interfaces[hop.toPort];
      if (inIface && inIface.accessGroupIn && hop.toDev.config.accessLists) {
        const acl = hop.toDev.config.accessLists[inIface.accessGroupIn];
        const aclResult = checkAcl(acl, currentSrcIp, currentDstIp, 'icmp');
        if (!aclResult.permitted) {
          steps.push({
            id: `step_acl_${Date.now()}_${stepCounter}`,
            stepIndex: stepCounter++,
            totalSteps: totalHopsCount,
            type: 'ICMP',
            stage: 'ACL Inbound Filter Drop',
            fromDeviceId: hop.fromDev.id,
            toDeviceId: hop.toDev.id,
            fromPort: hop.fromPort,
            toPort: hop.toPort,
            linkId: hop.linkId,
            status: 'drop',
            message: `Packet dropped on ${hop.toDev.name} ${hop.toPort} by Inbound Access-List ${inIface.accessGroupIn}: (${aclResult.matchedRule})`,
            l2Frame: {
              preamble: '10101011',
              srcMac: hop.srcMac,
              dstMac: hop.dstMac,
              type: '0x0800 (IPv4)',
              vlan: hop.vlanTag,
            },
            l3Packet: {
              version: 4,
              ihl: 5,
              tos: 0,
              totalLength: 84,
              ttl,
              protocol: 'ICMP',
              srcIp: currentSrcIp,
              dstIp: currentDstIp,
            },
            l4Payload: {
              protocol: 'ICMP',
              summary: 'Echo Request - Dropped by ACL',
              details: { rule: aclResult.matchedRule, acl: inIface.accessGroupIn },
            },
          });
          return { steps, success: false, error: `Packet filtered by ACL on ${hop.toDev.name}.` };
        }
      }
    }

    // Decrement TTL at router hops
    if (hop.fromDev.type === 'router' || hop.fromDev.type === 'firewall' || hop.fromDev.type === 'l3switch') {
      ttl -= 1;
      if (ttl <= 0) {
        return {
          steps,
          success: false,
          error: `TTL expired in transit at ${hop.fromDev.name}.`,
        };
      }
    }

    let stepType: SimulationStep['type'] = 'ICMP';
    let stage = `ICMP Echo Request (${hop.fromDev.name} -> ${hop.toDev.name})`;
    let msg = hop.vlanTag
      ? `Forwarding 802.1Q tagged (VLAN ${hop.vlanTag}) frame to ${hop.toDev.name} [TTL=${ttl}]`
      : `Forwarding ICMP Echo Request to ${hop.toDev.name} [TTL=${ttl}]`;
    let l2Type = '0x0800 (IPv4)';
    let l3Proto = 'ICMP';
    let mplsLabels: number[] | undefined;
    let espSpi: string | undefined;
    let vxlanVni: number | undefined;

    if (hop.mplsAction) {
      stepType = 'MPLS';
      stage = hop.mplsAction === 'push'
        ? `MPLS Label Push (Out-Label: ${hop.mplsLabel})`
        : hop.mplsAction === 'swap'
        ? `MPLS Label Swap (${hop.mplsLabel})`
        : 'MPLS Penultimate Hop Popping (PHP)';
      msg = `MPLS WAN: ${hop.mplsAction.toUpperCase()} label ${hop.mplsLabel ?? ''} to next LSR ${hop.toDev.name}`;
      l2Type = '0x8847 (MPLS)';
      mplsLabels = hop.mplsLabel ? [hop.mplsLabel] : undefined;
    } else if (hop.isIpsecEncapsulated) {
      stepType = 'IPSEC';
      stage = `IPsec VPN Encapsulation (ESP)`;
      msg = `IPsec VPN: Encapsulating IP payload in ESP tunnel (SPI: ${hop.ipsecSpi || '0x3bf7a01c'}) towards ${hop.toDev.name}`;
      l3Proto = 'ESP';
      espSpi = hop.ipsecSpi || '0x3bf7a01c';
    } else if (hop.isVxlan) {
      stepType = 'VXLAN';
      stage = `VXLAN Overlay Encapsulation (VNI ${hop.vxlanVni})`;
      msg = `VXLAN Overlay: Encapsulated Layer 2 frame into VNI ${hop.vxlanVni} UDP 4789 towards VTEP ${hop.toDev.name}`;
      l3Proto = 'UDP';
      vxlanVni = hop.vxlanVni;
    }

    steps.push({
      id: `icmp_fwd_${Date.now()}_${stepCounter}`,
      stepIndex: stepCounter++,
      totalSteps: totalHopsCount,
      type: stepType,
      stage,
      fromDeviceId: hop.fromDev.id,
      toDeviceId: hop.toDev.id,
      fromPort: hop.fromPort,
      toPort: hop.toPort,
      linkId: hop.linkId,
      status: isLastHop ? 'forward' : 'forward',
      message: msg,
      l2Frame: {
        preamble: '10101011',
        srcMac: hop.srcMac,
        dstMac: hop.dstMac,
        type: l2Type,
        vlan: hop.vlanTag,
        mplsLabels,
      },
      l3Packet: {
        version: 4,
        ihl: 5,
        tos: 0,
        totalLength: 84,
        ttl,
        protocol: l3Proto,
        srcIp: currentSrcIp,
        dstIp: currentDstIp,
        espSpi,
        vxlanVni,
      },
      l4Payload: {
        protocol: l3Proto,
        summary: `Echo Request (Type 8, Code 0)${mplsLabels ? ` [MPLS: ${mplsLabels.join(', ')}]` : ''}`,
        details: { type: 8, code: 0, sequence: 1, identifier: 0x1a2b, vlan: hop.vlanTag, mplsLabels, espSpi, vxlanVni },
      },
    });
  }

  // Step 3: Return Path ICMP Echo Reply
  // Verify return path from dstDev back to srcIp (real IP stacks require a return route)
  if (!dstDev) {
    return { steps, success: false, error: `Destination IP ${dstIp} is unreachable.` };
  }
  const dstIfaceName = Object.entries(dstDev.config.interfaces).find(([, iface]) => iface && iface.ip === dstIp)?.[0]
    || Object.keys(dstDev.config.interfaces)[0];

  let returnNextHopIp = srcIp;
  const dstIface = dstDev.config.interfaces[dstIfaceName];
  if (!areSameSubnet(dstIp, srcIp, dstIface?.mask || '255.255.255.0')) {
    if (dstDev.type === 'pc' || dstDev.type === 'laptop' || dstDev.type === 'server') {
      if (!dstDev.config.defaultGateway) {
        return {
          steps,
          success: false,
          error: `Ping failed: no route back from ${dstDev.name} to ${srcIp} (no default gateway configured).`,
        };
      }
      returnNextHopIp = dstDev.config.defaultGateway;
    }
  }

  const returnPath = findL2L3ForwardPath(
    dstDev,
    dstIfaceName,
    srcDev,
    srcIp,
    returnNextHopIp,
    devices,
    links,
    stpTopology,
    ospfState,
    isisState,
    eigrpState,
    mplsState
  );

  if (!returnPath.success || returnPath.hops.length === 0) {
    return {
      steps,
      success: false,
      error: `Ping failed: echo request reached ${dstDev.name}, but there is no route back to ${srcIp} (${returnPath.errorMessage || 'no route back'}).`,
    };
  }

  const reverseHops = returnPath.hops;
  let replyTtl = 64;
  for (let i = 0; i < reverseHops.length; i++) {
    const hop = reverseHops[i];
    const isFinal = i === reverseHops.length - 1;

    if (hop.fromDev.type === 'router' || hop.fromDev.type === 'firewall' || hop.fromDev.type === 'l3switch') {
      replyTtl = Math.max(1, replyTtl - 1);
    }

    let repStepType: SimulationStep['type'] = 'ICMP';
    let repStage = `ICMP Echo Reply (${hop.fromDev.name} -> ${hop.toDev.name})`;
    let repMsg = isFinal
      ? `ICMP Echo Reply successfully received by ${srcDev.name}! Round-trip 0.84ms.`
      : `Forwarding ICMP Echo Reply towards ${hop.toDev.name}`;
    let repL2Type = '0x0800 (IPv4)';
    let repL3Proto = 'ICMP';
    let repMplsLabels: number[] | undefined;
    let repEspSpi: string | undefined;
    let repVxlanVni: number | undefined;

    if (hop.mplsAction) {
      repStepType = 'MPLS';
      repStage = 'MPLS Return Label Switching';
      repL2Type = '0x8847 (MPLS)';
      repMplsLabels = hop.mplsLabel ? [hop.mplsLabel] : undefined;
    } else if (hop.isIpsecEncapsulated) {
      repStepType = 'IPSEC';
      repStage = 'IPsec VPN Encapsulation (ESP)';
      repL3Proto = 'ESP';
      repEspSpi = hop.ipsecSpi || '0x3bf7a01c';
    } else if (hop.isVxlan) {
      repStepType = 'VXLAN';
      repStage = 'VXLAN Return Overlay';
      repL3Proto = 'UDP';
      repVxlanVni = hop.vxlanVni;
    }

    steps.push({
      id: `icmp_rep_${Date.now()}_${stepCounter}`,
      stepIndex: stepCounter++,
      totalSteps: totalHopsCount,
      type: repStepType,
      stage: repStage,
      fromDeviceId: hop.fromDev.id,
      toDeviceId: hop.toDev.id,
      fromPort: hop.fromPort,
      toPort: hop.toPort,
      linkId: hop.linkId,
      status: isFinal ? 'success' : 'reply',
      message: repMsg,
      l2Frame: {
        preamble: '10101011',
        srcMac: hop.srcMac,
        dstMac: hop.dstMac,
        type: repL2Type,
        vlan: hop.vlanTag,
        mplsLabels: repMplsLabels,
      },
      l3Packet: {
        version: 4,
        ihl: 5,
        tos: 0,
        totalLength: 84,
        ttl: replyTtl,
        protocol: repL3Proto,
        srcIp: dstIp,
        dstIp: srcIp,
        espSpi: repEspSpi,
        vxlanVni: repVxlanVni,
      },
      l4Payload: {
        protocol: repL3Proto,
        summary: 'Echo Reply (Type 0, Code 0)',
        details: { type: 0, code: 0, sequence: 1, identifier: 0x1a2b, rtt: '0.84 ms', mplsLabels: repMplsLabels, espSpi: repEspSpi, vxlanVni: repVxlanVni },
      },
    });
  }

  // Update total steps counter
  steps.forEach((s) => (s.totalSteps = steps.length));
  return { steps, success: true };
}
