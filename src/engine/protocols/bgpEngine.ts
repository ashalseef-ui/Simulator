import { Device, Link, BgpEvpnRoute } from '../../types/network';
import { areSameSubnet, ipToInt } from '../../utils/ipUtils';

export interface BgpPeerSession {
  peerIp: string;
  remoteAs: number;
  localAs: number;
  state: 'Established' | 'Active' | 'Idle' | 'Connect' | 'OpenSent' | 'OpenConfirm';
  isExternal: boolean; // true = eBGP, false = iBGP
  uptimeSeconds: number;
  prefixesReceived: number;
  prefixesSent: number;
}

export interface BgpRibEntry {
  prefix: string;
  mask: string;
  nextHop: string;
  asPath: number[];
  origin: 'IGP' | 'EGP' | 'Incomplete';
  localPref: number;
  med: number;
  weight: number;
  isBest: boolean;
  isExternal: boolean;
  learnedFrom: string; // Peer IP
}

export interface BgpComputedState {
  peers: Record<string, BgpPeerSession[]>;
  rib: Record<string, BgpRibEntry[]>;
  routes: Record<string, { prefix: string; mask: string; nextHop: string; outInterface: string; metric: number }[]>;
  evpnTable: Record<string, BgpEvpnRoute[]>;
}

/**
 * Executes standard BGP best-path decision algorithm on candidate paths.
 */
export function selectBestBgpPath(paths: BgpRibEntry[]): BgpRibEntry | null {
  if (!paths || paths.length === 0) return null;
  if (paths.length === 1) {
    paths[0].isBest = true;
    return paths[0];
  }

  const sorted = [...paths].sort((a, b) => {
    // 1. Highest Weight (Cisco default 32768 local, 0 learned)
    if (b.weight !== a.weight) return b.weight - a.weight;

    // 2. Highest Local Preference (default 100)
    if (b.localPref !== a.localPref) return b.localPref - a.localPref;

    // 3. Locally originated (empty AS-path) preferred over learned
    const aLocal = a.asPath.length === 0;
    const bLocal = b.asPath.length === 0;
    if (aLocal !== bLocal) return aLocal ? -1 : 1;

    // 4. Shortest AS-Path length
    if (a.asPath.length !== b.asPath.length) return a.asPath.length - b.asPath.length;

    // 5. Lowest Origin code (IGP < EGP < Incomplete)
    const originScore = { IGP: 1, EGP: 2, Incomplete: 3 };
    const aOrig = originScore[a.origin] || 3;
    const bOrig = originScore[b.origin] || 3;
    if (aOrig !== bOrig) return aOrig - bOrig;

    // 6. Lowest MED
    if (a.med !== b.med) return a.med - b.med;

    // 7. eBGP over iBGP
    if (a.isExternal !== b.isExternal) return a.isExternal ? -1 : 1;

    // 8. Lowest router ID / next-hop IP numeric fallback
    return ipToInt(a.nextHop || '0.0.0.0') - ipToInt(b.nextHop || '0.0.0.0');
  });

  sorted.forEach((p, idx) => (p.isBest = idx === 0));
  return sorted[0];
}

/**
 * Computes global BGP sessions, BGP RIB, and EVPN route advertisements.
 */
