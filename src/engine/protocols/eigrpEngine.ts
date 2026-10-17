import { Device, DeviceInterface, Link } from '../../types/network';
import { areSameSubnet, ipToInt } from '../../utils/ipUtils';

export interface EigrpNeighborState {
  neighborId: string;
  neighborIp: string;
  localInterface: string;
  holdTime: number;
  uptime: number;
  srtt: number;
  rto: number;
}

export interface EigrpTopologyEntry {
  prefix: string;
  mask: string;
  feasibleDistance: number;
  reportedDistance: number;
  successor: {
    nextHop: string;
    outInterface: string;
    neighborId: string;
  };
  feasibleSuccessors: {
    nextHop: string;
    outInterface: string;
    neighborId: string;
    reportedDistance: number;
    metric: number;
  }[];
  isFeasibleSuccessorAvailable: boolean;
}

export interface EigrpComputedRoute {
  prefix: string;
  mask: string;
  nextHop: string;
  outInterface: string;
  metric: number;
  asNumber: number;
  isExternal?: boolean;
}

/**
 * Calculates EIGRP classic composite metric:
 * Metric = 256 * ( 10^7 / min_bandwidth_kbps + sum_delay_tens_of_microseconds )
 */
export function calculateEigrpMetric(bandwidthKbps: number, delayTensOfMicroseconds: number): number {
  const safeBw = Math.max(1, bandwidthKbps);
  const bwTerm = Math.floor(10000000 / safeBw);
  return 256 * (bwTerm + Math.max(1, delayTensOfMicroseconds));
}

/**
 * Resolves whether an interface matches configured EIGRP network statements.
 */
function isInterfaceInEigrp(iface: DeviceInterface, networks: { network: string; wildcard: string }[]): boolean {
  if (!iface.ip || !iface.mask || iface.status !== 'up') return false;
  const ifIpInt = ipToInt(iface.ip);

  for (const n of networks) {
    if (!n.network || !n.wildcard) continue;
    const netInt = ipToInt(n.network);
    const wcInt = ipToInt(n.wildcard);
    const careBits = (~wcInt) >>> 0;
    if (((ifIpInt & careBits) >>> 0) === ((netInt & careBits) >>> 0)) {
      return true;
    }
  }
  return false;
}

/**
 * Computes EIGRP adjacencies, DUAL topology table, successors, and active routing table for all devices.
 */
