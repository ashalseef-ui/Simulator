import { Device, Link } from '../../types/network';
import { getStpPortState } from '../stpEngine';
import { OspfState } from '../ospfEngine';
import { matchIpsecCryptoMap } from '../protocols/ipsecEngine';
import { matchVxlanOverlay } from '../protocols/vxlanEngine';
import { lookupRoute, isRoutedForwarder, isVirtualIface } from './routeLookup';

export interface SimulatedHop {
  fromDev: Device;
  toDev: Device;
  fromPort: string;
  toPort: string;
  linkId: string;
  srcMac: string;
  dstMac: string;
  vlanTag?: number;
  mplsLabel?: number;
  mplsAction?: 'push' | 'swap' | 'pop';
  isIpsecEncapsulated?: boolean;
  ipsecSpi?: string;
  isVxlan?: boolean;
  vxlanVni?: number;
}

export interface ForwardPathResult {
  success: boolean;
  hops: SimulatedHop[];
  dropDevice?: Device;
  errorMessage?: string;
}

export function findL2L3ForwardPath(
  srcDev: Device,
  srcIfaceName: string,
  dstDev: Device | undefined,
  dstIp: string,
  _nextHopIp: string,
  devices: Device[],
  links: Link[],
  stpTopology: any,
  ospfState: OspfState,
  isisState?: any,
  eigrpState?: any,
  mplsState?: any
): ForwardPathResult {
  if (!srcDev || !srcDev.config || !srcDev.config.interfaces) {
    return { success: false, hops: [], errorMessage: 'Invalid source device structure.' };
  }
  if (!dstDev || !dstDev.config || !dstDev.config.interfaces) {
    return {
      success: false,
      hops: [],
      errorMessage: `Destination IP ${dstIp} is not reachable on any configured network device.`,
    };
  }
  if (!Array.isArray(devices) || !Array.isArray(links)) {
    return { success: false, hops: [], errorMessage: 'Topology arrays are invalid.' };
  }

  // Determine starting VLAN tag (based on source interface accessVlan or sub-interface encapsulation)
  const srcIface = srcDev.config.interfaces[srcIfaceName];
  let currentVlan = srcIface?.accessVlan || 1;
  if (srcIfaceName && srcIfaceName.includes('.') && srcIface?.encapsulationDot1Q) {
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
      inPort: srcIfaceName || '',
      currentVlan,
      hops: [],
      visited: new Set([`${srcDev.id}:${srcIfaceName || ''}`]),
    },
  ];

  const routeDrops = new Set<string>();
  const physicalOf = (n: string) => n.split('.')[0];
  let iterations = 0;
  const MAX_ITERATIONS = 2000;

  while (queue.length > 0) {
    iterations++;
    if (iterations > MAX_ITERATIONS) {
      return { success: false, hops: [], errorMessage: 'Path search reached maximum limit (potential routing loop detected).' };
    }
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
      const isFrom: boolean = link.fromDevice === currDev.id;
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
        const route = lookupRoute(
          currDev,
          dstIp,
          ospfState.routes[currDev.id] || [],
          isisState?.routes?.[currDev.id] || [],
          eigrpState?.routes?.[currDev.id] || []
        );
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

      // Check protocol encapsulations: MPLS, IPsec, VXLAN
      let hopMplsLabel: number | undefined;
      let hopMplsAction: 'push' | 'swap' | 'pop' | undefined;
      const isMplsHop = currDev.config.interfaces[egressPortName]?.mplsEnabled || currDev.config.mpls?.enabled;
      if (isMplsHop) {
        const lfib = mplsState?.lfib?.[currDev.id] || [];
        const isIngressPe = mplsState?.ingressPeRouters?.includes(currDev.id);
        const isCore = mplsState?.coreRouters?.includes(currDev.id);
        if (isIngressPe) {
          hopMplsAction = 'push';
          hopMplsLabel = lfib[0]?.inLabel || 1002;
        } else if (isCore) {
          hopMplsAction = 'swap';
          hopMplsLabel = lfib[0]?.inLabel ? lfib[0].inLabel + 2 : 1004;
        } else {
          hopMplsAction = 'pop';
        }
      }

      const cryptoRes = matchIpsecCryptoMap(currDev, srcDev.config.interfaces[srcIfaceName]?.ip || '', dstIp);
      const vxlanRes = matchVxlanOverlay(currDev, outVlan);

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
            mplsLabel: hopMplsLabel,
            mplsAction: hopMplsAction,
            isIpsecEncapsulated: cryptoRes.isEncapsulated,
            ipsecSpi: cryptoRes.spi,
            isVxlan: vxlanRes.isVxlan,
            vxlanVni: vxlanRes.vni,
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