export function computeBgpNetworkState(devices: Device[], _links?: Link[]): BgpComputedState {
  const peers: Record<string, BgpPeerSession[]> = {};
  const rib: Record<string, BgpRibEntry[]> = {};
  const routes: Record<string, { prefix: string; mask: string; nextHop: string; outInterface: string; metric: number }[]> = {};
  const evpnTable: Record<string, BgpEvpnRoute[]> = {};

  const bgpDevices = (devices || []).filter((d) => d?.config?.bgp && d.config.bgp.asn > 0);

  for (const dev of bgpDevices) {
    peers[dev.id] = [];
    rib[dev.id] = [];
    routes[dev.id] = [];
    evpnTable[dev.id] = [];
  }

  // 1. Establish BGP Peering Sessions
  for (const devA of bgpDevices) {
    const bgpA = devA.config.bgp!;
    for (const configuredNeighbor of bgpA.neighbors || []) {
      const neighborIp = configuredNeighbor.ip;
      const remoteAs = configuredNeighbor.remoteAs;

      // Locate remote device owning this neighbor IP
      let devB: Device | undefined;
      for (const d of bgpDevices) {
        if (d.id === devA.id) continue;
        for (const iface of Object.values(d.config.interfaces || {})) {
          if (iface.ip === neighborIp && iface.status === 'up') {
            devB = d;
            break;
          }
        }
        if (devB) break;
      }

      const isExternal = remoteAs !== bgpA.asn;
      let sessionState: BgpPeerSession['state'] = 'Idle';

      if (devB) {
        // Check if devB also reciprocates neighbor configuration pointing to devA
        const devANeighborConfigured = devB.config.bgp?.neighbors?.some(
          (n) => n.remoteAs === bgpA.asn
        );
        sessionState = devANeighborConfigured ? 'Established' : 'Active';
      }

      peers[devA.id].push({
        peerIp: neighborIp,
        remoteAs,
        localAs: bgpA.asn,
        state: sessionState,
        isExternal,
        uptimeSeconds: sessionState === 'Established' ? 3600 : 0,
        prefixesReceived: 0,
        prefixesSent: 0,
      });
    }
  }

  // 2. Inject Locally Originated Networks into BGP RIB
  for (const dev of bgpDevices) {
    const bgp = dev.config.bgp!;
    for (const net of bgp.networks || []) {
      if (!net.network || !net.mask) continue;
      rib[dev.id].push({
        prefix: net.network,
        mask: net.mask,
        nextHop: '0.0.0.0',
        asPath: [],
        origin: 'IGP',
        localPref: 100,
        med: 0,
        weight: 32768,
        isBest: true,
        isExternal: false,
        learnedFrom: 'Local',
      });
    }

    // Process EVPN address family if enabled
    if (bgp.addressFamilies?.l2vpnEvpn) {
      // Collect local MACs and VNIs to advertise as Type 2 and Type 3 routes
      const vxlan = dev.config.vxlan;
      const vtepIp = Object.values(dev.config.interfaces || {}).find(
        (i) => i.ip && i.status === 'up' && i.name.toLowerCase().includes('loopback')
      )?.ip || Object.values(dev.config.interfaces || {}).find((i) => i.ip)?.ip || '10.255.255.1';

      for (const [vniStr, vniInfo] of Object.entries(vxlan?.vniMembers || {})) {
        const vni = Number(vniStr);
        // Type 3: Inclusive Multicast Ethernet Tag Route (BUM replication)
        evpnTable[dev.id].push({
          type: 'type-3',
          rd: `${bgp.asn}:${vni}`,
          rt: `${bgp.asn}:${vni}`,
          vni,
          nextHop: vtepIp,
        });

        // Type 2: MAC/IP Advertisements from MAC table
        for (const macEntry of dev.config.macTable || []) {
          if (macEntry.vlan === vniInfo.vlan) {
            evpnTable[dev.id].push({
              type: 'type-2',
              rd: `${bgp.asn}:${vni}`,
              rt: `${bgp.asn}:${vni}`,
              vni,
              mac: macEntry.mac,
              nextHop: vtepIp,
            });
          }
        }
      }
    }
  }

  // 3. Propagate BGP Routes Across Established Peers
  for (const devA of bgpDevices) {
    const establishedPeers = (peers[devA.id] || []).filter((p) => p.state === 'Established');
    const localRoutes = (rib[devA.id] || []).filter((r) => r.isBest);

    for (const peer of establishedPeers) {
      const devB = bgpDevices.find((d) =>
        Object.values(d.config.interfaces || {}).some((i) => i.ip === peer.peerIp)
      );
      if (!devB) continue;

      for (const r of localRoutes) {
        // eBGP split-horizon: do not advertise back if remote AS is already in AS-Path (Loop Prevention)
        if (peer.isExternal && r.asPath.includes(peer.remoteAs)) continue;

        // Resolve local peering egress IP for Next-Hop
        const localEgressIp = Object.values(devA.config.interfaces || {}).find(
          (i) => i.ip && areSameSubnet(i.ip, peer.peerIp, i.mask || '255.255.255.0')
        )?.ip || '10.0.0.1';

        const advertisedPath: BgpRibEntry = {
          prefix: r.prefix,
          mask: r.mask,
          nextHop: localEgressIp,
          asPath: peer.isExternal ? [devA.config.bgp!.asn, ...r.asPath] : [...r.asPath],
          origin: r.origin,
          localPref: peer.isExternal ? 100 : r.localPref,
          med: r.med,
          weight: 0,
          isBest: false,
          isExternal: peer.isExternal,
          learnedFrom: peer.peerIp,
        };

        rib[devB.id].push(advertisedPath);
        peer.prefixesSent++;
      }

      // Propagate EVPN Type 2 & Type 3 routes if EVPN peer
      if (devA.config.bgp?.addressFamilies?.l2vpnEvpn && devB.config.bgp?.addressFamilies?.l2vpnEvpn) {
        for (const evpnRoute of evpnTable[devA.id] || []) {
          evpnTable[devB.id].push({
            ...evpnRoute,
            nextHop: Object.values(devA.config.interfaces || {}).find((i) => i.ip)?.ip || evpnRoute.nextHop,
          });
        }
      }
    }
  }

  // 4. Run Best Path Decision and Generate Active Routing Table Entries
  for (const dev of bgpDevices) {
    const entriesByPrefix: Record<string, BgpRibEntry[]> = {};
    for (const entry of rib[dev.id] || []) {
      const key = `${entry.prefix}/${entry.mask}`;
      if (!entriesByPrefix[key]) entriesByPrefix[key] = [];
      entriesByPrefix[key].push(entry);
    }

    for (const group of Object.values(entriesByPrefix)) {
      const best = selectBestBgpPath(group);
      if (best && best.learnedFrom !== 'Local') {
        // Resolve egress interface for next-hop
        let outIface = '';
        for (const [ifName, iface] of Object.entries(dev.config.interfaces || {})) {
          if (iface.ip && iface.mask && iface.status === 'up' && areSameSubnet(iface.ip, best.nextHop, iface.mask)) {
            outIface = ifName;
            break;
          }
        }

        routes[dev.id].push({
          prefix: best.prefix,
          mask: best.mask,
          nextHop: best.nextHop,
          outInterface: outIface,
          metric: best.isExternal ? 20 : 200,
        });
      }
    }
  }

  return { peers, rib, routes, evpnTable };
}