export function computeEigrpNetworkState(devices: Device[], links: Link[]): {
  neighbors: Record<string, EigrpNeighborState[]>;
  topologyTables: Record<string, EigrpTopologyEntry[]>;
  routes: Record<string, EigrpComputedRoute[]>;
} {
  const neighbors: Record<string, EigrpNeighborState[]> = {};
  const topologyTables: Record<string, EigrpTopologyEntry[]> = {};
  const routes: Record<string, EigrpComputedRoute[]> = {};

  const eigrpDevices = (devices || []).filter((d) => d?.config?.eigrp && d.config.eigrp.asNumber > 0);

  // 1. Initialize result records
  for (const dev of eigrpDevices) {
    neighbors[dev.id] = [];
    topologyTables[dev.id] = [];
    routes[dev.id] = [];
  }

  // 2. Discover EIGRP neighbors across shared connected links in the same AS and same subnet
  for (const link of links || []) {
    const devA = eigrpDevices.find((d) => d.id === link.fromDevice);
    const devB = eigrpDevices.find((d) => d.id === link.toDevice);
    if (!devA || !devB) continue;

    const asA = devA.config.eigrp?.asNumber;
    const asB = devB.config.eigrp?.asNumber;
    if (!asA || !asB || asA !== asB) continue; // Must match Autonomous System

    const ifA = devA.config.interfaces?.[link.fromPort];
    const ifB = devB.config.interfaces?.[link.toPort];
    if (!ifA || !ifB || ifA.status !== 'up' || ifB.status !== 'up') continue;
    if (!ifA.ip || !ifB.ip || !ifA.mask || !ifB.mask) continue;

    // Both interfaces must be included in EIGRP network statements
    const matchA = isInterfaceInEigrp(ifA, devA.config.eigrp?.networks ?? []);
    const matchB = isInterfaceInEigrp(ifB, devB.config.eigrp?.networks ?? []);
    if (!matchA || !matchB) continue;

    // Must be in the same IP subnet
    if (!areSameSubnet(ifA.ip, ifB.ip, ifA.mask)) continue;

    // Form reciprocal adjacency
    neighbors[devA.id].push({
      neighborId: devB.id,
      neighborIp: ifB.ip,
      localInterface: link.fromPort,
      holdTime: 15,
      uptime: 300,
      srtt: 12,
      rto: 200,
    });
    neighbors[devB.id].push({
      neighborId: devA.id,
      neighborIp: ifA.ip,
      localInterface: link.toPort,
      holdTime: 15,
      uptime: 300,
      srtt: 14,
      rto: 200,
    });
  }

  // 3. Populate DUAL Topology and Compute Successors / Feasible Successors
  for (const dev of eigrpDevices) {
    const asNum = dev.config.eigrp!.asNumber;
    const devNeighbors = neighbors[dev.id] || [];

    // Collect all candidate routes learned from neighbors
    for (const nei of devNeighbors) {
      const remoteDev = eigrpDevices.find((d) => d.id === nei.neighborId);
      if (!remoteDev) continue;

      // Remote device advertises its connected interfaces in EIGRP
      for (const [, remIf] of Object.entries(remoteDev.config.interfaces || {})) {
        if (!remIf.ip || !remIf.mask || remIf.status !== 'up') continue;
        if (!isInterfaceInEigrp(remIf, remoteDev.config.eigrp?.networks ?? [])) continue;

        // Skip if local device already has this subnet connected directly
        const alreadyLocal = Object.values(dev.config.interfaces || {}).some(
          (locIf) => locIf.ip && locIf.mask && remIf.ip && remIf.mask && areSameSubnet(locIf.ip, remIf.ip, locIf.mask)
        );
        if (alreadyLocal) continue;

        // Calculate link metric
        const linkSpeed = dev.config.interfaces[nei.localInterface]?.speed || 1000;
        const bwKbps = linkSpeed * 1000;
        const hopMetric = calculateEigrpMetric(bwKbps, 100);

        // Remote device's reported distance (metric to reach destination from neighbor)
        const reportedDistance = calculateEigrpMetric(1000000, 10);
        const totalMetric = reportedDistance + hopMetric;

        // Check if prefix already exists in topology table
        const existing = topologyTables[dev.id].find((t) => t.prefix === remIf.ip && t.mask === remIf.mask);

        if (!existing) {
          topologyTables[dev.id].push({
            prefix: remIf.ip,
            mask: remIf.mask,
            feasibleDistance: totalMetric,
            reportedDistance,
            successor: {
              nextHop: nei.neighborIp,
              outInterface: nei.localInterface,
              neighborId: nei.neighborId,
            },
            feasibleSuccessors: [],
            isFeasibleSuccessorAvailable: false,
          });
        } else {
          // DUAL Feasibility Condition: Reported Distance must be strictly less than current Feasible Distance
          if (reportedDistance < existing.feasibleDistance) {
            existing.feasibleSuccessors.push({
              nextHop: nei.neighborIp,
              outInterface: nei.localInterface,
              neighborId: nei.neighborId,
              reportedDistance,
              metric: totalMetric,
            });
            existing.isFeasibleSuccessorAvailable = true;
          }

          // If this path is cheaper than existing successor, promote it
          if (totalMetric < existing.feasibleDistance) {
            existing.feasibleDistance = totalMetric;
            existing.successor = {
              nextHop: nei.neighborIp,
              outInterface: nei.localInterface,
              neighborId: nei.neighborId,
            };
          }
        }
      }
    }

    // Convert best successors to routing table entries
    for (const top of topologyTables[dev.id]) {
      routes[dev.id].push({
        prefix: top.prefix,
        mask: top.mask,
        nextHop: top.successor.nextHop,
        outInterface: top.successor.outInterface,
        metric: top.feasibleDistance,
        asNumber: asNum,
        isExternal: false,
      });
    }
  }

  return { neighbors, topologyTables, routes };
}
