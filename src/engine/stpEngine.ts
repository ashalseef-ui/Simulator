import { Device, Link, StpPortInfo, StpTopologyState } from '../types/network';

const isSwitchType = (type: string) =>
  type === 'switch' || type === 'switch3560' || type === 'l3switch' || type === 'nexus9000';

export function calculateStp(devices: Device[], links: Link[], targetVlan: number = 1): StpTopologyState {
  const switchDevices = devices.filter((d) => isSwitchType(d.type));

  const portsState: Record<string, StpPortInfo> = {};

  if (switchDevices.length === 0) {
    return {
      rootBridgeId: '',
      rootBridgePriority: 32768,
      rootBridgeMac: '',
      ports: portsState,
    };
  }

  // Get primary MAC for switch (first interface or config)
  const getSwitchMac = (dev: Device): string => {
    const firstPort = Object.values(dev.config.interfaces)[0];
    return firstPort ? firstPort.mac : '00:00:00:00:00:00';
  };

  const getSwitchBridgeId = (dev: Device): { priority: number; mac: string; str: string } => {
    const priority = (dev.config.spanningTreePriority ?? 32768) + targetVlan;
    const mac = getSwitchMac(dev);
    return {
      priority,
      mac,
      str: `${priority.toString().padStart(5, '0')}:${mac}`,
    };
  };

  // 1. Elect Root Bridge (Lowest Bridge ID)
  let rootSwitch = switchDevices[0];
  let minBridgeId = getSwitchBridgeId(rootSwitch);

  for (let i = 1; i < switchDevices.length; i++) {
    const currentBridgeId = getSwitchBridgeId(switchDevices[i]);
    if (currentBridgeId.str < minBridgeId.str) {
      minBridgeId = currentBridgeId;
      rootSwitch = switchDevices[i];
    }
  }

  // Cost per interface speed: Fa=19, Gi=4
  const getPortCost = (dev: Device, portName: string): number => {
    const iface = dev.config.interfaces[portName];
    if (!iface) return 19;
    return iface.speed === 1000 ? 4 : 19;
  };

  // Filter links connecting two switches
  const switchLinks = links.filter((link) => {
    const devA = devices.find((d) => d.id === link.fromDevice);
    const devB = devices.find((d) => d.id === link.toDevice);
    if (!devA || !devB) return false;
    return isSwitchType(devA.type) && isSwitchType(devB.type);
  });

  // Calculate Shortest Path to Root Bridge using Dijkstra / BFS
  const rootCostToSwitch: Record<string, number> = {};
  const rootPortOnSwitch: Record<string, string> = {};

  switchDevices.forEach((sw) => {
    rootCostToSwitch[sw.id] = sw.id === rootSwitch.id ? 0 : Infinity;
  });

  const visited = new Set<string>();

  while (visited.size < switchDevices.length) {
    // Find unvisited switch with lowest cost
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

    // Explore neighbors
    for (const link of switchLinks) {
      let neighborId: string | null = null;
      let neighborPort: string | null = null;

      if (link.fromDevice === currentId) {
        neighborId = link.toDevice;
        neighborPort = link.toPort;
      } else if (link.toDevice === currentId) {
        neighborId = link.fromDevice;
        neighborPort = link.fromPort;
      }

      if (neighborId && !visited.has(neighborId)) {
        const neighborDev = switchDevices.find((d) => d.id === neighborId)!;
        const linkCost = getPortCost(neighborDev, neighborPort!);
        const newCost = rootCostToSwitch[currentId] + linkCost;

        if (newCost < rootCostToSwitch[neighborId]) {
          rootCostToSwitch[neighborId] = newCost;
          rootPortOnSwitch[neighborId] = neighborPort!;
        }
      }
    }
  }

  // 2. Assign Port Roles and States for all switch links
  for (const sw of switchDevices) {
    const isRoot = sw.id === rootSwitch.id;

    // Find links attached to this switch
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
        // Root bridge ports are always DESG and FWD
        portsState[myKey] = {
          deviceId: sw.id,
          port: myPort,
          role: 'DESG',
          state: 'FWD',
          cost: myCost,
        };
      } else if (rootPortOnSwitch[sw.id] === myPort) {
        // This is the Root Port for this switch
        portsState[myKey] = {
          deviceId: sw.id,
          port: myPort,
          role: 'ROOT',
          state: 'FWD',
          cost: myCost,
        };
      } else {
        // Segment election between this switch and other switch
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
          };
        } else {
          // Blocked Alternate port!
          portsState[myKey] = {
            deviceId: sw.id,
            port: myPort,
            role: 'ALTN',
            state: 'BLK',
            cost: myCost,
          };
        }
      }
    }
  }

  // Edge ports (connected to PCs, Routers, Servers) are always DESG / FWD
  const nonSwitchLinks = links.filter((link) => {
    const devA = devices.find((d) => d.id === link.fromDevice);
    const devB = devices.find((d) => d.id === link.toDevice);
    if (!devA || !devB) return false;
    const isSwA = devA.type === 'switch' || devA.type === 'l3switch';
    const isSwB = devB.type === 'switch' || devB.type === 'l3switch';
    return (isSwA && !isSwB) || (!isSwA && isSwB);
  });

  nonSwitchLinks.forEach((link) => {
    const devA = devices.find((d) => d.id === link.fromDevice);
    if (devA && (devA.type === 'switch' || devA.type === 'l3switch')) {
      const key = `${devA.id}:${link.fromPort}`;
      portsState[key] = {
        deviceId: devA.id,
        port: link.fromPort,
        role: 'DESG',
        state: 'FWD',
        cost: getPortCost(devA, link.fromPort),
      };
    }
    const devB = devices.find((d) => d.id === link.toDevice);
    if (devB && (devB.type === 'switch' || devB.type === 'l3switch')) {
      const key = `${devB.id}:${link.toPort}`;
      portsState[key] = {
        deviceId: devB.id,
        port: link.toPort,
        role: 'DESG',
        state: 'FWD',
        cost: getPortCost(devB, link.toPort),
      };
    }
  });

  return {
    rootBridgeId: rootSwitch.id,
    rootBridgePriority: minBridgeId.priority,
    rootBridgeMac: minBridgeId.mac,
    ports: portsState,
  };
}
