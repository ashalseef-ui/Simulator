import { Device, Link, StpPortInfo, StpTopologyState } from '../types/network';

const isSwitchType = (type: string) =>
  type === 'switch' ||
  type === 'switch2960_48' ||
  type === 'switch3560' ||
  type === 'switch3850' ||
  type === 'switch9300' ||
  type === 'l3switch' ||
  type === 'nexus9000';

/**
 * Calculates Spanning Tree Protocol (802.1D / PVST+) state for a specific VLAN.
 * Computes:
 * - Root Bridge election (lowest Bridge ID = priority + system-id-ext [vlan] : MAC)
 * - Root Port selection per switch (path cost, upstream bridge ID, upstream port ID)
 * - Designated Port vs Alternate Blocking Port election per segment
 * - PortFast edge port identification
 */
export function calculateStp(devices: Device[], links: Link[], targetVlan = 1): StpTopologyState {
  const switchDevices = devices.filter((d) => isSwitchType(d.type));

  const portsState: Record<string, StpPortInfo> = {};

  if (switchDevices.length === 0) {
    return {
      rootBridgeId: '',
      rootBridgePriority: 32768 + targetVlan,
      rootBridgeMac: '',
      ports: portsState,
      vlan: targetVlan,
    };
  }

  // Get base MAC for switch (first interface mac or config)
  const getSwitchMac = (dev: Device): string => {
    const firstPort = Object.values(dev.config.interfaces)[0];
    return firstPort ? firstPort.mac : '00:00:00:00:00:00';
  };

  // Bridge ID calculation honoring Per-VLAN Priority + System ID Extension
  const getSwitchBridgeId = (dev: Device): { priority: number; mac: string; str: string } => {
    const basePrio =
      dev.config.spanningTreeVlanPriority?.[targetVlan] ??
      dev.config.spanningTreePriority ??
      32768;
    const priority = basePrio + targetVlan;
    const mac = getSwitchMac(dev);
    return {
      priority,
      mac,
      str: `${priority.toString().padStart(5, '0')}:${mac}`,
    };
  };

  // 1. Elect Root Bridge for this VLAN (Lowest Bridge ID)
  let rootSwitch = switchDevices[0];
  let minBridgeId = getSwitchBridgeId(rootSwitch);

  for (let i = 1; i < switchDevices.length; i++) {
    const currentBridgeId = getSwitchBridgeId(switchDevices[i]);
    if (currentBridgeId.str < minBridgeId.str) {
      minBridgeId = currentBridgeId;
      rootSwitch = switchDevices[i];
    }
  }

  // Cost per interface speed: Fa=19, Gi=4, 10G=2
  const getPortCost = (dev: Device, portName: string): number => {
    const iface = dev.config.interfaces[portName];
    if (!iface) return 19;
    return iface.speed === 1000 ? 4 : iface.speed === 10000 ? 2 : 19;
  };

  // Filter links connecting two switches that allow targetVlan
  const switchLinks = links.filter((link) => {
    const devA = devices.find((d) => d.id === link.fromDevice);
    const devB = devices.find((d) => d.id === link.toDevice);
    if (!devA || !devB) return false;
    if (!isSwitchType(devA.type) || !isSwitchType(devB.type)) return false;

    // Check trunk allowed VLAN filter
    const ifaceA = devA.config.interfaces[link.fromPort];
    const ifaceB = devB.config.interfaces[link.toPort];
    if (ifaceA?.mode === 'trunk') {
      const allowed = ifaceA.trunkAllowedVlans;
      if (allowed && allowed.length > 0 && !allowed.includes(targetVlan)) return false;
    }
    if (ifaceB?.mode === 'trunk') {
      const allowed = ifaceB.trunkAllowedVlans;
      if (allowed && allowed.length > 0 && !allowed.includes(targetVlan)) return false;
    }
    return true;
  });

  // Calculate Shortest Path to Root Bridge using Dijkstra
  const rootCostToSwitch: Record<string, number> = {};
  const rootPortOnSwitch: Record<string, string> = {};
  const rootUpstream: Record<string, { bridge: string; port: string }> = {};

  switchDevices.forEach((sw) => {
    rootCostToSwitch[sw.id] = sw.id === rootSwitch.id ? 0 : Infinity;
  });

  const visited = new Set<string>();

  while (visited.size < switchDevices.length) {
    let currentId: string | null = null;
    let lowestCost = Infinity;

    for (const sw of switchDevices) {
      if (!visited.has(sw.id) && rootCostToSwitch[sw.id] < lowestCost) {
        lowestCost = rootCostToSwitch[sw.id];
        currentId = sw.id;
      }
    }

    if (!currentId || lowestCost === Infinity) break;
    visited.add(currentId);

    // Explore neighboring switches
    for (const link of switchLinks) {
      let neighborId: string | null = null;
      let neighborPort: string | null = null;
      let senderPort = '';

      if (link.fromDevice === currentId) {
        neighborId = link.toDevice;
        neighborPort = link.toPort;
        senderPort = link.fromPort;
      } else if (link.toDevice === currentId) {
        neighborId = link.fromDevice;
        neighborPort = link.fromPort;
        senderPort = link.toPort;
      }

      if (neighborId && !visited.has(neighborId)) {
        const neighborDev = switchDevices.find((d) => d.id === neighborId)!;
        const currentDev = switchDevices.find((d) => d.id === currentId)!;
        const linkCost = getPortCost(neighborDev, neighborPort!);
        const newCost = rootCostToSwitch[currentId] + linkCost;
        const sender = { bridge: getSwitchBridgeId(currentDev).str, port: senderPort };
        const prev = rootUpstream[neighborId];

        const betterTie =
          newCost === rootCostToSwitch[neighborId] &&
          prev !== undefined &&
          (sender.bridge < prev.bridge || (sender.bridge === prev.bridge && sender.port < prev.port));

        if (newCost < rootCostToSwitch[neighborId] || betterTie) {
          rootCostToSwitch[neighborId] = newCost;
          rootPortOnSwitch[neighborId] = neighborPort!;
          rootUpstream[neighborId] = sender;
        }
      }
    }
  }

  // 2. Assign Port Roles and States for all switch-to-switch links
  for (const sw of switchDevices) {
    const isRoot = sw.id === rootSwitch.id;

    const attachedLinks = switchLinks.filter(
      (l) => l.fromDevice === sw.id || l.toDevice === sw.id
    );

    for (const link of attachedLinks) {
      const isFrom = link.fromDevice === sw.id;
      const myPort = isFrom ? link.fromPort : link.toPort;
      const otherDevId = isFrom ? link.toDevice : link.fromDevice;
      const otherDev = switchDevices.find((d) => d.id === otherDevId);
      if (!otherDev) continue;

      const myKey = `${sw.id}:${myPort}`;
      const myCost = getPortCost(sw, myPort);

      if (isRoot) {
        // Root bridge ports are always Designated (DESG) and Forwarding (FWD)
        portsState[myKey] = {
          deviceId: sw.id,
          port: myPort,
          role: 'DESG',
          state: 'FWD',
          cost: myCost,
          vlan: targetVlan,
        };
      } else if (rootPortOnSwitch[sw.id] === myPort) {
        // This is the elected Root Port for this switch
        portsState[myKey] = {
          deviceId: sw.id,
          port: myPort,
          role: 'ROOT',
          state: 'FWD',
          cost: myCost,
          vlan: targetVlan,
        };
      } else {
        // Segment election between this switch and neighboring switch
        const myTotalCost = rootCostToSwitch[sw.id] || 0;
        const otherTotalCost = rootCostToSwitch[otherDevId] || 0;
        const myBridgeStr = getSwitchBridgeId(sw).str;
        const otherBridgeStr = getSwitchBridgeId(otherDev).str;

        let amDesignated = false;
        if (myTotalCost < otherTotalCost) {
          amDesignated = true;
        } else if (myTotalCost === otherTotalCost) {
          amDesignated = myBridgeStr < otherBridgeStr;
        }

        if (amDesignated) {
          portsState[myKey] = {
            deviceId: sw.id,
            port: myPort,
            role: 'DESG',
            state: 'FWD',
            cost: myCost,
            vlan: targetVlan,
          };
        } else {
          // Blocked Alternate port!
          portsState[myKey] = {
            deviceId: sw.id,
            port: myPort,
            role: 'ALTN',
            state: 'BLK',
            cost: myCost,
            vlan: targetVlan,
          };
        }
      }
    }
  }

  // 3. Edge ports facing hosts / routers (PortFast enabled or access edge)
  for (const link of links) {
    const devA = devices.find((d) => d.id === link.fromDevice);
    const devB = devices.find((d) => d.id === link.toDevice);
    if (!devA || !devB) continue;
    const aSw = isSwitchType(devA.type);
    const bSw = isSwitchType(devB.type);
    if (aSw === bSw) continue; // Skip switch-switch links (handled above)

    const [sw, port] = aSw ? [devA, link.fromPort] : [devB, link.toPort];
    const iface = sw.config.interfaces[port];
    const isEdge = !!(iface?.portfast || sw.config.portfastDefault);

    portsState[`${sw.id}:${port}`] = {
      deviceId: sw.id,
      port,
      role: 'DESG',
      state: 'FWD',
      cost: getPortCost(sw, port),
      edge: isEdge,
      vlan: targetVlan,
    };
  }

  return {
    rootBridgeId: rootSwitch.id,
    rootBridgePriority: minBridgeId.priority,
    rootBridgeMac: minBridgeId.mac,
    ports: portsState,
    vlan: targetVlan,
  };
}

