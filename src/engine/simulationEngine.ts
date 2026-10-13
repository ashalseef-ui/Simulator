import {
  Device,
  Link,
  SimulationStep,
  DeviceInterface,
  AccessList,
} from '../types/network';
import { areSameSubnet, getNetworkAddress, ipToInt, maskToCidr } from '../utils/ipUtils';
import { calculateStp, calculatePvst, getStpPortState } from './stpEngine';
import { computeOspf, isOspfCapable, OspfRoute, OspfState, OSPF_AD } from './ospfEngine';

interface RouteMatch {
  type: 'connected' | 'static' | 'ospf' | 'eigrp' | 'rip' | 'bgp' | 'default';
  outInterface: string;
  subInterface?: string;
  nextHopIp: string;
  /** Administrative distance. */
  metric: number;
  /** Prefix length; routers pick the longest prefix first, AD only breaks ties. */
  prefixLen: number;
  /** Protocol cost, used as the final tie-breaker. */
  cost?: number;
}

const wildcardToPrefixLen = (wildcard: string): number => {
  const mask = (~ipToInt(wildcard)) >>> 0;
  let n = 0;
  for (let i = 31; i >= 0 && (mask >>> i) & 1; i--) n++;
  return n;
};
const safeCidr = (mask: string): number => (mask === '0' || mask === '0.0.0.0' ? 0 : maskToCidr(mask));

// Helper to evaluate ACL against an ICMP/IP packet
function checkAcl(
  acl: AccessList | undefined,
  srcIp: string,
  dstIp: string,
  protocol: 'icmp' | 'ip' | 'tcp' | 'udp' = 'icmp'
): { permitted: boolean; matchedRule?: string } {
  if (!acl || !acl.rules || acl.rules.length === 0) {
    return { permitted: true };
  }

  for (const rule of acl.rules) {
    // Protocol match
    if (rule.protocol && rule.protocol !== 'ip' && rule.protocol !== protocol) {
      continue;
    }

    // Source IP match
    let srcMatch = false;
    if (rule.source === 'any') {
      srcMatch = true;
    } else if (rule.source.startsWith('host ')) {
      srcMatch = rule.source.replace('host ', '').trim() === srcIp;
    } else {
      const parts = rule.source.trim().split(/\s+/);
      if (parts.length === 2) {
        const [net, wildcard] = parts;
        const maskInt = (~ipToInt(wildcard)) >>> 0;
        const netInt = ipToInt(net);
        const hostInt = ipToInt(srcIp);
        srcMatch = (hostInt & maskInt) === (netInt & maskInt);
      } else if (rule.source === srcIp) {
        srcMatch = true;
      }
    }

    // Destination IP match (for extended ACLs)
    let dstMatch = true;
    if (rule.destination) {
      if (rule.destination === 'any') {
        dstMatch = true;
      } else if (rule.destination.startsWith('host ')) {
        dstMatch = rule.destination.replace('host ', '').trim() === dstIp;
      } else {
        const parts = rule.destination.trim().split(/\s+/);
        if (parts.length === 2) {
          const [net, wildcard] = parts;
          const maskInt = (~ipToInt(wildcard)) >>> 0;
          const netInt = ipToInt(net);
          const hostInt = ipToInt(dstIp);
          dstMatch = (hostInt & maskInt) === (netInt & maskInt);
        } else if (rule.destination === dstIp) {
          dstMatch = true;
        }
      }
    }

    if (srcMatch && dstMatch) {
      rule.matchCount = (rule.matchCount || 0) + 1;
      return {
        permitted: rule.action === 'permit',
        matchedRule: `${rule.action.toUpperCase()} ${rule.protocol || 'ip'} ${rule.source} ${rule.destination || ''}`.trim(),
      };
    }
  }

  // Implicit deny at the end of ACL
  return { permitted: false, matchedRule: 'Implicit Deny All' };
}

