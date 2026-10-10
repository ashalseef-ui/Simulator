import { describe, it, expect } from 'vitest';
import { computeOspf } from '../ospfEngine';
import { simulatePing, lookupRoute } from '../simulationEngine';
import { threeRouterLine, mk, setIp, link, enableOspf } from './helpers';

describe('OSPF adjacency', () => {
  it('forms FULL adjacencies on a correctly configured line', () => {
    const t = threeRouterLine();
    const o = computeOspf(t.devices, t.links);
    expect(o.neighbors[t.r2.id]).toHaveLength(2);
    expect(o.neighbors[t.r1.id]).toHaveLength(1);
    expect(o.neighbors[t.r1.id][0].state).toMatch(/^FULL\//);
    expect(o.problems).toHaveLength(0);
  });

  it('elects DR by highest router ID when priorities tie, BDR is the other', () => {
    const t = threeRouterLine();
    const o = computeOspf(t.devices, t.links);
    // On the R1-R2 segment R2 (10.0.23.1 / 10.0.12.2 highest iface) vs R1 (192.168.1.1): router IDs are highest interface IPs
    const states = [o.interfaces[t.r1.id], o.interfaces[t.r2.id]].map((l) => l.find((i) => i.name === 'Gi0/0')!.state).sort();
    expect(states).toEqual(['BDR', 'DR']);
  });

  it('priority 0 can never become DR/BDR', () => {
    const t = threeRouterLine();
    t.r1.config.interfaces['Gi0/0'].ospfPriority = 0;
    const o = computeOspf(t.devices, t.links);
    expect(o.interfaces[t.r1.id].find((i) => i.name === 'Gi0/0')!.state).toBe('DROTHER');
  });

  it('does NOT form an adjacency when hello/dead timers differ (the incident-101 case)', () => {
    const t = threeRouterLine();
    t.r2.config.interfaces['Gi0/0'].ospfHelloInterval = 30;
    t.r2.config.interfaces['Gi0/0'].ospfDeadInterval = 120;
    const o = computeOspf(t.devices, t.links);
    expect(o.neighbors[t.r1.id] ?? []).toHaveLength(0);
    expect(o.problems.some((p) => /Hello interval mismatch/.test(p.reason))).toBe(true);
  });

  it('does NOT form an adjacency across mismatched areas', () => {
    const t = threeRouterLine();
    t.r3.config.ospf!.networks[0].area = 1;
    const o = computeOspf(t.devices, t.links);
    expect(o.neighbors[t.r3.id] ?? []).toHaveLength(0);
    expect(o.problems.some((p) => /Area mismatch/.test(p.reason))).toBe(true);
  });

  it('does NOT form an adjacency on a passive interface', () => {
    const t = threeRouterLine();
    t.r1.config.ospf!.passiveInterfaces = ['Gi0/0'];
    const o = computeOspf(t.devices, t.links);
    expect(o.neighbors[t.r1.id] ?? []).toHaveLength(0);
  });

  it('does NOT run OSPF on interfaces missing from a network statement', () => {
    const t = threeRouterLine();
    t.r1.config.ospf!.networks = [{ network: '192.168.1.0', wildcard: '0.0.0.255', area: 0 }];
    const o = computeOspf(t.devices, t.links);
    expect(o.interfaces[t.r1.id].map((i) => i.name)).toEqual(['Gi0/1']);
    expect(o.neighbors[t.r1.id] ?? []).toHaveLength(0);
  });

  it('works across a switch (shared L2 segment) and respects VLANs', () => {
    const r1 = mk('router', 'RA'), r2 = mk('router', 'RB'), sw = mk('switch', 'SW');
    setIp(r1, 'Gi0/0', '10.9.9.1'); setIp(r2, 'Gi0/0', '10.9.9.2');
    enableOspf(r1, [['10.9.9.0', '0.0.0.255', 0]]); enableOspf(r2, [['10.9.9.0', '0.0.0.255', 0]]);
    const links = [link(r1, 'Gi0/0', sw, 'Fa0/1'), link(r2, 'Gi0/0', sw, 'Fa0/2')];
    expect(computeOspf([r1, r2, sw], links).neighbors[r1.id]).toHaveLength(1);
    sw.config.interfaces['Fa0/2'].accessVlan = 20; // split into different VLANs
    expect(computeOspf([r1, r2, sw], links).neighbors[r1.id] ?? []).toHaveLength(0);
  });
});

describe('OSPF SPF routes', () => {
  it('learns remote LANs with additive cost and the right next hop', () => {
    const t = threeRouterLine();
    const o = computeOspf(t.devices, t.links);
    const toLan3 = o.routes[t.r1.id].find((r) => r.network === '192.168.3.0')!;
    expect(toLan3.nextHopIp).toBe('10.0.12.2');
    expect(toLan3.outInterface).toBe('Gi0/0');
    expect(toLan3.cost).toBe(3); // Gi 1 + Gi 1 + LAN 1
  });

  it('does not install connected prefixes as OSPF routes', () => {
    const t = threeRouterLine();
    const o = computeOspf(t.devices, t.links);
    expect(o.routes[t.r1.id].some((r) => r.network === '192.168.1.0')).toBe(false);
  });

  it('removes routes when a link goes down', () => {
    const t = threeRouterLine();
    t.r2.config.interfaces['Gi0/1'].status = 'down';
    const o = computeOspf(t.devices, t.links);
    expect(o.routes[t.r1.id].some((r) => r.network === '192.168.3.0')).toBe(false);
  });
});

describe('route selection', () => {
  it('prefers the longest prefix over a lower AD default route', () => {
    const t = threeRouterLine();
    t.r1.config.routes = [{ network: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.12.2', distance: 1 }];
    const o = computeOspf(t.devices, t.links);
    const best = lookupRoute(t.r1, '192.168.3.10', o.routes[t.r1.id])!;
    expect(best.type).toBe('ospf'); // /24 OSPF beats /0 static even though AD 110 > 1
  });
});

describe('end-to-end ping uses routing, not just wiring', () => {
  it('succeeds when OSPF has converged', () => {
    const t = threeRouterLine();
    expect(simulatePing(t.pc1.id, '192.168.3.10', t.devices, t.links).success).toBe(true);
  });

  it('fails when an adjacency is broken (mismatched hello) - this used to wrongly succeed', () => {
    const t = threeRouterLine();
    t.r2.config.interfaces['Gi0/0'].ospfHelloInterval = 30;
    t.r2.config.interfaces['Gi0/0'].ospfDeadInterval = 120;
    const r = simulatePing(t.pc1.id, '192.168.3.10', t.devices, t.links);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no route|No valid forwarding path/i);
  });

  it('fails when the return route is missing (classic asymmetric config)', () => {
    const t = threeRouterLine();
    // R3 loses OSPF entirely: forward static routes exist, no way back
    t.r3.config.ospf = undefined;
    t.r1.config.routes = [{ network: '192.168.3.0', mask: '255.255.255.0', nextHop: '10.0.12.2' }];
    t.r2.config.routes = [{ network: '192.168.3.0', mask: '255.255.255.0', nextHop: '10.0.23.2' }];
    const r = simulatePing(t.pc1.id, '192.168.3.10', t.devices, t.links);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no route back|return/i);
  });
});
