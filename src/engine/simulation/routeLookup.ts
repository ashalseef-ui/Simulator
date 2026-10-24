import { Device, AccessList } from '../../types/network';
import { areSameSubnet, ipToInt, safeCidr } from '../../utils/ipUtils';
import { OspfRoute, OSPF_AD, isOspfCapable } from '../ospfEngine';
import { IsisRoute } from '../protocols/isisEngine';
import { EigrpComputedRoute } from '../protocols/eigrpEngine';

export interface RouteMatch {
  type: 'connected' | 'static' | 'ospf' | 'eigrp' | 'rip' | 'bgp' | 'isis' | 'default';
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

export const wildcardToPrefixLen = (wildcard: string): number => {
  const mask = (~ipToInt(wildcard)) >>> 0;
  let n = 0;
  for (let i = 31; i >= 0 && (mask >>> i) & 1; i--) n++;
  return n;
};

// Helper to evaluate ACL against an ICMP/IP packet
export function checkAcl(
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

export const isRoutedForwarder = (d: Device): boolean =>
  d.type.startsWith('router') ||
  d.type === 'firewall' ||
  d.type === 'firepower' ||
  (d.type === 'l3switch' && !!d.config.ipRoutingEnabled) ||
  (isOspfCapable(d) && d.type !== 'switch');

export const isVirtualIface = (n: string) => /^vlan\d+$/i.test(n) || /^loopback/i.test(n);

// Helper to look up best route on router or L3 switch.
// Order of selection follows real routers: longest prefix match, then lowest AD, then lowest cost.
export function lookupRoute(
  dev: Device,
  dstIp: string,
  ospfRoutes: OspfRoute[] = [],
  isisRoutes: IsisRoute[] = [],
  eigrpRoutes: EigrpComputedRoute[] = []
): RouteMatch | null {
  // 1. Strict boundary validation
  if (!dev || !dev.config || !dev.config.interfaces || !dstIp || typeof dstIp !== 'string') {
    return null;
  }

  const candidates: RouteMatch[] = [];

  // 1. Directly connected interfaces and sub-interfaces
  for (const [ifName, iface] of Object.entries(dev.config.interfaces)) {
    if (iface && iface.ip && iface.mask && iface.status === 'up') {
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

  // 2. Static routes (nullish coalescing fallback)
  for (const r of dev.config.routes ?? []) {
    if (r && r.mask && (safeCidr(r.mask) === 0 || areSameSubnet(r.network, dstIp, r.mask))) {
      candidates.push({
        type: safeCidr(r.mask) === 0 ? 'default' : 'static',
        outInterface: r.interface || '',
        nextHopIp: r.nextHop,
        metric: r.distance ?? 1,
        prefixLen: safeCidr(r.mask),
      });
    }
  }

  // 3. OSPF routes: produced by the OSPF engine from real adjacencies + SPF (AD 110)
  for (const r of ospfRoutes ?? []) {
    if (r && r.mask && areSameSubnet(r.network, dstIp, r.mask)) {
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

  // 4. IS-IS routes (AD 115)
  for (const r of isisRoutes ?? []) {
    if (r && r.mask && areSameSubnet(r.prefix, dstIp, r.mask)) {
      candidates.push({
        type: 'isis',
        outInterface: r.outInterface,
        nextHopIp: r.nextHop,
        metric: 115,
        prefixLen: safeCidr(r.mask),
        cost: r.metric,
      });
    }
  }

  // 5. EIGRP computed routes from DUAL state machine (AD 90 for internal, 170 for external)
  for (const r of eigrpRoutes ?? []) {
    if (r && r.mask && areSameSubnet(r.prefix, dstIp, r.mask)) {
      candidates.push({
        type: 'eigrp',
        outInterface: r.outInterface,
        nextHopIp: r.nextHop,
        metric: r.isExternal ? 170 : 90,
        prefixLen: safeCidr(r.mask),
        cost: r.metric,
      });
    }
  }

  // 6. EIGRP network statements fallback
  for (const net of dev.config.eigrp?.networks ?? []) {
    if (net && net.wildcard && net.network) {
      const care = (~ipToInt(net.wildcard)) >>> 0;
      if (((ipToInt(dstIp) & care) >>> 0) === ((ipToInt(net.network) & care) >>> 0)) {
        candidates.push({ type: 'eigrp', outInterface: '', nextHopIp: dstIp, metric: 90, prefixLen: wildcardToPrefixLen(net.wildcard) });
      }
    }
  }
  for (const net of dev.config.rip?.networks ?? []) {
    if (net && areSameSubnet(net, dstIp, '255.255.255.0')) {
      candidates.push({ type: 'rip', outInterface: '', nextHopIp: dstIp, metric: 120, prefixLen: 24 });
    }
  }
  for (const net of dev.config.bgp?.networks ?? []) {
    if (net && net.network && net.mask && areSameSubnet(net.network, dstIp, net.mask)) {
      const neighbor = dev.config.bgp?.neighbors?.[0];
      const isInternal = neighbor?.remoteAs === dev.config.bgp?.asn;
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

  // Recursive lookup: resolve egress interface from next hop with loop-detected 3-hop limit
  if (!best.outInterface && best.nextHopIp) {
    let currentNextHop: string | undefined = best.nextHopIp;
    const visitedNextHops = new Set<string>([dstIp]);
    let hops = 0;

    while (currentNextHop && hops < 3 && !visitedNextHops.has(currentNextHop)) {
      visitedNextHops.add(currentNextHop);
      hops++;

      // Check directly attached subnets first
      let resolvedInterface: string | undefined;
      for (const [ifName, iface] of Object.entries(dev.config.interfaces)) {
        if (iface.ip && iface.mask && iface.status === 'up' && areSameSubnet(iface.ip, currentNextHop, iface.mask)) {
          resolvedInterface = ifName;
          break;
        }
      }

      if (resolvedInterface) {
        best.outInterface = resolvedInterface.split('.')[0];
        if (resolvedInterface.includes('.')) best.subInterface = resolvedInterface;
        break;
      }

      // Check static routes for intermediate next hop recursion
      const intermediateCandidates: Array<{ prefixLen: number; metric: number; outInterface?: string; nextHopIp?: string }> = [];
      for (const r of dev.config.routes ?? []) {
        if (r && r.mask && (safeCidr(r.mask) === 0 || areSameSubnet(r.network, currentNextHop, r.mask))) {
          const prefixLen = safeCidr(r.mask);
          if (r.nextHop) {
            intermediateCandidates.push({
              prefixLen,
              metric: r.distance ?? 1,
              nextHopIp: r.nextHop,
            });
          } else if (r.interface) {
            intermediateCandidates.push({
              prefixLen,
              metric: r.distance ?? 1,
              outInterface: r.interface,
            });
          }
        }
      }

      if (intermediateCandidates.length === 0) break;
      intermediateCandidates.sort((a, b) => b.prefixLen - a.prefixLen || a.metric - b.metric);
      const intermediate = intermediateCandidates[0];
      if (intermediate.outInterface) {
        best.outInterface = intermediate.outInterface.split('.')[0];
        if (intermediate.outInterface.includes('.')) best.subInterface = intermediate.outInterface;
        break;
      }
      currentNextHop = intermediate.nextHopIp;
    }
  }

  return best;
}