// Helper to look up best route on router or L3 switch.
// Order of selection follows real routers: longest prefix match, then lowest AD, then lowest cost.
export function lookupRoute(
  dev: Device,
  dstIp: string,
  ospfRoutes: OspfRoute[] = []
): RouteMatch | null {
  const candidates: RouteMatch[] = [];

  // 1. Directly connected interfaces and sub-interfaces
  for (const [ifName, iface] of Object.entries(dev.config.interfaces)) {
    if (iface.ip && iface.mask && iface.status === 'up') {
      if (areSameSubnet(iface.ip, dstIp, iface.mask)) {
        candidates.push({
          type: 'connected',
          outInterface: ifName.split('.')[0],
          subInterface: ifName.includes('.') ? ifName : undefined,
          nextHopIp: dstIp,
          metric: 0,
          prefixLen: safeCidr(iface.mask),
        });
      }
    }
  }

  // 2. Static routes
  for (const r of dev.config.routes || []) {
    if (safeCidr(r.mask) === 0 || areSameSubnet(r.network, dstIp, r.mask)) {
      candidates.push({
        type: safeCidr(r.mask) === 0 ? 'default' : 'static',
        outInterface: r.interface || '',
        nextHopIp: r.nextHop,
        metric: r.distance ?? 1,
        prefixLen: safeCidr(r.mask),
      });
    }
  }

  // 3. OSPF routes: produced by the OSPF engine from real adjacencies + SPF
  for (const r of ospfRoutes) {
    if (areSameSubnet(r.network, dstIp, r.mask)) {
      candidates.push({
        type: 'ospf',
        outInterface: r.outInterface,
        nextHopIp: r.nextHopIp,
        metric: OSPF_AD,
        prefixLen: safeCidr(r.mask),
        cost: r.cost,
      });
    }
  }

  // 4-6. EIGRP / RIP / BGP are still simplified: a matching network statement is treated as reachable.
  // (See PROJECT.md "Known limitations".)
  for (const net of dev.config.eigrp?.networks || []) {
    const care = (~ipToInt(net.wildcard)) >>> 0;
    if (((ipToInt(dstIp) & care) >>> 0) === ((ipToInt(net.network) & care) >>> 0)) {
      candidates.push({ type: 'eigrp', outInterface: '', nextHopIp: dstIp, metric: 90, prefixLen: wildcardToPrefixLen(net.wildcard) });
    }
  }
  for (const net of dev.config.rip?.networks || []) {
    if (areSameSubnet(net, dstIp, '255.255.255.0')) {
      candidates.push({ type: 'rip', outInterface: '', nextHopIp: dstIp, metric: 120, prefixLen: 24 });
    }
  }
  for (const net of dev.config.bgp?.networks || []) {
    if (areSameSubnet(net.network, dstIp, net.mask)) {
      const neighbor = dev.config.bgp!.neighbors[0];
      const isInternal = neighbor?.remoteAs === dev.config.bgp!.asn;
      candidates.push({
        type: 'bgp',
        outInterface: '',
        nextHopIp: neighbor?.ip || dstIp,
        metric: isInternal ? 200 : 20,
        prefixLen: safeCidr(net.mask),
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.prefixLen - a.prefixLen || a.metric - b.metric || (a.cost ?? 0) - (b.cost ?? 0));
  const best = candidates[0];

  // Recursive lookup: resolve the egress interface from the next hop when only the next hop is known
  if (!best.outInterface && best.nextHopIp) {
    for (const [ifName, iface] of Object.entries(dev.config.interfaces)) {
      if (iface.ip && iface.mask && iface.status === 'up' && areSameSubnet(iface.ip, best.nextHopIp, iface.mask)) {
        best.outInterface = ifName.split('.')[0];
        if (ifName.includes('.')) best.subInterface = ifName;
        break;
      }
    }
  }

  return best;
}

const isRoutedForwarder = (d: Device): boolean =>
  d.type.startsWith('router') || d.type === 'firewall' || d.type === 'firepower' || (d.type === 'l3switch' && !!d.config.ipRoutingEnabled) || isOspfCapable(d) && d.type !== 'switch';

const isVirtualIface = (n: string) => /^vlan\d+$/i.test(n) || /^loopback/i.test(n);

export function simulatePing(
  srcDeviceId: string,
  dstIp: string,
  devices: Device[],
  links: Link[]
): { steps: SimulationStep[]; success: boolean; error?: string } {
  const srcDev = devices.find((d) => d.id === srcDeviceId);
  if (!srcDev) return { steps: [], success: false, error: 'Source device not found.' };

  // Find source active IP & interface
  let srcIfaceName = '';
  let srcIface: DeviceInterface | undefined;

  for (const [name, iface] of Object.entries(srcDev.config.interfaces)) {
    if (iface.ip && iface.status === 'up') {
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
      error: `Device ${srcDev.name} has no valid IPv4 address configured on its interfaces.`,
    };
  }

  // Find destination device & interface
  let dstDev: Device | undefined;

  for (const d of devices) {
    for (const [, iface] of Object.entries(d.config.interfaces)) {
      if (iface.ip === dstIp && iface.status === 'up') {
        dstDev = d;
        break;
      }
    }
    if (dstDev) break;
  }

  const steps: SimulationStep[] = [];
  const srcIp = srcIface.ip;
  const srcMask = srcIface.mask;
  const srcMac = srcIface.mac;
  const isLocalSubnet = areSameSubnet(srcIp, dstIp, srcMask);

  // STP state calculation for active topology (Per-VLAN PVST+)
  const stpTopology = calculatePvst(devices, links);
  const ospfState = computeOspf(devices, links, stpTopology);

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

    nextHopIp = srcDev.config.defaultGateway;
  }

  // Find physical forwarding path with VLAN & L2/L3 awareness
  const forwardPath = findL2L3ForwardPath(
    srcDev,
    srcIfaceName,
    dstDev,
    dstIp,
    nextHopIp,
    devices,
    links,
    stpTopology,
    ospfState
  );

  if (!forwardPath.success || forwardPath.hops.length === 0) {
    // Generate drop step with explicit diagnostic reason
    steps.push({
      id: `step_err_${Date.now()}_0`,
      stepIndex: 1,
      totalSteps: 1,
      type: 'ICMP',
      stage: 'Packet Forwarding Failed',
      fromDeviceId: srcDev.id,
      toDeviceId: forwardPath.dropDevice ? forwardPath.dropDevice.id : srcDev.id,
      fromPort: srcIfaceName,
      toPort: 'drop',
      status: 'drop',
      message: forwardPath.errorMessage || `Packet dropped: Destination ${dstIp} is unreachable.`,
      l2Frame: { preamble: '10101011', srcMac, dstMac: 'FF:FF:FF:FF:FF:FF', type: '0x0800 (IPv4)' },
      l3Packet: { version: 4, ihl: 5, tos: 0, totalLength: 84, ttl: 128, protocol: 'ICMP', srcIp, dstIp },
      l4Payload: { protocol: 'ICMP', summary: `Echo Request - Drop: ${forwardPath.errorMessage}`, details: { reason: forwardPath.errorMessage } },
    });
    return { steps, success: false, error: forwardPath.errorMessage };
  }

  // The echo reply must find its way back: every router on the path (and the destination, if routed)
  // needs a route to the source address.
  const replyRouters = new Map<string, Device>();
  forwardPath.hops.forEach((h) => {
    [h.fromDev, h.toDev].forEach((d) => {
      if (d.id !== srcDev.id && isRoutedForwarder(d)) replyRouters.set(d.id, d);
    });
  });
  for (const r of replyRouters.values()) {
    if (!lookupRoute(r, srcIp, ospfState.routes[r.id] || [])) {
      const msg = `Echo Reply cannot return: ${r.name} has no route back to ${srcIp}.`;
      steps.push({
        id: `step_err_${Date.now()}_ret`,
        stepIndex: 1,
        totalSteps: 1,
        type: 'ICMP',
        stage: 'Return Path Failure',
        fromDeviceId: r.id,
        toDeviceId: r.id,
        fromPort: '',
        toPort: '',
        status: 'drop',
        message: msg,
        l2Frame: { preamble: '10101011', srcMac, dstMac: 'FF:FF:FF:FF:FF:FF', type: '0x0800 (IPv4)' },
        l3Packet: { version: 4, ihl: 5, tos: 0, totalLength: 84, ttl: 64, protocol: 'ICMP', srcIp: dstIp, dstIp: srcIp },
        l4Payload: { protocol: 'ICMP', summary: 'Echo Reply - Dropped (no return route)', details: { router: r.name } },
      });
      return { steps, success: false, error: msg };
    }
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
      ttl = Math.max(1, ttl - 1);
    }

    steps.push({
      id: `icmp_fwd_${Date.now()}_${stepCounter}`,
      stepIndex: stepCounter++,
      totalSteps: totalHopsCount,
      type: 'ICMP',
      stage: `ICMP Echo Request (${hop.fromDev.name} -> ${hop.toDev.name})`,
      fromDeviceId: hop.fromDev.id,
      toDeviceId: hop.toDev.id,
      fromPort: hop.fromPort,
      toPort: hop.toPort,
      linkId: hop.linkId,
      status: isLastHop ? 'forward' : 'forward',
      message: hop.vlanTag
        ? `Forwarding 802.1Q tagged (VLAN ${hop.vlanTag}) frame to ${hop.toDev.name} [TTL=${ttl}]`
        : `Forwarding ICMP Echo Request to ${hop.toDev.name} [TTL=${ttl}]`,
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
        summary: 'Echo Request (Type 8, Code 0)',
        details: { type: 8, code: 0, sequence: 1, identifier: 0x1a2b, vlan: hop.vlanTag },
      },
    });
  }

  // Step 3: Return Path ICMP Echo Reply
  const reverseHops = [...forwardPath.hops].reverse().map((h) => ({
    fromDev: h.toDev,
    toDev: h.fromDev,
    fromPort: h.toPort,
    toPort: h.fromPort,
    linkId: h.linkId,
    srcMac: h.dstMac,
    dstMac: h.srcMac,
    vlanTag: h.vlanTag,
  }));

  let replyTtl = 64;
  for (let i = 0; i < reverseHops.length; i++) {
    const hop = reverseHops[i];
    const isFinal = i === reverseHops.length - 1;

    if (hop.fromDev.type === 'router' || hop.fromDev.type === 'firewall' || hop.fromDev.type === 'l3switch') {
      replyTtl = Math.max(1, replyTtl - 1);
    }

    steps.push({
      id: `icmp_rep_${Date.now()}_${stepCounter}`,
      stepIndex: stepCounter++,
      totalSteps: totalHopsCount,
      type: 'ICMP',
      stage: `ICMP Echo Reply (${hop.fromDev.name} -> ${hop.toDev.name})`,
      fromDeviceId: hop.fromDev.id,
      toDeviceId: hop.toDev.id,
      fromPort: hop.fromPort,
      toPort: hop.toPort,
      linkId: hop.linkId,
      status: isFinal ? 'success' : 'reply',
      message: isFinal
        ? `ICMP Echo Reply successfully received by ${srcDev.name}! Round-trip 0.84ms.`
        : `Forwarding ICMP Echo Reply towards ${hop.toDev.name}`,
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
        ttl: replyTtl,
        protocol: 'ICMP',
        srcIp: dstIp,
        dstIp: srcIp,
      },
      l4Payload: {
        protocol: 'ICMP',
        summary: 'Echo Reply (Type 0, Code 0)',
        details: { type: 0, code: 0, sequence: 1, identifier: 0x1a2b, rtt: '0.84 ms' },
      },
    });
  }

  // Update total steps counter
  steps.forEach((s) => (s.totalSteps = steps.length));
  return { steps, success: true };
}

