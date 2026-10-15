import { Device, DeviceInterface, Link, IsisConfig } from '../../types/network';
import { areSameSubnet, safeCidr } from '../../utils/ipUtils';

export interface IsisNeighbor {
  systemId: string;
  snpa: string;
  level: 'L1' | 'L2' | 'L1L2';
  state: 'Up' | 'Init' | 'Down';
  interface: string;
  localInterface: string;
  holdtime: number;
}

export interface IsisLspEntry {
  lspId: string;
  seqNumber: string;
  checksum: string;
  lifetime: number;
  level: 'L1' | 'L2';
}

export interface IsisRoute {
  prefix: string;
  mask: string;
  nextHop: string;
  outInterface: string;
  metric: number;
  level: 'L1' | 'L2';
}

export interface IsisComputedState {
  neighbors: Record<string, IsisNeighbor[]>;
  database: Record<string, IsisLspEntry[]>;
  disMap: Record<string, string>; // interface/lan -> systemId of DIS
  routes: Record<string, IsisRoute[]>;
}

/**
 * Parses an IS-IS Network Entity Title (NET), e.g. "49.0001.1921.6800.1001.00"
 */
export function parseIsisNet(net: string): { areaId: string; systemId: string; nsel: string } | null {
  if (!net) return null;
  const cleaned = net.replace(/\./g, '');
  if (cleaned.length < 8) return null;

  const nsel = cleaned.slice(-2);
  const systemIdRaw = cleaned.slice(-14, -2);
  const areaId = cleaned.slice(0, -14);

  const formattedSysId = systemIdRaw.match(/.{1,4}/g)?.join('.') || systemIdRaw;

  return {
    areaId,
    systemId: formattedSysId,
    nsel,
  };
}

/**
 * Computes IS-IS adjacencies (L1, L2), DIS elections, LSP databases, and routes.
 */
export function computeIsisNetworkState(devices: Device[], links: Link[]): IsisComputedState {
  const neighbors: Record<string, IsisNeighbor[]> = {};
  const database: Record<string, IsisLspEntry[]> = {};
  const disMap: Record<string, string> = {};
  const routes: Record<string, IsisRoute[]> = {};

  const isisDevices = (devices || []).filter((d) => d.config?.isis && d.config.isis.net);

  for (const dev of isisDevices) {
    neighbors[dev.id] = [];
    database[dev.id] = [];
    routes[dev.id] = [];
  }

  // 1. Establish IS-IS Adjacencies across links connecting IS-IS enabled interfaces
  for (const link of links || []) {
    const devA = isisDevices.find((d) => d.id === link.fromDevice);
    const devB = isisDevices.find((d) => d.id === link.toDevice);
    if (!devA || !devB) continue;

    const netA = parseIsisNet(devA.config.isis!.net!);
    const netB = parseIsisNet(devB.config.isis!.net!);
    if (!netA || !netB) continue;

    const ifA = devA.config.interfaces?.[link.fromPort];
    const ifB = devB.config.interfaces?.[link.toPort];
    if (!ifA || !ifB || ifA.status !== 'up' || ifB.status !== 'up') continue;

    const typeA = devA.config.isis!.isType;
    const typeB = devB.config.isis!.isType;

    // L1 requires identical area; L2 does not
    const sameArea = netA.areaId === netB.areaId;
    let formedLevel: 'L1' | 'L2' | 'L1L2' | null = null;

    if (sameArea && (typeA === 'level-1' || typeA === 'level-1-2') && (typeB === 'level-1' || typeB === 'level-1-2')) {
      formedLevel = (typeA === 'level-1-2' && typeB === 'level-1-2') ? 'L1L2' : 'L1';
    } else if ((typeA === 'level-2' || typeA === 'level-1-2') && (typeB === 'level-2' || typeB === 'level-1-2')) {
      formedLevel = 'L2';
    }

    if (!formedLevel) continue;

    neighbors[devA.id].push({
      systemId: netB.systemId,
      snpa: ifB.mac || '0050.56aa.0001',
      level: formedLevel,
      state: 'Up',
      interface: link.fromPort,
      localInterface: link.fromPort,
      holdtime: 30,
    });

    neighbors[devB.id].push({
      systemId: netA.systemId,
      snpa: ifA.mac || '0050.56aa.0002',
      level: formedLevel,
      state: 'Up',
      interface: link.toPort,
      localInterface: link.toPort,
      holdtime: 30,
    });
  }

  // 2. DIS (Designated Intermediate System) Election per multi-access LAN link
  for (const link of links || []) {
    const devA = isisDevices.find((d) => d.id === link.fromDevice);
    const devB = isisDevices.find((d) => d.id === link.toDevice);
    if (!devA || !devB) continue;

    const macA = devA.config.interfaces?.[link.fromPort]?.mac || '0000.0000.0001';
    const macB = devB.config.interfaces?.[link.toPort]?.mac || '0000.0000.0002';

    // In IS-IS, higher MAC address wins DIS election when priority is default (64)
    const disSystemId = macA > macB ? parseIsisNet(devA.config.isis!.net!)?.systemId : parseIsisNet(devB.config.isis!.net!)?.systemId;
    if (disSystemId) {
      disMap[link.id] = disSystemId;
    }
  }

  // 3. LSP Database Generation & Dijkstra Routing Table
  for (const dev of isisDevices) {
    const net = parseIsisNet(dev.config.isis!.net!);
    if (!net) continue;

    database[dev.id].push({
      lspId: `${net.systemId}.00-00`,
      seqNumber: '0x00000004',
      checksum: '0xa78b',
      lifetime: 1198,
      level: dev.config.isis!.isType === 'level-2' ? 'L2' : 'L1',
    });

    // Populate routes from reachable neighbors
    const devNeis = neighbors[dev.id] || [];
    for (const nei of devNeis) {
      const neighborDev = isisDevices.find((d) => parseIsisNet(d.config.isis?.net || '')?.systemId === nei.systemId);
      if (!neighborDev) continue;

      for (const [remIfName, remIf] of Object.entries(neighborDev.config.interfaces || {})) {
        if (!remIf.ip || !remIf.mask || remIf.status !== 'up') continue;

        // Skip directly connected subnets
        const isDirect = Object.values(dev.config.interfaces || {}).some(
          (loc) => loc.ip && loc.mask && remIf.ip && remIf.mask && areSameSubnet(loc.ip, remIf.ip, loc.mask)
        );
        if (isDirect) continue;

        const nextHopIp = remIf.ip;
        routes[dev.id].push({
          prefix: remIf.ip,
          mask: remIf.mask,
          nextHop: nextHopIp,
          outInterface: nei.localInterface,
          metric: 20, // default narrow metric 10 per hop
          level: nei.level === 'L2' ? 'L2' : 'L1',
        });
      }
    }

    if (dev.config.isis) {
      dev.config.isis.neighbors = devNeis;
      dev.config.isis.lspDatabase = database[dev.id];
    }
  }

  return { neighbors, database, disMap, routes };
}
