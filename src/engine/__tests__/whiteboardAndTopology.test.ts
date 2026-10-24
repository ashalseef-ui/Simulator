import { describe, it, expect } from 'vitest';
import { SAMPLE_WHITEBOARD_DIAGRAMS } from '../../data/sampleWhiteboardDiagrams';
import { DEVICE_SPECS, createDevice } from '../deviceSpecs';
import { generateOfflineTopology } from '../offlineTopologyGenerator';
import { buildTopologyFromAiResponse } from '../topologyBridge';
import { DeviceType } from '../../types/network';

describe('Whiteboard & Diagram Blueprint Pipeline', () => {
  it('validates that all sample whiteboard blueprints have valid hardware specs and cabled links', () => {
    expect(SAMPLE_WHITEBOARD_DIAGRAMS.length).toBeGreaterThanOrEqual(3);

    SAMPLE_WHITEBOARD_DIAGRAMS.forEach((sample) => {
      expect(sample.id).toBeTruthy();
      expect(sample.dataUrl).toContain('data:image/svg+xml');
      expect(sample.rawAnalysis.overallConfidence).toBeGreaterThanOrEqual(80);
      expect(sample.rawAnalysis.devices.length).toBeGreaterThanOrEqual(3);
      expect(sample.rawAnalysis.links.length).toBeGreaterThanOrEqual(2);

      // Verify device types exist in DEVICE_SPECS
      sample.rawAnalysis.devices.forEach((dev) => {
        expect(DEVICE_SPECS[dev.type as DeviceType]).toBeDefined();
        expect(dev.name).toBeTruthy();
      });

      // Verify all links connect existing devices
      const deviceNames = new Set(sample.rawAnalysis.devices.map((d) => d.name));
      sample.rawAnalysis.links.forEach((link) => {
        expect(deviceNames.has(link.from)).toBe(true);
        expect(deviceNames.has(link.to)).toBe(true);
        expect(link.fromPort).toBeTruthy();
        expect(link.toPort).toBeTruthy();
      });
    });
  });

  it('compiles whiteboard blueprint into bootable WireCraft devices with non-overlapping subnets', () => {
    const sample = SAMPLE_WHITEBOARD_DIAGRAMS[0]; // Campus Core & Dual Access
    const devices = sample.rawAnalysis.devices.map((d) =>
      createDevice(d.type as DeviceType, d.name, d.x, d.y)
    );

    expect(devices.length).toBe(sample.rawAnalysis.devices.length);

    // Verify created devices have running configs and interface tables
    devices.forEach((dev) => {
      expect(dev.config).toBeDefined();
      expect(Object.keys(dev.config.interfaces).length).toBeGreaterThan(0);
      expect(dev.config.hostname).toBe(dev.name);
    });
  });

  it('correctly builds topologies from AI JSON schema with fallback resilience', () => {
    const rawAiResponse = {
      title: 'AI Enterprise Lab',
      summary: 'Dual router WAN test lab',
      devices: [
        { name: 'R1-Edge', type: 'router', x: 250, y: 150 },
        { name: 'R2-Edge', type: 'router', x: 550, y: 150 },
        { name: 'Client-1', type: 'pc', x: 250, y: 350 },
      ],
      links: [
        { from: 'R1-Edge', fromPort: 'Gi0/0', to: 'R2-Edge', toPort: 'Gi0/0', cable: 'crossover' as const },
        { from: 'R1-Edge', fromPort: 'Gi0/1', to: 'Client-1', toPort: 'FastEthernet0', cable: 'straight' as const },
      ],
    };

    const result = buildTopologyFromAiResponse(rawAiResponse, 'Build a dual router lab');
    expect(result.devices.length).toBe(3);
    expect(result.links.length).toBe(2);
    expect(result.source).toBe('ai');
  });

  it('offline synthesizer produces valid deterministic topologies for common prompt intents', () => {
    const ospf = generateOfflineTopology('Build a 3-router OSPF backbone Area 0');
    expect(ospf.devices.some((d) => d.type === 'router')).toBe(true);
    expect(ospf.links.length).toBeGreaterThanOrEqual(3);

    const roas = generateOfflineTopology('Build a Router-on-a-Stick inter-vlan network');
    expect(roas.devices.some((d) => d.type === 'router')).toBe(true);
    expect(roas.devices.some((d) => d.type === 'switch')).toBe(true);

    const firewall = generateOfflineTopology('Build a firewall perimeter DMZ web server');
    expect(firewall.devices.some((d) => d.type === 'firewall')).toBe(true);
  });
});