interface SimulatedHop {
  fromDev: Device;
  toDev: Device;
  fromPort: string;
  toPort: string;
  linkId: string;
  srcMac: string;
  dstMac: string;
  vlanTag?: number;
}

interface ForwardPathResult {
  success: boolean;
  hops: SimulatedHop[];
  dropDevice?: Device;
  errorMessage?: string;
}

function findL2L3ForwardPath(
  srcDev: Device,
  srcIfaceName: string,
  dstDev: Device | undefined,
  dstIp: string,
  _nextHopIp: string,
  devices: Device[],
  links: Link[],
  stpTopology: any,
  ospfState: OspfState
): ForwardPathResult {
  if (!dstDev) {
    return {
      success: false,
      hops: [],
      errorMessage: `Destination IP ${dstIp} is not reachable on any configured network device.`,
    };
  }

  // Determine starting VLAN tag (based on source interface accessVlan or sub-interface encapsulation)
  const srcIface = srcDev.config.interfaces[srcIfaceName];
  let currentVlan = srcIface?.accessVlan || 1;
  if (srcIfaceName.includes('.') && srcIface?.encapsulationDot1Q) {
    currentVlan = srcIface.encapsulationDot1Q;
  }

  // Dijkstra / BFS search through the network graph evaluating L2 VLAN and L3 routing rules
  interface State {
    currentDevId: string;
    inPort: string;
    currentVlan: number;
    hops: SimulatedHop[];
    visited: Set<string>;
  }

  const queue: State[] = [
    {
      currentDevId: srcDev.id,
      inPort: srcIfaceName,
      currentVlan,
      hops: [],
      visited: new Set([`${srcDev.id}:${srcIfaceName}`]),
    },
  ];

  const routeDrops = new Set<string>();
  const physicalOf = (n: string) => n.split('.')[0];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currDev = devices.find((d) => d.id === current.currentDevId);
    if (!currDev) continue;

    // Check if reached destination device
    if (currDev.id === dstDev.id) {
      return { success: true, hops: current.hops };
    }

    // Find links attached to this device
    const attachedLinks = links.filter(
      (l) => l.fromDevice === currDev.id || l.toDevice === currDev.id
    );

    for (const link of attachedLinks) {
      const isFrom = link.fromDevice === currDev.id;
      const egressPortName = isFrom ? link.fromPort : link.toPort;
      const ingressPortName = isFrom ? link.toPort : link.fromPort;
      const nextDevId = isFrom ? link.toDevice : link.fromDevice;
      const nextDev = devices.find((d) => d.id === nextDevId);
      if (!nextDev) continue;

      const key = `${nextDevId}:${ingressPortName}`;
      if (current.visited.has(key)) continue;

      const egressIface = currDev.config.interfaces[egressPortName];
      const ingressIface = nextDev.config.interfaces[ingressPortName];

      // 1. Port Status Check
      if (egressIface && egressIface.status === 'down') continue;
      if (ingressIface && ingressIface.status === 'down') continue;

      // 2. STP Blocking Check for current frame VLAN (PVST+)
      const stpEgress = getStpPortState(stpTopology, currDev.id, egressPortName, current.currentVlan);
      if (stpEgress && stpEgress.state === 'BLK') continue;
      const stpIngress = getStpPortState(stpTopology, nextDev.id, ingressPortName, current.currentVlan);
      if (stpIngress && stpIngress.state === 'BLK') continue;

      // 3. VLAN and Mode evaluation
      let outVlan = current.currentVlan;
      let frameTagged: number | undefined = undefined;

      const isSwitch = currDev.type === 'switch' || currDev.type === 'switch3560' || currDev.type === 'l3switch' || currDev.type === 'nexus9000';

      if (isSwitch) {
        const mode = egressIface?.mode || 'access';
        if (mode === 'access') {
          const accessVlan = egressIface?.accessVlan || 1;
          if (accessVlan !== current.currentVlan) {
            // Drop: Access port assigned to different VLAN than frame
            continue;
          }
          outVlan = accessVlan;
        } else if (mode === 'trunk') {
          const allowed = egressIface?.trunkAllowedVlans;
          if (allowed && allowed.length > 0 && !allowed.includes(current.currentVlan)) {
            // Drop: VLAN not permitted across trunk
            continue;
          }
          const nativeVlan = egressIface?.nativeVlan || 1;
          if (current.currentVlan !== nativeVlan) {
            frameTagged = current.currentVlan;
          }
        }
      }

      // 4. L3 forwarding decision: a router/L3 switch only forwards if its routing table says so
      if (isRoutedForwarder(currDev) && currDev.id !== dstDev.id) {
        const route = lookupRoute(currDev, dstIp, ospfState.routes[currDev.id] || []);
        if (!route) {
          routeDrops.add(`No route to ${dstIp} on ${currDev.name} (routing table has no matching prefix and no default route).`);
          continue;
        }
        if (route.type !== 'connected' && !route.outInterface) {
          routeDrops.add(`${currDev.name} cannot resolve next hop ${route.nextHopIp} for ${dstIp}: no connected subnet reaches it.`);
          continue;
        }
        if (route.outInterface && !isVirtualIface(route.outInterface) && physicalOf(egressPortName) !== route.outInterface) {
          continue; // this link is not the egress interface chosen by the routing table
        }
        if (route.subInterface) {
          const subIface = currDev.config.interfaces[route.subInterface];
          if (subIface && subIface.encapsulationDot1Q) {
            outVlan = subIface.encapsulationDot1Q;
            frameTagged = subIface.encapsulationDot1Q;
          }
        }
      }

      const hopSrcMac = egressIface?.mac || '00:11:22:33:44:55';
      const hopDstMac = ingressIface?.mac || '00:aa:bb:cc:dd:ee';

      const nextVisited = new Set(current.visited);
      nextVisited.add(key);

      queue.push({
        currentDevId: nextDevId,
        inPort: ingressPortName,
        currentVlan: outVlan,
        hops: [
          ...current.hops,
          {
            fromDev: currDev,
            toDev: nextDev,
            fromPort: egressPortName,
            toPort: ingressPortName,
            linkId: link.id,
            srcMac: hopSrcMac,
            dstMac: hopDstMac,
            vlanTag: frameTagged,
          },
        ],
        visited: nextVisited,
      });
    }
  }

  // If no path found through switches/routers
  if (routeDrops.size > 0) {
    return { success: false, hops: [], errorMessage: [...routeDrops][0] };
  }
  return {
    success: false,
    hops: [],
    errorMessage: `No valid forwarding path found between ${srcDev.name} and ${dstDev.name}. Check VLAN memberships, trunk allowances, or IP routing.`,
  };
}

