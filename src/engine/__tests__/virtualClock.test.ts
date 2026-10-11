import { describe, it, expect, beforeEach } from 'vitest';
import { DiscreteVirtualClock } from '../virtualClock';
import { workerBridge } from '../workerBridge';
import { createDevice } from '../deviceSpecs';
import { Link } from '../../types/network';

describe('Discrete-Event Simulation (DES) Virtual Clock', () => {
  let clock: DiscreteVirtualClock;

  beforeEach(() => {
    clock = new DiscreteVirtualClock(50); // 50ms per tick
  });

  it('initializes with tick 0 and paused state', () => {
    const snap = clock.getSnapshot();
    expect(snap.currentTick).toBe(0);
    expect(snap.virtualTimeMs).toBe(0);
    expect(snap.formattedTime).toBe('00:00.00');
    expect(snap.paused).toBe(true);
    expect(snap.speedMultiplier).toBe(1);
  });

  it('advances ticks monotonically without drift', () => {
    clock.advanceTicks(20); // 20 ticks * 50ms = 1000ms (1 sec)
    const snap = clock.getSnapshot();
    expect(snap.currentTick).toBe(20);
    expect(snap.virtualTimeMs).toBe(1000);
    expect(snap.formattedTime).toBe('00:01.00');
  });

  it('dispatches priority queue events at the exact scheduled tick', () => {
    const eventLog: string[] = [];

    // Schedule events in non-chronological order
    clock.scheduleEvent('OSPF_HELLO', 200, 'OSPF Hello 200ms', 'R1');
    clock.scheduleEvent('STP_BPDU', 100, 'STP BPDU 100ms', 'SW1');
    clock.scheduleEvent('ARP_AGE', 300, 'ARP Age 300ms', 'PC1');

    expect(clock.getSnapshot().scheduledEventsCount).toBe(3);

    // Advance 1 tick (50ms) -> no events due
    const batch1 = clock.advanceTicks(1);
    expect(batch1.length).toBe(0);

    // Advance 1 more tick (100ms total) -> STP_BPDU due (at tick 2)
    const batch2 = clock.advanceTicks(1);
    expect(batch2.length).toBe(1);
    expect(batch2[0].type).toBe('STP_BPDU');

    // Advance 2 more ticks (200ms total) -> OSPF_HELLO due (at tick 4)
    const batch3 = clock.advanceTicks(2);
    expect(batch3.length).toBe(1);
    expect(batch3[0].type).toBe('OSPF_HELLO');

    // Advance 2 more ticks (300ms total) -> ARP_AGE due (at tick 6)
    const batch4 = clock.advanceTicks(2);
    expect(batch4.length).toBe(1);
    expect(batch4[0].type).toBe('ARP_AGE');

    expect(clock.getSnapshot().scheduledEventsCount).toBe(0);
  });

  it('supports speed multiplier adjustments and reset', () => {
    clock.setSpeed(2);
    expect(clock.getSnapshot().speedMultiplier).toBe(2);

    clock.advanceTicks(10);
    expect(clock.getCurrentTick()).toBe(10);

    clock.reset();
    expect(clock.getCurrentTick()).toBe(0);
    expect(clock.getSnapshot().virtualTimeMs).toBe(0);
  });
});

describe('Simulation Worker Bridge & Decoupled Solver', () => {
  it('solves STP and OSPF topologies asynchronously with latency metrics', async () => {
    const sw1 = createDevice('switch', 'SW1', 200, 200);
    const sw2 = createDevice('switch', 'SW2', 400, 200);
    const links: Link[] = [
      { id: 'l1', fromDevice: sw1.id, fromPort: 'Fa0/1', toDevice: sw2.id, toPort: 'Fa0/1', cable: 'crossover' },
    ];

    const result = await workerBridge.solveTopology([sw1, sw2], links, 1);

    expect(result.stpState).toBeDefined();
    expect(result.ospfState).toBeDefined();
    expect(result.stpState.rootBridgeId).toBeDefined();
    expect(result.computeLatencyMs).toBeGreaterThanOrEqual(0);
    expect(['worker', 'main-thread']).toContain(result.engineMode);
  });

  it('executes ping simulation asynchronously through worker bridge', async () => {
    const pc1 = createDevice('pc', 'PC1', 100, 100);
    const pc2 = createDevice('pc', 'PC2', 300, 100);
    pc1.config.interfaces['Fa0/0'].ip = '192.168.1.10';
    pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
    pc2.config.interfaces['Fa0/0'].ip = '192.168.1.20';
    pc2.config.interfaces['Fa0/0'].mask = '255.255.255.0';

    const links: Link[] = [
      { id: 'l1', fromDevice: pc1.id, fromPort: 'Fa0/0', toDevice: pc2.id, toPort: 'Fa0/0', cable: 'crossover' },
    ];

    const result = await workerBridge.simulatePingAsync(pc1.id, '192.168.1.20', [pc1, pc2], links);

    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.success).toBe(true);
    expect(result.computeLatencyMs).toBeGreaterThanOrEqual(0);
  });
});