/**
 * Computes Per-VLAN Spanning Tree (PVST+) across all active VLANs in the topology.
 * Solves independent spanning tree instances per VLAN so that different VLANs
 * can have distinct Root Bridges and alternate blocking ports (load balancing).
 */
export function calculatePvst(devices: Device[], links: Link[]): StpTopologyState {
  const activeVlans = new Set<number>([1]);

  // Discover all configured VLANs across all devices
  devices.forEach((dev) => {
    // Configured VLAN priorities
    if (dev.config.spanningTreeVlanPriority) {
      Object.keys(dev.config.spanningTreeVlanPriority).forEach((v) => activeVlans.add(parseInt(v, 10)));
    }
    // Switch VLAN database
    if (dev.config.vlans) {
      if (Array.isArray(dev.config.vlans)) {
        (dev.config.vlans as any[]).forEach((vl) => activeVlans.add(typeof vl === 'number' ? vl : vl.id));
      } else {
        Object.keys(dev.config.vlans).forEach((k) => activeVlans.add(parseInt(k, 10)));
      }
    }
    // Interface access and trunk VLANs
    if (dev.config.interfaces) {
      Object.values(dev.config.interfaces).forEach((iface) => {
        if (iface.accessVlan) activeVlans.add(iface.accessVlan);
        if (iface.trunkAllowedVlans) iface.trunkAllowedVlans.forEach((v) => activeVlans.add(v));
      });
    }
  });

  const vlansMap: Record<number, StpTopologyState> = {};

  activeVlans.forEach((vlanId) => {
    vlansMap[vlanId] = calculateStp(devices, links, vlanId);
  });

  // Base state defaults to VLAN 1 for backward compatibility
  const defaultState = vlansMap[1] || calculateStp(devices, links, 1);

  return {
    ...defaultState,
    vlans: vlansMap,
  };
}

/**
 * Resolves the exact STP port state for a specific VLAN.
 * Checks per-VLAN instance first, then falls back to base VLAN 1.
 */
export function getStpPortState(
  stpTopology: StpTopologyState | undefined,
  deviceId: string,
  port: string,
  vlanId = 1
): StpPortInfo | undefined {
  if (!stpTopology) return undefined;

  const key = `${deviceId}:${port}`;
  if (stpTopology.vlans && stpTopology.vlans[vlanId]) {
    const vlanPort = stpTopology.vlans[vlanId].ports[key];
    if (vlanPort) return vlanPort;
  }

  return stpTopology.ports[key];
}
