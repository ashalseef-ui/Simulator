import { describe, it, expect } from 'vitest';
import { matchDevice, LAB_SCENARIOS } from '../../data/labs';
import { createDevice } from '../deviceSpecs';

describe('Lab Grader Decoupling & matchDevice Resilience', () => {
  it('matches devices case-insensitively by name, hostname, and id', () => {
    const r1 = createDevice('router', 'R1', 100, 100);
    r1.config.hostname = 'Router-Edge';

    const devices = [r1];

    expect(matchDevice(devices, { name: 'r1' })).toBe(r1);
    expect(matchDevice(devices, { name: 'R1' })).toBe(r1);
    expect(matchDevice(devices, { hostname: 'router-edge' })).toBe(r1);
    expect(matchDevice(devices, { name: 'Router-Edge' })).toBe(r1);
    expect(matchDevice(devices, { name: r1.id })).toBe(r1);
  });

  it('falls back to device type when custom name is used', () => {
    const sw = createDevice('switch', 'Core-Access-Switch', 100, 100);
    const devices = [sw];

    const found = matchDevice(devices, { name: 'Switch0', type: 'switch' });
    expect(found).toBe(sw);
  });

  it('validates Lab 1 (LAN & ARP Fundamentals) when IP is correctly configured', () => {
    const lab = LAB_SCENARIOS.find((l) => l.id === 'lab-1-arp-fundamentals')!;
    const topo = lab.initialTopology();

    // Before configuration
    let result = lab.validate(topo.devices, topo.links);
    expect(result.passed).toBe(false);

    // Apply configuration
    const pc0 = topo.devices.find((d) => d.name === 'PC0')!;
    const pc1 = topo.devices.find((d) => d.name === 'PC1')!;
    pc0.config.interfaces['Fa0/0'].ip = '192.168.1.10';
    pc0.config.interfaces['Fa0/0'].mask = '255.255.255.0';
    pc1.config.interfaces['Fa0/0'].ip = '192.168.1.20';
    pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';

    result = lab.validate(topo.devices, topo.links);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('validates multi-vendor lab even if hostname case varies', () => {
    const lab = LAB_SCENARIOS.find((l) => l.id === 'lab-10-universal-multivendor')!;
    const topo = lab.initialTopology();

    const cisco = topo.devices.find((d) => d.name === 'R1-Cisco')!;
    const juniper = topo.devices.find((d) => d.name === 'vSRX-Juniper')!;

    cisco.config.interfaces['Gi0/0'].ip = '10.0.1.1';
    cisco.config.interfaces['Gi0/0'].status = 'up';

    juniper.config.interfaces['ge-0/0/0'].ip = '10.0.1.2';
    juniper.config.interfaces['ge-0/0/0'].status = 'up';

    const result = lab.validate(topo.devices, topo.links);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });
});
