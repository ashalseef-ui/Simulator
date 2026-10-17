import { Device, Link, MplsLfibEntry } from '../../types/network';
import { areSameSubnet } from '../../utils/ipUtils';

export interface MplsSession {
  localRouterId: string;
  peerRouterId: string;
  peerIp: string;
  localInterface: string;
  state: 'Operational' | 'Non-operational';
}

export interface MplsComputedState {
  ldpSessions: Record<string, MplsSession[]>;
  lfib: Record<string, MplsLfibEntry[]>;
  ingressPeRouters: string[];
  coreRouters: string[];
  egressPeRouters: string[];
}

/**
 * Computes MPLS LDP neighbor relationships, LFIB forwarding table, and label assignments.
 */
export function computeMplsNetworkState(devices: Device[], links: Link[]): MplsComputedState {
  const ldpSessions: Record<string, MplsSession[]> = {};
  const lfib: Record<string, MplsLfibEntry[]> = {};
  const ingressPeRouters: string[] = [];
  const coreRouters: string[] = [];
  const egressPeRouters: string[] = [];

  // Filter devices with MPLS enabled (either mpls.enabled or mpls_cloud or interfaces with mplsEnabled)
  const mplsDevices = (devices || []).filter(
    (d) =>
      d.config?.mpls?.enabled ||
      d.type === 'mpls_cloud' ||
      Object.values(d.config?.interfaces || {}).some((i) => i.mplsEnabled)
  );

  for (const dev of mplsDevices) {
    ldpSessions[dev.id] = [];
    lfib[dev.id] = [];

    // Ensure MPLS config object exists
    if (!dev.config.mpls) {
      dev.config.mpls = {
        enabled: true,
        routerId: Object.values(dev.config.interfaces || {}).find((i) => i.ip)?.ip || '10.255.0.1',
        labelRange: { min: 1000, max: 2000 },
        ldpNeighbors: [],
        lfib: [],
      };
    }
  }

  // 1. Establish LDP Adjacencies across links with MPLS enabled on both ends
  for (const link of links || []) {
    const devA = mplsDevices.find((d) => d.id === link.fromDevice);
    const devB = mplsDevices.find((d) => d.id === link.toDevice);
    if (!devA || !devB) continue;

    const ifA = devA.config.interfaces?.[link.fromPort];
    const ifB = devB.config.interfaces?.[link.toPort];
    if (!ifA || !ifB || ifA.status !== 'up' || ifB.status !== 'up') continue;
    if (!ifA.ip || !ifB.ip) continue;

    const rIdA = devA.config.mpls?.routerId || ifA.ip;
    const rIdB = devB.config.mpls?.routerId || ifB.ip;

    ldpSessions[devA.id].push({
      localRouterId: rIdA,
      peerRouterId: rIdB,
      peerIp: ifB.ip,
      localInterface: link.fromPort,
      state: 'Operational',
    });

    ldpSessions[devB.id].push({
      localRouterId: rIdB,
      peerRouterId: rIdA,
      peerIp: ifA.ip,
      localInterface: link.toPort,
      state: 'Operational',
    });
  }

  // 2. Generate LFIB Tables and Label Allocation (Push, Swap, Pop)
  let baseLabel = 1000;
  for (let i = 0; i < mplsDevices.length; i++) {
    const dev = mplsDevices[i];
    const devSessions = ldpSessions[dev.id] || [];

    // Determine role (PE if it has both MPLS and non-MPLS customer interfaces; P if all interfaces are MPLS)
    const hasCustomerFacing = Object.values(dev.config.interfaces || {}).some(
      (iface) => iface.ip && !iface.mplsEnabled
    );
    if (hasCustomerFacing) {
      ingressPeRouters.push(dev.id);
      egressPeRouters.push(dev.id);
    } else {
      coreRouters.push(dev.id);
    }

    // Allocate LFIB entries for remote destination subnets
    for (const session of devSessions) {
      const neighborDev = mplsDevices.find((d) => d.config.mpls?.routerId === session.peerRouterId);
      if (!neighborDev) continue;

      for (const [, remIf] of Object.entries(neighborDev.config.interfaces || {})) {
        if (!remIf.ip || !remIf.mask || remIf.status !== 'up') continue;

        const inLabel = baseLabel++;
        // PHP (Penultimate Hop Popping): if neighbor is connected to the destination subnet, pop outer label!
        const isConnectedToDest = Object.values(neighborDev.config.interfaces || {}).some(
          (i) => i.ip && i.mask && remIf.ip && remIf.mask && areSameSubnet(i.ip, remIf.ip, i.mask) && !i.mplsEnabled
        );

        const outLabel = isConnectedToDest ? 'Pop' : inLabel + 50;

        const entry: MplsLfibEntry = {
          inLabel,
          outLabel,
          prefix: remIf.ip,
          nextHop: session.peerIp,
          outInterface: session.localInterface,
        };

        lfib[dev.id].push(entry);
      }
    }

    if (dev.config.mpls) {
      dev.config.mpls.lfib = lfib[dev.id];
      dev.config.mpls.ldpNeighbors = devSessions.map((s) => ({
        routerId: s.peerRouterId,
        state: s.state,
        transportIp: s.peerIp,
      }));
    }
  }

  return { ldpSessions, lfib, ingressPeRouters, coreRouters, egressPeRouters };
}
