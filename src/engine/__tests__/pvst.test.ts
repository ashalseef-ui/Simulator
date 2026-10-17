import { describe, it, expect, beforeEach } from 'vitest';
import { calculatePvst, getStpPortState } from '../stpEngine';
import { createDevice } from '../deviceSpecs';
import { Device, Link } from '../../types/network';
import { createCliSession, executeCliCommand } from '../cliEngine';

describe('Per-VLAN Spanning Tree (PVST+) & Multi-Instance Engine', () => {
  let sw1: Device;
  let sw2: Device;
  let sw3: Device;
  let links: Link[];

  beforeEach(() => {
    // 3 switches in a triangle loop
    sw1 = createDevice('switch', 'SW1-Core', 100, 100);
    sw2 = createDevice('switch', 'SW2-Dist', 300, 100);
    sw3 = createDevice('switch', 'SW3-Access', 200, 300);

    // Give distinct base MACs
    sw1.config.interfaces['Gi0/1'].mac = '0000.0001.0001';
    sw2.config.interfaces['Gi0/1'].mac = '0000.0002.0002';
    sw3.config.interfaces['Gi0/1'].mac = '0000.0003.0003';

    // Trunk links
    links = [
      { id: 'l1', fromDevice: sw1.id, fromPort: 'Gi0/1', toDevice: sw2.id, toPort: 'Gi0/1', cable: 'crossover' },
      { id: 'l2', fromDevice: sw2.id, fromPort: 'Gi0/2', toDevice: sw3.id, toPort: 'Gi0/1', cable: 'crossover' },
      { id: 'l3', fromDevice: sw3.id, fromPort: 'Gi0/2', toDevice: sw1.id, toPort: 'Gi0/2', cable: 'crossover' },
    ];
  });

  it('elects distinct Root Bridges for different VLANs (PVST+ Active/Active Load Balancing)', () => {
    // SW1 is primary for VLAN 10 (priority 4096)
    // SW2 is primary for VLAN 20 (priority 4096)
    sw1.config.spanningTreeVlanPriority = { 10: 4096, 20: 32768 };
    sw2.config.spanningTreeVlanPriority = { 10: 32768, 20: 4096 };
    sw3.config.spanningTreeVlanPriority = { 10: 32768, 20: 32768 };

    const pvst = calculatePvst([sw1, sw2, sw3], links);

    expect(pvst.vlans).toBeDefined();
    expect(pvst.vlans?.[10]).toBeDefined();
    expect(pvst.vlans?.[20]).toBeDefined();

    // Verify Root Bridge per VLAN
    expect(pvst.vlans?.[10].rootBridgeId).toBe(sw1.id);
    expect(pvst.vlans?.[20].rootBridgeId).toBe(sw2.id);

    // Verify priorities with system-id-ext
    expect(pvst.vlans?.[10].rootBridgePriority).toBe(4096 + 10);
    expect(pvst.vlans?.[20].rootBridgePriority).toBe(4096 + 20);

    // Check port state resolution per VLAN
    const sw1Port1_vlan10 = getStpPortState(pvst, sw1.id, 'Gi0/1', 10);
    const sw1Port1_vlan20 = getStpPortState(pvst, sw1.id, 'Gi0/1', 20);

    expect(sw1Port1_vlan10).toBeDefined();
    expect(sw1Port1_vlan20).toBeDefined();

    // On SW1 (Root for VLAN 10), its ports must be Designated
    expect(sw1Port1_vlan10?.role).toBe('DESG');
    expect(sw1Port1_vlan10?.state).toBe('FWD');
  });

  it('marks PortFast access ports as edge ports in forwarding state', () => {
    const pc = createDevice('pc', 'Workstation', 200, 450);
    const hostLink: Link = {
      id: 'l_pc',
      fromDevice: sw3.id,
      fromPort: 'Fa0/1',
      toDevice: pc.id,
      toPort: 'Fa0/0',
      cable: 'straight',
    };

    sw3.config.interfaces['Fa0/1'].portfast = true;

    const pvst = calculatePvst([sw1, sw2, sw3, pc], [...links, hostLink]);
    const portInfo = getStpPortState(pvst, sw3.id, 'Fa0/1', 1);

    expect(portInfo).toBeDefined();
    expect(portInfo?.edge).toBe(true);
    expect(portInfo?.role).toBe('DESG');
    expect(portInfo?.state).toBe('FWD');
  });

  it('configures and displays Per-VLAN Spanning Tree via IOS-compatible CLI', () => {
    let session = createCliSession();
    const updateConfig = (cfg: any) => {
      sw1.config = cfg;
    };

    session = executeCliCommand('enable', sw1, [sw1, sw2], session, updateConfig, links).newSession;
    session = executeCliCommand('conf t', sw1, [sw1, sw2], session, updateConfig, links).newSession;

    // Configure VLAN 10 priority 4096
    const cmd1 = executeCliCommand('spanning-tree vlan 10 priority 4096', sw1, [sw1, sw2], session, updateConfig, links);
    expect(cmd1.output).toBe('');
    expect(sw1.config.spanningTreeVlanPriority?.[10]).toBe(4096);

    // Configure VLAN 20 root primary
    const cmd2 = executeCliCommand('spanning-tree vlan 20 root primary', sw1, [sw1, sw2], session, updateConfig, links);
    expect(cmd2.output).toBe('');
    expect(sw1.config.spanningTreeVlanPriority?.[20]).toBe(24576);

    // Exit to privileged EXEC mode
    session = executeCliCommand('end', sw1, [sw1, sw2], session, updateConfig, links).newSession;
    expect(session.mode).toBe('priv');

    // Show spanning-tree vlan 10
    const showVlan10 = executeCliCommand('show spanning-tree vlan 10', sw1, [sw1, sw2], session, updateConfig, links);
    expect(showVlan10.output).toContain('VLAN0010');
    expect(showVlan10.output).toContain('sys-id-ext 10');
    expect(showVlan10.output).toContain('Interface');
  });
});
