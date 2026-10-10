import { describe, it, expect } from 'vitest';
import { calculateStp } from '../stpEngine';
import { mk, link } from './helpers';

describe('STP', () => {
  it('blocks exactly one port in a 3-switch triangle and elects the lowest bridge ID as root', () => {
    const a = mk('switch', 'A'), b = mk('switch', 'B'), c = mk('switch', 'C');
    a.config.spanningTreePriority = 4096;
    const links = [link(a, 'Gi0/1', b, 'Gi0/1'), link(b, 'Gi0/2', c, 'Gi0/1'), link(c, 'Gi0/2', a, 'Gi0/2')];
    const s = calculateStp([a, b, c], links, 1);
    expect(s.rootBridgeId).toBe(a.id);
    const blocked = Object.values(s.ports).filter((p) => p.state === 'BLK');
    expect(blocked).toHaveLength(1);
  });

  it('marks host-facing ports on 3560 / Nexus switches as forwarding (regression: they were skipped)', () => {
    const sw = mk('switch3560', 'Core'), pc = mk('pc', 'PC');
    const s = calculateStp([sw, pc], [link(sw, 'Gi0/1', pc, 'Fa0/0')], 1);
    expect(s.ports[`${sw.id}:Gi0/1`]?.state).toBe('FWD');
    const nx = mk('nexus9000', 'N9K');
    const s2 = calculateStp([nx, pc], [link(nx, 'Eth1/1', pc, 'Fa0/0')], 1);
    expect(s2.ports[`${nx.id}:Eth1/1`]?.state).toBe('FWD');
  });

  it('breaks equal-cost root-path ties on lowest upstream bridge ID (deterministic regardless of link order)', () => {
    const mkTopo = (reverse: boolean) => {
      const root = mk('switch', 'Root'), x = mk('switch', 'X'), y = mk('switch', 'Y'), leaf = mk('switch', 'Leaf');
      root.config.spanningTreePriority = 4096;
      x.config.spanningTreePriority = 8192;
      y.config.spanningTreePriority = 12288;
      let links = [link(root, 'Gi0/1', x, 'Gi0/1'), link(root, 'Gi0/2', y, 'Gi0/1'), link(x, 'Gi0/2', leaf, 'Gi0/1'), link(y, 'Gi0/2', leaf, 'Gi0/2')];
      if (reverse) links = links.reverse();
      // Y listed before X so a naive 'first one wins' implementation picks the WRONG upstream
      return { s: calculateStp([root, y, x, leaf], links, 1), leaf };
    };
    const a = mkTopo(false), b = mkTopo(true);
    expect(a.s.ports[`${a.leaf.id}:Gi0/1`].role).toBe('ROOT'); // via X (lower bridge ID)
    expect(b.s.ports[`${b.leaf.id}:Gi0/1`].role).toBe('ROOT');
  });
});
