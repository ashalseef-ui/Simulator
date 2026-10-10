/**
 * OSPFv2 engine (single LSDB view, broadcast networks).
 *
 * What is modelled, derived purely from device configs + cabling:
 *  - which interfaces run OSPF (network statements, wildcard match, area, passive)
 *  - L2 reachability between routed interfaces through switches (VLAN / trunk / STP aware)
 *  - adjacency conditions: same subnet + mask, same area, same hello/dead timers,
 *    neither side passive, both interfaces up, unique router IDs
 *  - DR / BDR election per segment (priority, then router ID)
 *  - SPF (Dijkstra) over the adjacency graph, producing a real routing table per router
 *
 * Deliberately NOT modelled: multi-area LSA types (ABR summarisation), ECMP, virtual links,
 * authentication, MTU negotiation, NBMA / point-to-point network types.
 * Areas still matter: mismatched areas on a link prevent the adjacency from forming.
 */
import { Device, DeviceInterface, Link, StpTopologyState } from '../types/network';
import { ipToInt, intToIp, getNetworkAddress, maskToCidr, areSameSubnet } from '../utils/ipUtils';

export const OSPF_AD = 110;

const ROUTED_TYPES = new Set(['router', 'router4331', 'router1941', 'firewall', 'firepower', 'l3switch', 'switch3560', 'switch3850', 'switch9300', 'nexus9000']);
const SWITCH_TYPES = new Set(['switch', 'switch2960_48', 'switch3560', 'switch3850', 'switch9300', 'l3switch', 'nexus9000']);

export const isSwitchDevice = (d: Device) => SWITCH_TYPES.has(d.type);

/** A device can run OSPF only if it is a router, or an L3 switch/firewall with routing on. */
export function isOspfCapable(d: Device): boolean {
  if (!ROUTED_TYPES.has(d.type)) return false;
  if (d.type.startsWith('router') || d.type === 'firewall' || d.type === 'firepower') return true;
  return !!d.config.ipRoutingEnabled;
}

export interface OspfInterfaceInfo {
  deviceId: string;
  name: string;
  ip: string;
  mask: string;
  area: number;
  cost: number;
  hello: number;
  dead: number;
  priority: number;
  passive: boolean;
  state: 'DR' | 'BDR' | 'DROTHER' | 'WAITING' | 'DOWN' | 'LOOPBACK';
  drId?: string;
  bdrId?: string;
  neighborCount: number;
}

export interface OspfNeighbor {
  routerId: string;
  priority: number;
  /** FULL/DR, FULL/BDR, FULL/DROTHER */
  state: string;
  /** Seconds left on the dead timer (dead interval minus half a hello). */
  deadSeconds: number;
  address: string;
  localInterface: string;
  neighborDeviceId: string;
  neighborInterface: string;
}

export interface OspfRoute {
  network: string;
  mask: string;
  cost: number;
  nextHopIp: string;
  outInterface: string;
  area: number;
  originRouterId: string;
}

export interface OspfProblem {
  deviceId: string;
  interfaceName: string;
  peerDeviceId: string;
  peerInterface: string;
  reason: string;
}

export interface OspfState {
  routerIds: Record<string, string>;
  interfaces: Record<string, OspfInterfaceInfo[]>;
  neighbors: Record<string, OspfNeighbor[]>;
  routes: Record<string, OspfRoute[]>;
  /** Why adjacencies that "almost" formed did not (feeds show commands + AI hints). */
  problems: OspfProblem[];
}

export function ospfCost(iface: DeviceInterface): number {
  if (iface.ospfCost && iface.ospfCost > 0) return iface.ospfCost;
  const speed = iface.speed && iface.speed > 0 ? iface.speed : 100;
  return Math.max(1, Math.floor(100 / speed)); // IOS default reference bandwidth: 100 Mbps
}

const isLoopback = (name: string) => /^loopback/i.test(name) || /^lo\d/i.test(name);
const isSvi = (name: string) => /^vlan\d+$/i.test(name);
const physicalPort = (name: string) => name.split('.')[0];

