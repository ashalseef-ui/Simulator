import { Device, DeviceInterface, Link } from '../../types/network';
import { areSameSubnet, ipToInt } from '../../utils/ipUtils';

export interface HsrpActiveState {
  group: number;
  virtualIp: string;
  virtualMac: string;
  activeDeviceId: string;
  activeDeviceName: string;
  activeIp: string;
  standbyDeviceId?: string;
  standbyDeviceName?: string;
  standbyIp?: string;
  priority: number;
  helloIntervalSeconds: number;
  holdIntervalSeconds: number;
}

export function generateHsrpVirtualMac(group: number): string {
  const hex = Math.min(255, Math.max(0, group)).toString(16).padStart(2, '0');
  return `0000.0c07.ac${hex}`;
}

/**
 * Computes HSRP state across all devices participating in First Hop Redundancy.
 * Assigns Active and Standby roles, preemption, and virtual MAC mapping.
 */
export function computeHsrpNetworkState(devices: Device[], links: Link[]): {
  groups: Record<string, HsrpActiveState>; // key: `${subnet}:${group}`
  deviceStates: Record<string, Record<number, 'Active' | 'Standby' | 'Listen'>>; // deviceId -> group -> state
} {
  const groups: Record<string, HsrpActiveState> = {};
  const deviceStates: Record<string, Record<number, 'Active' | 'Standby' | 'Listen'>> = {};

  // 1. Collect all interfaces configured with HSRP
  interface HsrpCandidate {
    device: Device;
    interfaceName: string;
    iface: DeviceInterface;
    group: number;
    virtualIp: string;
    priority: number;
    preempt: boolean;
  }

  const candidates: HsrpCandidate[] = [];

  for (const dev of devices || []) {
    deviceStates[dev.id] = {};
    for (const [ifName, iface] of Object.entries(dev.config?.interfaces || {})) {
      if (iface && iface.hsrp && iface.hsrp.group > 0 && iface.hsrp.virtualIp && iface.status === 'up') {
        candidates.push({
          device: dev,
          interfaceName: ifName,
          iface,
          group: iface.hsrp.group,
          virtualIp: iface.hsrp.virtualIp,
          priority: iface.hsrp.priority ?? 100,
          preempt: iface.hsrp.preempt ?? false,
        });
      }
    }
  }

  // 2. Group candidates by Virtual IP & Group number
  const clustered: Record<string, HsrpCandidate[]> = {};
  for (const c of candidates) {
    const key = `${c.virtualIp}:grp${c.group}`;
    if (!clustered[key]) clustered[key] = [];
    clustered[key].push(c);
  }

  // 3. Elect Active and Standby for each group
  for (const [key, cluster] of Object.entries(clustered)) {
    // Sort candidates:
    // Highest priority wins; on tie, highest physical interface IP wins
    cluster.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return ipToInt(b.iface.ip || '0.0.0.0') - ipToInt(a.iface.ip || '0.0.0.0');
    });

    const activeCand = cluster[0];
    const standbyCand = cluster[1];

    const groupNum = activeCand.group;
    const vMac = generateHsrpVirtualMac(groupNum);

    groups[key] = {
      group: groupNum,
      virtualIp: activeCand.virtualIp,
      virtualMac: vMac,
      activeDeviceId: activeCand.device.id,
      activeDeviceName: activeCand.device.name,
      activeIp: activeCand.iface.ip || '',
      standbyDeviceId: standbyCand?.device.id,
      standbyDeviceName: standbyCand?.device.name,
      standbyIp: standbyCand?.iface.ip,
      priority: activeCand.priority,
      helloIntervalSeconds: 3,
      holdIntervalSeconds: 10,
    };

    // Update states on devices
    for (let i = 0; i < cluster.length; i++) {
      const cand = cluster[i];
      let state: 'Active' | 'Standby' | 'Listen' = 'Listen';
      if (i === 0) state = 'Active';
      else if (i === 1) state = 'Standby';

      deviceStates[cand.device.id][cand.group] = state;
      // Mutate live interface hsrp state for display
      if (cand.iface.hsrp) {
        cand.iface.hsrp.state = state;
      }
    }
  }

  return { groups, deviceStates };
}

/**
 * Checks if a given destination IP is a configured HSRP Virtual IP.
 * Returns the currently Active Device and interface handling that VIP.
 */
export function resolveHsrpGateway(
  virtualIp: string,
  devices: Device[]
): { activeDevice: Device; interfaceName: string; virtualMac: string } | null {
  for (const dev of devices || []) {
    for (const [ifName, iface] of Object.entries(dev.config?.interfaces || {})) {
      if (iface?.hsrp?.virtualIp === virtualIp && iface.status === 'up' && iface.hsrp.state === 'Active') {
        return {
          activeDevice: dev,
          interfaceName: ifName,
          virtualMac: generateHsrpVirtualMac(iface.hsrp.group),
        };
      }
    }
  }
  return null;
}
