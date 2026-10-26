import { Device, Link } from '../types/network';

export type TrafficType = 'web' | 'dns' | 'voip' | 'video' | 'icmp';

export interface TrafficProfileConfig {
  web: boolean;
  dns: boolean;
  voip: boolean;
  video: boolean;
  icmp: boolean;
}

export interface LinkMetrics {
  linkId: string;
  mbps: number;
  capacityMbps: number;
  utilizationPercent: number; // 0 to 100+
  status: 'healthy' | 'high_load' | 'congested';
  packetLossRate: number; // 0 to 1.0
  totalDrops: number;
  activeFlowCount: number;
}

export interface AnimatedParticle {
  id: string;
  linkId: string;
  type: TrafficType;
  color: string;
  fromDeviceId: string;
  toDeviceId: string;
  direction: 'forward' | 'reverse';
  progress: number; // 0 to 100
  speed: number;
}

export interface ChaosFault {
  id: string;
  timestamp: string;
  type: 'fiber_cut' | 'mtu_mismatch' | 'crc_error' | 'ospf_flap';
  targetId: string;
  targetName: string;
  description: string;
  resolved: boolean;
}

export interface LivingNetworkState {
  enabled: boolean;
  trafficProfiles: TrafficProfileConfig;
  chaosLevel: number; // 0 (Off) to 100 (Max)
  totalThroughputMbps: number;
  totalActiveFlows: number;
  totalDropCount: number;
  linkMetrics: Record<string, LinkMetrics>;
  activeParticles: AnimatedParticle[];
  chaosFaults: ChaosFault[];
  lastChaosNotice?: string;
}

const TRAFFIC_BANDWIDTH: Record<TrafficType, number> = {
  dns: 0.2, // Mbps
  icmp: 0.5,
  web: 2.5,
  voip: 5.0,
  video: 25.0,
};

const TRAFFIC_COLORS: Record<TrafficType, string> = {
  web: '#06b6d4', // cyan
  dns: '#f59e0b', // amber
  voip: '#10b981', // emerald
  video: '#a855f7', // purple
  icmp: '#3b82f6', // blue
};

function findShortestGraphPath(srcDevId: string, dstDevId: string, devices: Device[], links: Link[]): string[] {
  const activeLinks = links.filter((l) => {
    const devA = devices.find((d) => d.id === l.fromDevice);
    const devB = devices.find((d) => d.id === l.toDevice);
    if (!devA || !devB) return false;
    const ifA = devA.config.interfaces[l.fromPort];
    const ifB = devB.config.interfaces[l.toPort];
    return ifA?.status !== 'down' && ifB?.status !== 'down';
  });

  const queue: { devId: string; path: string[] }[] = [{ devId: srcDevId, path: [srcDevId] }];
  const visited = new Set<string>([srcDevId]);

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const { devId, path } = item;
    if (devId === dstDevId) return path;

    for (const link of activeLinks) {
      const neighborId = link.fromDevice === devId ? link.toDevice : link.toDevice === devId ? link.fromDevice : null;
      if (neighborId && !visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ devId: neighborId, path: [...path, neighborId] });
      }
    }
  }

  return [];
}

export class LivingNetworkEngine {
  private state: LivingNetworkState = {
    enabled: false,
    trafficProfiles: {
      web: true,
      dns: true,
      voip: true,
      video: false,
      icmp: true,
    },
    chaosLevel: 0,
    totalThroughputMbps: 0,
    totalActiveFlows: 0,
    totalDropCount: 0,
    linkMetrics: {},
    activeParticles: [],
    chaosFaults: [],
  };

  private particleCounter = 0;

  public getState(): LivingNetworkState {
    return this.state;
  }

  public setEnabled(enabled: boolean) {
    this.state.enabled = enabled;
    if (!enabled) {
      this.state.activeParticles = [];
      this.state.linkMetrics = {};
      this.state.totalThroughputMbps = 0;
      this.state.totalActiveFlows = 0;
    }
  }

  public setTrafficProfile(key: keyof TrafficProfileConfig, active: boolean) {
    this.state.trafficProfiles[key] = active;
  }

  public setChaosLevel(level: number) {
    this.state.chaosLevel = Math.max(0, Math.min(100, level));
  }

  public clearChaosFaults() {
    this.state.chaosFaults = [];
    this.state.lastChaosNotice = undefined;
  }

