import { Device, DeviceInterface, Link, VxlanConfig } from '../../types/network';
import { areSameSubnet } from '../../utils/ipUtils';

export interface VxlanTunnelState {
  vni: number;
  vlan: number;
  localVtepIp: string;
  remoteVtepIp: string;
  udpPort: number; // 4789
  status: 'Up' | 'Down';
}

/**
 * Computes active VXLAN VTEP tunnels and VNI overlay mappings.
 */
export function computeVxlanState(devices: Device[]): Record<string, VxlanTunnelState[]> {
  const result: Record<string, VxlanTunnelState[]> = {};

  const vxlanDevices = (devices || []).filter((d) => d.config?.vxlan && d.config.vxlan.vniMembers);

  for (const devA of vxlanDevices) {
    result[devA.id] = [];
    const vxlanA = devA.config.vxlan!;
    const sourceIfName = vxlanA.sourceInterface || 'Loopback0';
    const localVtepIp = devA.config.interfaces?.[sourceIfName]?.ip ||
      Object.values(devA.config.interfaces || {}).find((i) => i.ip)?.ip || '10.255.255.1';

    for (const [vniStr, vniInfo] of Object.entries(vxlanA.vniMembers || {})) {
      const vni = Number(vniStr);

      // Check peers from vtepPeers or discover other devices with same VNI
      for (const devB of vxlanDevices) {
        if (devB.id === devA.id) continue;
        const vxlanB = devB.config.vxlan!;
        if (vxlanB.vniMembers?.[vni]) {
          const peerSourceIf = vxlanB.sourceInterface || 'Loopback0';
          const remoteVtepIp = devB.config.interfaces?.[peerSourceIf]?.ip ||
            Object.values(devB.config.interfaces || {}).find((i) => i.ip)?.ip || '10.255.255.2';

          result[devA.id].push({
            vni,
            vlan: vniInfo.vlan,
            localVtepIp,
            remoteVtepIp,
            udpPort: 4789,
            status: 'Up',
          });
        }
      }
    }
  }

  return result;
}

/**
 * Checks if a layer 2 frame belonging to a specific VLAN needs VXLAN overlay encapsulation.
 */
export function matchVxlanOverlay(
  dev: Device,
  vlan: number
): { isVxlan: boolean; vni?: number; localVtepIp?: string; remoteVtepIp?: string } {
  if (!dev.config?.vxlan?.vniMembers) return { isVxlan: false };

  for (const [vniStr, vniInfo] of Object.entries(dev.config.vxlan.vniMembers)) {
    if (vniInfo.vlan === vlan) {
      const vni = Number(vniStr);
      const sourceIfName = dev.config.vxlan.sourceInterface || 'Loopback0';
      const localVtepIp = dev.config.interfaces?.[sourceIfName]?.ip || '10.255.255.1';
      const peer = dev.config.vxlan.vtepPeers?.[0];

      return {
        isVxlan: true,
        vni,
        localVtepIp,
        remoteVtepIp: peer?.ip || '10.255.255.2',
      };
    }
  }

  return { isVxlan: false };
}