function wildcardMatch(ip: string, network: string, wildcard: string): boolean {
  const care = (~ipToInt(wildcard)) >>> 0;
  return ((ipToInt(ip) & care) >>> 0) === ((ipToInt(network) & care) >>> 0);
}

function deriveRouterId(dev: Device): string {
  const explicit = dev.config.ospf?.routerId;
  if (explicit) return explicit;
  const ifaces = Object.entries(dev.config.interfaces).filter(([, i]) => i.ip && i.status === 'up');
  const pick = (list: [string, DeviceInterface][]) =>
    list.map(([, i]) => i.ip as string).sort((a, b) => ipToInt(b) - ipToInt(a))[0];
  const loops = ifaces.filter(([n]) => isLoopback(n));
  if (loops.length) return pick(loops);
  const phys = ifaces.length ? ifaces : Object.entries(dev.config.interfaces).filter(([, i]) => i.ip);
  return phys.length ? pick(phys) : '0.0.0.0';
}

interface Frame {
  vlan: number | null; // null = untagged
}

/** Walk L2 from a routed interface and return every routed endpoint (device, interface) on the same segment. */
function l2Peers(
  start: { dev: Device; ifaceName: string },
  devices: Device[],
  links: Link[],
  stp?: StpTopologyState
): { dev: Device; ifaceName: string }[] {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const result: { dev: Device; ifaceName: string }[] = [];
  const seen = new Set<string>();

  const startIface = start.dev.config.interfaces[start.ifaceName];
  const startPort = physicalPort(start.ifaceName);
  const startFrame: Frame = {
    vlan: start.ifaceName.includes('.') && startIface?.encapsulationDot1Q ? startIface.encapsulationDot1Q : null,
  };

  const blocked = (devId: string, port: string) => stp?.ports?.[`${devId}:${port}`]?.state === 'BLK';

  type Work = { dev: Device; inPort: string; frame: Frame };
  const queue: Work[] = [];

  const crossLinks = (fromDev: Device, egressPort: string, frame: Frame) => {
    for (const l of links) {
      let peerId: string | null = null;
      let peerPort = '';
      if (l.fromDevice === fromDev.id && l.fromPort === egressPort) {
        peerId = l.toDevice;
        peerPort = l.toPort;
      } else if (l.toDevice === fromDev.id && l.toPort === egressPort) {
        peerId = l.fromDevice;
        peerPort = l.fromPort;
      }
      if (!peerId) continue;
      const peer = byId.get(peerId);
      if (!peer) continue;
      const pIface = peer.config.interfaces[peerPort];
      const eIface = fromDev.config.interfaces[egressPort];
      if (eIface?.status === 'down' || pIface?.status === 'down') continue;
      if (blocked(fromDev.id, egressPort) || blocked(peer.id, peerPort)) continue;
      queue.push({ dev: peer, inPort: peerPort, frame });
    }
  };

  crossLinks(start.dev, startPort, startFrame);

  while (queue.length) {
    const { dev, inPort, frame } = queue.shift()!;
    const key = `${dev.id}:${inPort}:${frame.vlan}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (isSwitchDevice(dev)) {
      const inIface = dev.config.interfaces[inPort];
      const mode = inIface?.mode || 'access';
      let vlan: number;
      if (mode === 'trunk') {
        vlan = frame.vlan ?? inIface?.nativeVlan ?? 1;
        const allowed = inIface?.trunkAllowedVlans;
        if (allowed && allowed.length && !allowed.includes(vlan)) continue;
      } else {
        const access = inIface?.accessVlan ?? 1;
        if (frame.vlan !== null && frame.vlan !== access) continue;
        vlan = access;
      }

      // An SVI on this (L3) switch is itself a segment member.
      const sviName = `Vlan${vlan}`;
      const svi = dev.config.interfaces[sviName];
      if (isOspfCapable(dev) && svi?.ip && svi.status === 'up') result.push({ dev, ifaceName: sviName });

      // Flood out of every other port that carries this VLAN.
      for (const [portName, pIface] of Object.entries(dev.config.interfaces)) {
        if (portName === inPort || isSvi(portName) || isLoopback(portName)) continue;
        if (pIface.status === 'down') continue;
        const pMode = pIface.mode || 'access';
        if (pMode === 'routed') continue;
        if (pMode === 'access') {
          if ((pIface.accessVlan ?? 1) !== vlan) continue;
          crossLinks(dev, portName, { vlan: null });
        } else {
          const allowed = pIface.trunkAllowedVlans;
          if (allowed && allowed.length && !allowed.includes(vlan)) continue;
          const native = pIface.nativeVlan ?? 1;
          crossLinks(dev, portName, { vlan: vlan === native ? null : vlan });
        }
      }
    } else {
      // Routed endpoint: find the interface that terminates this frame.
      const candidates = Object.keys(dev.config.interfaces).filter((n) => physicalPort(n) === inPort && !isSvi(n));
      const match = candidates.find((n) =>
        frame.vlan === null ? !n.includes('.') : dev.config.interfaces[n].encapsulationDot1Q === frame.vlan
      );
      if (match && dev.config.interfaces[match]?.ip) result.push({ dev, ifaceName: match });
    }
  }
  return result;
}

interface Enabled {
  dev: Device;
  name: string;
  iface: DeviceInterface;
  area: number;
  passive: boolean;
}

export function computeOspf(devices: Device[], links: Link[], stp?: StpTopologyState): OspfState {
  const state: OspfState = { routerIds: {}, interfaces: {}, neighbors: {}, routes: {}, problems: [] };
  const speakers = devices.filter((d) => isOspfCapable(d) && d.config.ospf);
  if (speakers.length === 0) return state;

  // 1. Which interfaces run OSPF?
  const enabled: Enabled[] = [];
  for (const dev of speakers) {
    state.routerIds[dev.id] = deriveRouterId(dev);
    const ospf = dev.config.ospf!;
    for (const [name, iface] of Object.entries(dev.config.interfaces)) {
      if (!iface.ip || !iface.mask) continue;
      const stmt = ospf.networks.find((n) => wildcardMatch(iface.ip!, n.network, n.wildcard));
      if (!stmt) continue;
      const passive = (ospf.passiveInterfaces || []).includes(name);
      enabled.push({ dev, name, iface, area: stmt.area, passive });
    }
  }
  const enabledKey = (e: { dev: Device; name: string }) => `${e.dev.id}:${e.name}`;
  const enabledMap = new Map(enabled.map((e) => [enabledKey(e), e]));

  // 2. Adjacencies per interface
  type Adj = { a: Enabled; b: Enabled };
  const adjacencies: Adj[] = [];
  const segmentMembers = new Map<string, Enabled[]>();

  for (const e of enabled) {
    state.interfaces[e.dev.id] ||= [];
    const base: OspfInterfaceInfo = {
      deviceId: e.dev.id,
      name: e.name,
      ip: e.iface.ip!,
      mask: e.iface.mask!,
      area: e.area,
      cost: ospfCost(e.iface),
      hello: e.iface.ospfHelloInterval ?? 10,
      dead: e.iface.ospfDeadInterval ?? 40,
      priority: e.iface.ospfPriority ?? 1,
      passive: e.passive,
      state: e.iface.status === 'down' ? 'DOWN' : isLoopback(e.name) ? 'LOOPBACK' : 'WAITING',
      neighborCount: 0,
    };
    state.interfaces[e.dev.id].push(base);

    if (isLoopback(e.name) || e.iface.status === 'down' || e.passive) continue;

    const peers = l2Peers({ dev: e.dev, ifaceName: e.name }, devices, links, stp);
    const members: Enabled[] = [e];
    for (const p of peers) {
      if (p.dev.id === e.dev.id) continue;
      const pe = enabledMap.get(`${p.dev.id}:${p.ifaceName}`);
      if (!pe) {
        continue;
      }
      const problem = (reason: string) =>
        state.problems.push({
          deviceId: e.dev.id,
          interfaceName: e.name,
          peerDeviceId: pe.dev.id,
          peerInterface: pe.name,
          reason,
        });

      if (pe.iface.status === 'down') continue;
      if (pe.passive) {
        problem(`${pe.dev.name} ${pe.name} is configured passive-interface, so it sends no Hellos.`);
        continue;
      }
      if (e.iface.mask !== pe.iface.mask || !areSameSubnet(e.iface.ip!, pe.iface.ip!, e.iface.mask!)) {
        problem(`Subnet/mask mismatch: ${e.iface.ip}/${maskToCidr(e.iface.mask!)} vs ${pe.iface.ip}/${maskToCidr(pe.iface.mask!)}.`);
        continue;
      }
      if (e.area !== pe.area) {
        problem(`Area mismatch: ${e.dev.name} ${e.name} is in area ${e.area}, ${pe.dev.name} ${pe.name} is in area ${pe.area}.`);
        continue;
      }
      const h1 = e.iface.ospfHelloInterval ?? 10;
      const h2 = pe.iface.ospfHelloInterval ?? 10;
      if (h1 !== h2) {
        problem(`Hello interval mismatch: ${h1}s on ${e.dev.name} ${e.name} vs ${h2}s on ${pe.dev.name} ${pe.name}.`);
        continue;
      }
      const d1 = e.iface.ospfDeadInterval ?? 40;
      const d2 = pe.iface.ospfDeadInterval ?? 40;
      if (d1 !== d2) {
        problem(`Dead interval mismatch: ${d1}s vs ${d2}s.`);
        continue;
      }
      if (state.routerIds[e.dev.id] === state.routerIds[pe.dev.id]) {
        problem(`Duplicate router ID ${state.routerIds[e.dev.id]} on ${e.dev.name} and ${pe.dev.name}.`);
        continue;
      }
      members.push(pe);
      adjacencies.push({ a: e, b: pe });
    }
    segmentMembers.set(enabledKey(e), members);
  }

  // 3. DR/BDR election per interface's segment, then neighbor tables
  const roleOf = (members: Enabled[], target: Enabled): 'DR' | 'BDR' | 'DROTHER' => {
    const eligible = members
      .filter((m) => (m.iface.ospfPriority ?? 1) > 0)
      .sort((x, y) => {
        const px = x.iface.ospfPriority ?? 1;
        const py = y.iface.ospfPriority ?? 1;
        if (px !== py) return py - px;
        return ipToInt(state.routerIds[y.dev.id]) - ipToInt(state.routerIds[x.dev.id]);
      });
    if (eligible[0] && enabledKey(eligible[0]) === enabledKey(target)) return 'DR';
    if (eligible[1] && enabledKey(eligible[1]) === enabledKey(target)) return 'BDR';
    return 'DROTHER';
  };

  for (const e of enabled) {
    const members = segmentMembers.get(enabledKey(e));
    const info = state.interfaces[e.dev.id].find((i) => i.name === e.name)!;
    if (!members || members.length < 2) {
      continue;
    }
    const role = roleOf(members, e);
    info.state = role;
    info.neighborCount = members.length - 1;
    const dr = members.find((m) => roleOf(members, m) === 'DR');
    const bdr = members.find((m) => roleOf(members, m) === 'BDR');
    info.drId = dr ? state.routerIds[dr.dev.id] : undefined;
    info.bdrId = bdr ? state.routerIds[bdr.dev.id] : undefined;

    state.neighbors[e.dev.id] ||= [];
    for (const m of members) {
      if (enabledKey(m) === enabledKey(e)) continue;
      state.neighbors[e.dev.id].push({
        routerId: state.routerIds[m.dev.id],
        priority: m.iface.ospfPriority ?? 1,
        state: `FULL/${roleOf(members, m)}`,
        deadSeconds: Math.max(1, (e.iface.ospfDeadInterval ?? 40) - Math.floor((e.iface.ospfHelloInterval ?? 10) / 2)),
        address: m.iface.ip!,
        localInterface: e.name,
        neighborDeviceId: m.dev.id,
        neighborInterface: m.name,
      });
    }
  }

  // 4. SPF per router over the adjacency graph
  type Edge = { to: string; cost: number; viaIface: string; nextHopIp: string };
  const graph = new Map<string, Edge[]>();
  const addEdge = (from: Enabled, to: Enabled) => {
    const list = graph.get(from.dev.id) || [];
    list.push({ to: to.dev.id, cost: ospfCost(from.iface), viaIface: from.name, nextHopIp: to.iface.ip! });
    graph.set(from.dev.id, list);
  };
  adjacencies.forEach(({ a, b }) => {
    addEdge(a, b);
    addEdge(b, a);
  });

  // Prefixes originated by every OSPF router (all enabled interfaces, including passive & loopback)
  const originated = new Map<string, { network: string; mask: string; cost: number; area: number }[]>();
  for (const e of enabled) {
    if (e.iface.status === 'down') continue;
    const loop = isLoopback(e.name);
    const mask = loop ? '255.255.255.255' : e.iface.mask!;
    const list = originated.get(e.dev.id) || [];
    list.push({
      network: loop ? e.iface.ip! : getNetworkAddress(e.iface.ip!, mask),
      mask,
      cost: loop ? 1 : ospfCost(e.iface),
      area: e.area,
    });
    originated.set(e.dev.id, list);
  }

  for (const src of speakers) {
    const dist = new Map<string, number>([[src.id, 0]]);
    const first = new Map<string, { iface: string; nh: string }>();
    const done = new Set<string>();
    while (true) {
      let cur: string | null = null;
      let best = Infinity;
      for (const [id, d] of dist) if (!done.has(id) && d < best) { best = d; cur = id; }
      if (cur === null) break;
      done.add(cur);
      for (const edge of graph.get(cur) || []) {
        const nd = best + edge.cost;
        if (nd < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, nd);
          first.set(edge.to, cur === src.id ? { iface: edge.viaIface, nh: edge.nextHopIp } : first.get(cur)!);
        }
      }
    }

    const own = new Set(
      Object.values(src.config.interfaces)
        .filter((i) => i.ip && i.mask && i.status === 'up')
        .map((i) => `${getNetworkAddress(i.ip!, i.mask!)}/${i.mask}`)
    );
    const table = new Map<string, OspfRoute>();
    for (const [devId, d] of dist) {
      if (devId === src.id) continue;
      const hop = first.get(devId);
      if (!hop) continue;
      for (const p of originated.get(devId) || []) {
        const k = `${p.network}/${p.mask}`;
        if (own.has(k)) continue; // connected wins (AD 0)
        const total = d + p.cost;
        const existing = table.get(k);
        if (!existing || total < existing.cost) {
          table.set(k, {
            network: p.network,
            mask: p.mask,
            cost: total,
            nextHopIp: hop.nh,
            outInterface: hop.iface,
            area: p.area,
            originRouterId: state.routerIds[devId],
          });
        }
      }
    }
    state.routes[src.id] = [...table.values()].sort((a, b) => ipToInt(a.network) - ipToInt(b.network));
  }

  return state;
}

/** "O  10.1.1.0/24 [110/2] via 10.0.0.2, Gi0/0" style line. */
export function formatOspfRoute(r: OspfRoute): string {
  return `O        ${r.network}/${maskToCidr(r.mask)} [${OSPF_AD}/${r.cost}] via ${r.nextHopIp}, ${r.outInterface}`;
}

export function formatNeighborTable(neighbors: OspfNeighbor[]): string {
  let out = 'Neighbor ID     Pri   State           Dead Time   Address         Interface\n';
  for (const n of neighbors) {
    out += `${n.routerId.padEnd(15)} ${String(n.priority).padStart(3)}   ${n.state.padEnd(15)} 00:00:${String(n.deadSeconds).padStart(2, '0')}    ${n.address.padEnd(15)} ${n.localInterface}\n`;
  }
  return out.trimEnd();
}

export { intToIp };