  /**
   * Main simulation tick invoked periodically (e.g., every 800ms)
   */
  public updateSimulation(
    devices: Device[],
    links: Link[],
    onChaosMutate?: (action: 'shutdown_iface' | 'set_mtu' | 'flap_ospf', targetDevId: string, param?: any) => void
  ): LivingNetworkState {
    if (!this.state.enabled || devices.length < 2 || links.length === 0) {
      this.state.totalThroughputMbps = 0;
      this.state.totalActiveFlows = 0;
      return this.state;
    }

    // 1. Identify active traffic pairs across topology
    const hostDevices = devices.filter(
      (d) => d.type === 'pc' || d.type === 'laptop' || d.type === 'server' || d.type === 'ipphone' || d.type === 'iot_sensor'
    );
    const serverOrRouterDevices = devices.filter(
      (d) => d.type === 'server' || d.type === 'router' || d.type === 'firewall' || d.type === 'l3switch' || d.type === 'cloud'
    );

    const activeProfiles = (Object.keys(this.state.trafficProfiles) as TrafficType[]).filter(
      (k) => this.state.trafficProfiles[k]
    );

    const linkUsageMbps: Record<string, number> = {};
    const linkFlowCounts: Record<string, number> = {};
    const linkDropCounts: Record<string, number> = {};
    const newParticles: AnimatedParticle[] = [];

    links.forEach((l) => {
      linkUsageMbps[l.id] = 0;
      linkFlowCounts[l.id] = 0;
      linkDropCounts[l.id] = this.state.linkMetrics[l.id]?.totalDrops || 0;
    });

    let totalMbps = 0;
    let totalFlows = 0;

    // Simulate flows from hosts
    if (hostDevices.length > 0 && activeProfiles.length > 0 && serverOrRouterDevices.length > 0) {
      const maxSimulatedFlows = Math.min(12, hostDevices.length * 2);

      for (let i = 0; i < maxSimulatedFlows; i++) {
        const srcHost = hostDevices[i % hostDevices.length];
        const dstTarget = serverOrRouterDevices[(i + 1) % serverOrRouterDevices.length];
        if (srcHost.id === dstTarget.id) continue;

        const trafficType = activeProfiles[i % activeProfiles.length];
        const flowBandwidth = TRAFFIC_BANDWIDTH[trafficType] || 1.0;

        // Trace shortest graph path across topology
        const path = findShortestGraphPath(srcHost.id, dstTarget.id, devices, links);

        if (path.length > 1) {
          totalFlows++;
          totalMbps += flowBandwidth;

          // Accrue bandwidth on traversed links
          for (let p = 0; p < path.length - 1; p++) {
            const currentDevId = path[p];
            const nextDevId = path[p + 1];

            const traversedLink = links.find(
              (l) =>
                (l.fromDevice === currentDevId && l.toDevice === nextDevId) ||
                (l.fromDevice === nextDevId && l.toDevice === currentDevId)
            );

            if (traversedLink) {
              linkUsageMbps[traversedLink.id] = (linkUsageMbps[traversedLink.id] || 0) + flowBandwidth;
              linkFlowCounts[traversedLink.id] = (linkFlowCounts[traversedLink.id] || 0) + 1;

              // Spawn animated particle along cable
              this.particleCounter++;
              newParticles.push({
                id: `p_${this.particleCounter}_${Date.now()}`,
                linkId: traversedLink.id,
                type: trafficType,
                color: TRAFFIC_COLORS[trafficType],
                fromDeviceId: currentDevId,
                toDeviceId: nextDevId,
                direction: traversedLink.fromDevice === currentDevId ? 'forward' : 'reverse',
                progress: Math.floor(Math.random() * 80),
                speed: trafficType === 'video' ? 1.5 : trafficType === 'voip' ? 1.2 : 0.9,
              });
            }
          }
        }
      }
    }

    // 2. Compute Link Metrics (utilization, congestion, drops)
    const updatedMetrics: Record<string, LinkMetrics> = {};

    links.forEach((l) => {
      // Determine link capacity based on cable type (e.g. 10Mbps serial, 100Mbps Ethernet, 1Gbps Fiber/DAC)
      let capacityMbps = 100.0;
      if (l.cable === 'serial' || l.cable === 'serial_dte' || l.cable === 'phone') {
        capacityMbps = 10.0;
      } else if (l.cable === 'fiber' || l.cable === 'dac') {
        capacityMbps = 1000.0;
      }

      // Add baseline load for realism
      const currentMbps = (linkUsageMbps[l.id] || 0) + (activeProfiles.length > 0 ? 2.5 : 0);
      const util = Math.min(100, Math.round((currentMbps / capacityMbps) * 100));

      let status: 'healthy' | 'high_load' | 'congested' = 'healthy';
      if (util >= 80) {
        status = 'congested';
      } else if (util >= 45) {
        status = 'high_load';
      }

      // Calculate drops if congested or under chaos CRC
      let lossRate = 0;
      if (util >= 85) {
        lossRate = (util - 80) / 100;
        linkDropCounts[l.id] = (linkDropCounts[l.id] || 0) + Math.floor(Math.random() * 3) + 1;
      }

      updatedMetrics[l.id] = {
        linkId: l.id,
        mbps: Number(currentMbps.toFixed(1)),
        capacityMbps,
        utilizationPercent: util,
        status,
        packetLossRate: lossRate,
        totalDrops: linkDropCounts[l.id] || 0,
        activeFlowCount: linkFlowCounts[l.id] || 0,
      };
    });

    // Sum overall drop count
    const totalDrops = Object.values(linkDropCounts).reduce((a, b) => a + b, 0);

    // 3. Chaos Monkey Engine execution
    if (this.state.chaosLevel > 0 && Math.random() < this.state.chaosLevel / 200 && onChaosMutate) {
      this.triggerChaosEvent(devices, links, onChaosMutate);
    }

    this.state = {
      ...this.state,
      totalThroughputMbps: Number(totalMbps.toFixed(1)),
      totalActiveFlows: totalFlows,
      totalDropCount: totalDrops,
      linkMetrics: updatedMetrics,
      activeParticles: newParticles,
    };

    return this.state;
  }