export function simulateDhcp(
  clientDeviceId: string,
  devices: Device[],
  _links: Link[]
): { steps: SimulationStep[]; allocatedConfig?: { ip: string; mask: string; gateway: string; dns: string }; error?: string } {
  const client = devices.find((d) => d.id === clientDeviceId);
  if (!client) return { steps: [], error: 'Client device not found' };

  // Locate DHCP Server (either Server device with DHCP enabled, or Router with DHCP pool)
  let dhcpServer: Device | undefined;
  let serverPoolConfig: { ip: string; mask: string; gateway: string; dns: string } | undefined;

  for (const d of devices) {
    if (d.type === 'server' && d.config.services?.dhcp?.enabled) {
      dhcpServer = d;
      const s = d.config.services.dhcp;
      serverPoolConfig = {
        ip: s.startIp,
        mask: s.mask,
        gateway: s.defaultGateway,
        dns: s.dnsServer,
      };
      break;
    }
    if ((d.type === 'router' || d.type === 'l3switch') && d.config.dhcpPools) {
      const firstPool = Object.values(d.config.dhcpPools)[0];
      if (firstPool && firstPool.network && firstPool.mask) {
        dhcpServer = d;
        const netParts = firstPool.network.split('.');
        const nextIp = `${netParts[0]}.${netParts[1]}.${netParts[2]}.50`;
        serverPoolConfig = {
          ip: nextIp,
          mask: firstPool.mask,
          gateway: firstPool.defaultRouter,
          dns: firstPool.dnsServer || '8.8.8.8',
        };
        break;
      }
    }
  }

  if (!dhcpServer || !serverPoolConfig) {
    return {
      steps: [],
      error: 'No active DHCP Server or router DHCP pool discovered on the network topology.',
    };
  }

  const clientIface = Object.values(client.config.interfaces)[0];
  const clientMac = clientIface ? clientIface.mac : '00:1c:b1:00:00:01';
  const serverIface = Object.values(dhcpServer.config.interfaces)[0];
  const serverMac = serverIface ? serverIface.mac : '00:1c:b1:99:99:99';
  const serverIp = serverIface?.ip || serverPoolConfig.gateway || '192.168.1.1';

  const steps: SimulationStep[] = [];

  // Stage 1: DHCP DISCOVER
  steps.push({
    id: `dhcp_disc_${Date.now()}`,
    stepIndex: 1,
    totalSteps: 4,
    type: 'DHCP',
    stage: 'DHCP Discover (Broadcast)',
    fromDeviceId: client.id,
    toDeviceId: dhcpServer.id,
    fromPort: clientIface?.name || 'Fa0/0',
    toPort: serverIface?.name || 'Fa0/0',
    status: 'broadcast',
    message: 'DHCP Discover: Client broadcasts request for IP address parameters',
    l2Frame: {
      preamble: '10101011',
      srcMac: clientMac,
      dstMac: 'FF:FF:FF:FF:FF:FF',
      type: '0x0800 (IPv4)',
    },
    l3Packet: {
      version: 4,
      ihl: 5,
      tos: 0,
      totalLength: 328,
      ttl: 128,
      protocol: 'UDP',
      srcIp: '0.0.0.0',
      dstIp: '255.255.255.255',
    },
    l4Payload: {
      protocol: 'DHCP',
      summary: 'DHCP Discover (Type 1)',
      details: {
        op: 'BOOTREQUEST (1)',
        xid: '0x39a1c24e',
        clientMac,
        sourcePort: 68,
        destinationPort: 67,
      },
    },
  });

  // Stage 2: DHCP OFFER
  steps.push({
    id: `dhcp_offer_${Date.now()}`,
    stepIndex: 2,
    totalSteps: 4,
    type: 'DHCP',
    stage: 'DHCP Offer (Unicast/Broadcast)',
    fromDeviceId: dhcpServer.id,
    toDeviceId: client.id,
    fromPort: serverIface?.name || 'Fa0/0',
    toPort: clientIface?.name || 'Fa0/0',
    status: 'reply',
    message: `DHCP Offer: Server offers ${serverPoolConfig.ip} with lease options`,
    l2Frame: {
      preamble: '10101011',
      srcMac: serverMac,
      dstMac: clientMac,
      type: '0x0800 (IPv4)',
    },
    l3Packet: {
      version: 4,
      ihl: 5,
      tos: 0,
      totalLength: 328,
      ttl: 64,
      protocol: 'UDP',
      srcIp: serverIp,
      dstIp: '255.255.255.255',
    },
    l4Payload: {
      protocol: 'DHCP',
      summary: 'DHCP Offer (Type 2)',
      details: {
        op: 'BOOTREPLY (2)',
        yourIp: serverPoolConfig.ip,
        serverIp,
        subnetMask: serverPoolConfig.mask,
        router: serverPoolConfig.gateway,
        dns: serverPoolConfig.dns,
        leaseTime: '86400s (24 hours)',
      },
    },
  });

  // Stage 3: DHCP REQUEST
  steps.push({
    id: `dhcp_req_${Date.now()}`,
    stepIndex: 3,
    totalSteps: 4,
    type: 'DHCP',
    stage: 'DHCP Request (Broadcast)',
    fromDeviceId: client.id,
    toDeviceId: dhcpServer.id,
    fromPort: clientIface?.name || 'Fa0/0',
    toPort: serverIface?.name || 'Fa0/0',
    status: 'forward',
    message: `DHCP Request: Client formally accepts offer ${serverPoolConfig.ip}`,
    l2Frame: {
      preamble: '10101011',
      srcMac: clientMac,
      dstMac: 'FF:FF:FF:FF:FF:FF',
      type: '0x0800 (IPv4)',
    },
    l3Packet: {
      version: 4,
      ihl: 5,
      tos: 0,
      totalLength: 328,
      ttl: 128,
      protocol: 'UDP',
      srcIp: '0.0.0.0',
      dstIp: '255.255.255.255',
    },
    l4Payload: {
      protocol: 'DHCP',
      summary: 'DHCP Request (Type 3)',
      details: {
        op: 'BOOTREQUEST (1)',
        requestedIp: serverPoolConfig.ip,
        serverIdentifier: serverIp,
        clientMac,
      },
    },
  });

  // Stage 4: DHCP ACK
  steps.push({
    id: `dhcp_ack_${Date.now()}`,
    stepIndex: 4,
    totalSteps: 4,
    type: 'DHCP',
    stage: 'DHCP Acknowledgment (ACK)',
    fromDeviceId: dhcpServer.id,
    toDeviceId: client.id,
    fromPort: serverIface?.name || 'Fa0/0',
    toPort: clientIface?.name || 'Fa0/0',
    status: 'success',
    message: `DHCP ACK: Server confirms IP configuration ${serverPoolConfig.ip}`,
    l2Frame: {
      preamble: '10101011',
      srcMac: serverMac,
      dstMac: clientMac,
      type: '0x0800 (IPv4)',
    },
    l3Packet: {
      version: 4,
      ihl: 5,
      tos: 0,
      totalLength: 328,
      ttl: 64,
      protocol: 'UDP',
      srcIp: serverIp,
      dstIp: serverPoolConfig.ip,
    },
    l4Payload: {
      protocol: 'DHCP',
      summary: 'DHCP ACK (Type 5)',
      details: {
        op: 'BOOTREPLY (2)',
        confirmedIp: serverPoolConfig.ip,
        subnetMask: serverPoolConfig.mask,
        defaultGateway: serverPoolConfig.gateway,
        dnsServer: serverPoolConfig.dns,
        status: 'Lease active',
      },
    },
  });

  return { steps, allocatedConfig: serverPoolConfig };
}