  /**
   * Randomly injects a fault based on Chaos Monkey setting
   */

  public triggerChaosEvent(
    devices: Device[],
    links: Link[],
    onChaosMutate: (action: 'shutdown_iface' | 'set_mtu' | 'flap_ospf', targetDevId: string, param?: any) => void
  ) {
    if (devices.length === 0) return;

    const activeDevices = devices.filter((d) => d.type !== 'cloud' && d.type !== 'mpls_cloud');
    if (activeDevices.length === 0) return;

    const targetDev = activeDevices[Math.floor(Math.random() * activeDevices.length)];
    const ifaceNames = Object.keys(targetDev.config.interfaces || {});
    if (ifaceNames.length === 0) return;

    const targetIfaceName = ifaceNames[Math.floor(Math.random() * ifaceNames.length)];
    const chaosTypes: ('fiber_cut' | 'mtu_mismatch' | 'crc_error' | 'ospf_flap')[] = [
      'fiber_cut',
      'mtu_mismatch',
      'crc_error',
      'ospf_flap',
    ];
    const pickedChaos = chaosTypes[Math.floor(Math.random() * chaosTypes.length)];
    const now = new Date().toLocaleTimeString();

    let desc = '';

    if (pickedChaos === 'fiber_cut') {
      desc = `Chaos Monkey administratively shut down port ${targetIfaceName} on ${targetDev.name}!`;
      onChaosMutate('shutdown_iface', targetDev.id, { interfaceName: targetIfaceName });
    } else if (pickedChaos === 'mtu_mismatch') {
      desc = `Chaos Monkey injected MTU mismatch (MTU 1400) on ${targetIfaceName} (${targetDev.name})!`;
      onChaosMutate('set_mtu', targetDev.id, { interfaceName: targetIfaceName, mtu: 1400 });
    } else if (pickedChaos === 'crc_error') {
      desc = `Chaos Monkey induced high CRC framing error rate on ${targetIfaceName} (${targetDev.name})!`;
    } else {
      desc = `Chaos Monkey flapped OSPF routing process on ${targetDev.name}!`;
      onChaosMutate('flap_ospf', targetDev.id);
    }

    const faultRecord: ChaosFault = {
      id: `chaos_${Date.now()}`,
      timestamp: now,
      type: pickedChaos,
      targetId: targetDev.id,
      targetName: targetDev.name,
      description: desc,
      resolved: false,
    };

    this.state.chaosFaults = [faultRecord, ...this.state.chaosFaults].slice(0, 15);
    this.state.lastChaosNotice = desc;
  }
}

export const livingNetworkEngine = new LivingNetworkEngine();
