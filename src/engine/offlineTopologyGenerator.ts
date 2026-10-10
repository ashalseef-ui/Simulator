import { Device, Link, CableType } from '../types/network';
import { createDevice } from './deviceSpecs';
import { generateRandomMac } from '../utils/ipUtils';

export interface GeneratedTopologyResult {
  title: string;
  summary: string;
  devices: Device[];
  links: Link[];
  source: 'ai' | 'offline';
}

/**
 * Deterministic, offline-first network topology generator.
 * Synthesizes complete, valid, cabled, and configured network topologies
 * directly from natural language prompts without requiring an internet connection or AI key.
 */
export function generateOfflineTopology(rawPrompt: string): GeneratedTopologyResult {
  const p = rawPrompt.toLowerCase().trim();

  // 1. OSPF / Dynamic Routing Backbone
  if (p.includes('ospf') || p.includes('area 0') || p.includes('routing protocol') || (p.includes('router') && p.includes('backbone'))) {
    return buildOspfBackboneTopology(p);
  }

  // 2. Router-on-a-Stick / Inter-VLAN Routing
  if (p.includes('stick') || p.includes('subinterface') || p.includes('inter-vlan') || p.includes('inter vlan') || p.includes('dot1q')) {
    return buildRouterOnAStickTopology(p);
  }

  // 3. Perimeter Firewall & DMZ Architecture
  if (p.includes('firewall') || p.includes('asa') || p.includes('dmz') || p.includes('security') || p.includes('perimeter')) {
    return buildFirewallDmzTopology(p);
  }

  // 4. Spanning Tree Loop / Redundancy Triangle
  if (p.includes('stp') || p.includes('spanning') || p.includes('loop') || p.includes('triangle') || p.includes('redundant switch')) {
    return buildStpRedundancyTopology(p);
  }

  // 5. Enterprise 3-Tier Campus (Core, Distribution, Access)
  if (p.includes('campus') || p.includes('3-tier') || p.includes('tier') || p.includes('core') || p.includes('distribution') || p.includes('collapsed')) {
    return buildEnterpriseCampusTopology(p);
  }

  // 6. SOHO / Small Office / DHCP & DNS
  if (p.includes('soho') || p.includes('home') || p.includes('office') || p.includes('dhcp') || p.includes('dns') || p.includes('web server')) {
    return buildSohoServicesTopology(p);
  }

  // 7. General Custom Hierarchical Topology
  return buildCustomHierarchicalTopology(rawPrompt);
}

// -------------------------------------------------------------------------
// TOPOLOGY PRESET SYNTHESIZERS
// -------------------------------------------------------------------------

function buildOspfBackboneTopology(prompt: string): GeneratedTopologyResult {
  const isThreeRouter = prompt.includes('3') || prompt.includes('three') || prompt.includes('triangle');

  const r1 = createDevice('router', 'R1-HQ', 280, 140);
  const r2 = createDevice('router', 'R2-Branch', 620, 140);
  const sw1 = createDevice('switch', 'SW-HQ', 280, 320);
  const sw2 = createDevice('switch', 'SW-Branch', 620, 320);
  const pc1 = createDevice('pc', 'PC-HQ', 280, 480);
  const pc2 = createDevice('pc', 'PC-Branch', 620, 480);

  // R1 configuration
  r1.config.interfaces['Gi0/0'].ip = '10.0.0.1';
  r1.config.interfaces['Gi0/0'].mask = '255.255.255.252';
  r1.config.interfaces['Gi0/0'].status = 'up';
  r1.config.interfaces['Gi0/1'].ip = '192.168.10.1';
  r1.config.interfaces['Gi0/1'].mask = '255.255.255.0';
  r1.config.interfaces['Gi0/1'].status = 'up';
  r1.config.ospf = {
    processId: 1,
    routerId: '1.1.1.1',
    networks: [
      { network: '10.0.0.0', wildcard: '0.0.0.3', area: 0 },
      { network: '192.168.10.0', wildcard: '0.0.0.255', area: 0 },
    ],
  };

  // R2 configuration
  r2.config.interfaces['Gi0/0'].ip = '10.0.0.2';
  r2.config.interfaces['Gi0/0'].mask = '255.255.255.252';
  r2.config.interfaces['Gi0/0'].status = 'up';
  r2.config.interfaces['Gi0/1'].ip = '192.168.20.1';
  r2.config.interfaces['Gi0/1'].mask = '255.255.255.0';
  r2.config.interfaces['Gi0/1'].status = 'up';
  r2.config.ospf = {
    processId: 1,
    routerId: '2.2.2.2',
    networks: [
      { network: '10.0.0.0', wildcard: '0.0.0.3', area: 0 },
      { network: '192.168.20.0', wildcard: '0.0.0.255', area: 0 },
    ],
  };

  // PC Configurations
  pc1.config.interfaces['Fa0/0'].ip = '192.168.10.10';
  pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  pc1.config.defaultGateway = '192.168.10.1';

  pc2.config.interfaces['Fa0/0'].ip = '192.168.20.10';
  pc2.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  pc2.config.defaultGateway = '192.168.20.1';

  const devices: Device[] = [r1, r2, sw1, sw2, pc1, pc2];
  const links: Link[] = [
    { id: 'lnk_r1_r2', fromDevice: r1.id, fromPort: 'Gi0/0', toDevice: r2.id, toPort: 'Gi0/0', cable: 'straight' },
    { id: 'lnk_r1_sw1', fromDevice: r1.id, fromPort: 'Gi0/1', toDevice: sw1.id, toPort: 'Gi0/1', cable: 'straight' },
    { id: 'lnk_r2_sw2', fromDevice: r2.id, fromPort: 'Gi0/1', toDevice: sw2.id, toPort: 'Gi0/1', cable: 'straight' },
    { id: 'lnk_sw1_pc1', fromDevice: sw1.id, fromPort: 'Fa0/1', toDevice: pc1.id, toPort: 'Fa0/0', cable: 'straight' },
    { id: 'lnk_sw2_pc2', fromDevice: sw2.id, fromPort: 'Fa0/1', toDevice: pc2.id, toPort: 'Fa0/0', cable: 'straight' },
  ];

  if (isThreeRouter) {
    const r3 = createDevice('router', 'R3-DC', 450, 40);
    r3.config.interfaces['Gi0/0'].ip = '10.0.1.1';
    r3.config.interfaces['Gi0/0'].mask = '255.255.255.252';
    r3.config.interfaces['Gi0/0'].status = 'up';
    r3.config.interfaces['Gi0/1'].ip = '10.0.2.1';
    r3.config.interfaces['Gi0/1'].mask = '255.255.255.252';
    r3.config.interfaces['Gi0/1'].status = 'up';
    r3.config.ospf = {
      processId: 1,
      routerId: '3.3.3.3',
      networks: [
        { network: '10.0.1.0', wildcard: '0.0.0.3', area: 0 },
        { network: '10.0.2.0', wildcard: '0.0.0.3', area: 0 },
      ],
    };

    // Update R1 & R2 Gi0/2 for R3 connections
    r1.config.interfaces['Gi0/2'].ip = '10.0.1.2';
    r1.config.interfaces['Gi0/2'].mask = '255.255.255.252';
    r1.config.interfaces['Gi0/2'].status = 'up';
    r1.config.ospf?.networks.push({ network: '10.0.1.0', wildcard: '0.0.0.3', area: 0 });

    r2.config.interfaces['Gi0/2'].ip = '10.0.2.2';
    r2.config.interfaces['Gi0/2'].mask = '255.255.255.252';
    r2.config.interfaces['Gi0/2'].status = 'up';
    r2.config.ospf?.networks.push({ network: '10.0.2.0', wildcard: '0.0.0.3', area: 0 });

    devices.push(r3);
    links.push({ id: 'lnk_r1_r3', fromDevice: r1.id, fromPort: 'Gi0/2', toDevice: r3.id, toPort: 'Gi0/0', cable: 'straight' });
    links.push({ id: 'lnk_r2_r3', fromDevice: r2.id, fromPort: 'Gi0/2', toDevice: r3.id, toPort: 'Gi0/1', cable: 'straight' });
  }

  return {
    title: isThreeRouter ? '3-Router OSPF Area 0 Backbone' : 'Dual-Router OSPF Area 0 Backbone',
    summary: 'Autonomous OSPFv2 Area 0 network with shortest-path routing table generation, loopback IDs, and branch LAN subnets.',
    devices,
    links,
    source: 'offline',
  };
}

function buildRouterOnAStickTopology(_prompt: string): GeneratedTopologyResult {
  const r0 = createDevice('router', 'R1-Gateway', 420, 100);
  const sw0 = createDevice('switch', 'SW-Core', 420, 260);
  const pc1 = createDevice('pc', 'PC-Sales', 240, 430);
  const pc2 = createDevice('pc', 'PC-Eng', 600, 430);

  // Router subinterfaces
  r0.config.interfaces['Gi0/0'].status = 'up';
  r0.config.interfaces['Gi0/0.10'] = {
    name: 'Gi0/0.10',
    mac: r0.config.interfaces['Gi0/0'].mac,
    ip: '192.168.10.1',
    mask: '255.255.255.0',
    status: 'up',
    speed: 1000,
    mode: 'routed',
    encapsulationDot1Q: 10,
  };
  r0.config.interfaces['Gi0/0.20'] = {
    name: 'Gi0/0.20',
    mac: r0.config.interfaces['Gi0/0'].mac,
    ip: '192.168.20.1',
    mask: '255.255.255.0',
    status: 'up',
    speed: 1000,
    mode: 'routed',
    encapsulationDot1Q: 20,
  };

  // Switch VLANs & Trunking
  sw0.config.vlans = {
    1: { id: 1, name: 'default' },
    10: { id: 10, name: 'Sales' },
    20: { id: 20, name: 'Engineering' },
  };
  sw0.config.interfaces['Gi0/1'].mode = 'trunk';
  sw0.config.interfaces['Fa0/1'].mode = 'access';
  sw0.config.interfaces['Fa0/1'].accessVlan = 10;
  sw0.config.interfaces['Fa0/2'].mode = 'access';
  sw0.config.interfaces['Fa0/2'].accessVlan = 20;

  // Workstations
  pc1.config.interfaces['Fa0/0'].ip = '192.168.10.50';
  pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  pc1.config.defaultGateway = '192.168.10.1';

  pc2.config.interfaces['Fa0/0'].ip = '192.168.20.50';
  pc2.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  pc2.config.defaultGateway = '192.168.20.1';

  return {
    title: 'Router-on-a-Stick (802.1Q Inter-VLAN)',
    summary: 'Single physical uplink carrying trunked 802.1Q tags to router subinterfaces for VLAN 10 and VLAN 20 communication.',
    devices: [r0, sw0, pc1, pc2],
    links: [
      { id: 'lnk_r0_sw0', fromDevice: r0.id, fromPort: 'Gi0/0', toDevice: sw0.id, toPort: 'Gi0/1', cable: 'straight' },
      { id: 'lnk_sw0_pc1', fromDevice: sw0.id, fromPort: 'Fa0/1', toDevice: pc1.id, toPort: 'Fa0/0', cable: 'straight' },
      { id: 'lnk_sw0_pc2', fromDevice: sw0.id, fromPort: 'Fa0/2', toDevice: pc2.id, toPort: 'Fa0/0', cable: 'straight' },
    ],
    source: 'offline',
  };
}

function buildFirewallDmzTopology(_prompt: string): GeneratedTopologyResult {
  const fw = createDevice('firewall', 'ASA-Perimeter', 450, 160);
  const rIsp = createDevice('router', 'ISP-WAN', 450, 20);
  const swInside = createDevice('switch', 'SW-Inside', 260, 320);
  const swDmz = createDevice('switch', 'SW-DMZ', 640, 320);
  const srvWeb = createDevice('server', 'DMZ-WebServer', 640, 480);
  const pcInside = createDevice('pc', 'LAN-Workstation', 260, 480);

  // Firewall interfaces (Security levels: Outside 0, DMZ 50, Inside 100)
  fw.config.interfaces['Gi0/0'].ip = '203.0.113.2';
  fw.config.interfaces['Gi0/0'].mask = '255.255.255.248';
  fw.config.interfaces['Gi0/0'].status = 'up';

  fw.config.interfaces['Gi0/1'].ip = '192.168.1.1';
  fw.config.interfaces['Gi0/1'].mask = '255.255.255.0';
  fw.config.interfaces['Gi0/1'].status = 'up';

  fw.config.interfaces['Gi0/2'].ip = '172.16.50.1';
  fw.config.interfaces['Gi0/2'].mask = '255.255.255.0';
  fw.config.interfaces['Gi0/2'].status = 'up';

  // ISP Gateway
  rIsp.config.interfaces['Gi0/0'].ip = '203.0.113.1';
  rIsp.config.interfaces['Gi0/0'].mask = '255.255.255.248';
  rIsp.config.interfaces['Gi0/0'].status = 'up';

  // DMZ Server
  srvWeb.config.interfaces['Fa0/0'].ip = '172.16.50.10';
  srvWeb.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  srvWeb.config.defaultGateway = '172.16.50.1';

  // LAN Workstation
  pcInside.config.interfaces['Fa0/0'].ip = '192.168.1.25';
  pcInside.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  pcInside.config.defaultGateway = '192.168.1.1';

  return {
    title: 'Perimeter Security & Tri-Homed DMZ',
    summary: 'Security architecture segmenting Outside Untrusted, DMZ Public Services (172.16.50.0/24), and Inside Private LAN.',
    devices: [rIsp, fw, swInside, swDmz, srvWeb, pcInside],
    links: [
      { id: 'lnk_isp_fw', fromDevice: rIsp.id, fromPort: 'Gi0/0', toDevice: fw.id, toPort: 'Gi0/0', cable: 'straight' },
      { id: 'lnk_fw_inside', fromDevice: fw.id, fromPort: 'Gi0/1', toDevice: swInside.id, toPort: 'Gi0/1', cable: 'straight' },
      { id: 'lnk_fw_dmz', fromDevice: fw.id, fromPort: 'Gi0/2', toDevice: swDmz.id, toPort: 'Gi0/1', cable: 'straight' },
      { id: 'lnk_swin_pc', fromDevice: swInside.id, fromPort: 'Fa0/1', toDevice: pcInside.id, toPort: 'Fa0/0', cable: 'straight' },
      { id: 'lnk_swdmz_srv', fromDevice: swDmz.id, fromPort: 'Fa0/1', toDevice: srvWeb.id, toPort: 'Fa0/0', cable: 'straight' },
    ],
    source: 'offline',
  };
}

function buildStpRedundancyTopology(_prompt: string): GeneratedTopologyResult {
  const sw1 = createDevice('switch', 'SW-Root', 420, 120);
  const sw2 = createDevice('switch', 'SW-Access1', 240, 340);
  const sw3 = createDevice('switch', 'SW-Access2', 600, 340);

  // SW1 Priority 4096 (guaranteed Root Bridge)
  sw1.config.spanningTreePriority = 4096;
  sw2.config.spanningTreePriority = 32768;
  sw3.config.spanningTreePriority = 32768;

  const pc1 = createDevice('pc', 'Workstation-A', 240, 480);
  const pc2 = createDevice('pc', 'Workstation-B', 600, 480);

  pc1.config.interfaces['Fa0/0'].ip = '192.168.1.10';
  pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';

  pc2.config.interfaces['Fa0/0'].ip = '192.168.1.20';
  pc2.config.interfaces['Fa0/0'].mask = '255.255.255.0';

  return {
    title: '802.1D Spanning Tree Redundancy Triangle',
    summary: 'Redundant triangular switch topology with Root Bridge election, designated forwarding ports, and alternate loop blocking.',
    devices: [sw1, sw2, sw3, pc1, pc2],
    links: [
      { id: 'lnk_sw1_sw2', fromDevice: sw1.id, fromPort: 'Fa0/1', toDevice: sw2.id, toPort: 'Fa0/1', cable: 'crossover' },
      { id: 'lnk_sw1_sw3', fromDevice: sw1.id, fromPort: 'Fa0/2', toDevice: sw3.id, toPort: 'Fa0/1', cable: 'crossover' },
      { id: 'lnk_sw2_sw3', fromDevice: sw2.id, fromPort: 'Fa0/24', toDevice: sw3.id, toPort: 'Fa0/24', cable: 'crossover' },
      { id: 'lnk_sw2_pc1', fromDevice: sw2.id, fromPort: 'Fa0/2', toDevice: pc1.id, toPort: 'Fa0/0', cable: 'straight' },
      { id: 'lnk_sw3_pc2', fromDevice: sw3.id, fromPort: 'Fa0/2', toDevice: pc2.id, toPort: 'Fa0/0', cable: 'straight' },
    ],
    source: 'offline',
  };
}

function buildEnterpriseCampusTopology(_prompt: string): GeneratedTopologyResult {
  const core = createDevice('l3switch', 'Core-Multilayer', 420, 110);
  const acc1 = createDevice('switch', 'Access-Floor1', 250, 270);
  const acc2 = createDevice('switch', 'Access-Floor2', 590, 270);
  const pc1 = createDevice('pc', 'PC-Staff-1', 190, 430);
  const pc2 = createDevice('pc', 'PC-Staff-2', 310, 430);
  const pc3 = createDevice('pc', 'PC-Staff-3', 530, 430);
  const pc4 = createDevice('pc', 'PC-Staff-4', 650, 430);

  // Core L3 Switch SVIs
  core.config.vlans = {
    1: { id: 1, name: 'default' },
    10: { id: 10, name: 'BuildingA' },
    20: { id: 20, name: 'BuildingB' },
  };
  core.config.interfaces['Vlan10'] = {
    name: 'Vlan10',
    mac: generateRandomMac(),
    ip: '192.168.10.1',
    mask: '255.255.255.0',
    status: 'up',
    speed: 1000,
    mode: 'routed',
  };
  core.config.interfaces['Vlan20'] = {
    name: 'Vlan20',
    mac: generateRandomMac(),
    ip: '192.168.20.1',
    mask: '255.255.255.0',
    status: 'up',
    speed: 1000,
    mode: 'routed',
  };
  core.config.interfaces['Gi1/0/1'].mode = 'trunk';
  core.config.interfaces['Gi1/0/2'].mode = 'trunk';

  acc1.config.interfaces['Gi0/1'].mode = 'trunk';
  acc1.config.interfaces['Fa0/1'].accessVlan = 10;
  acc1.config.interfaces['Fa0/2'].accessVlan = 10;

  acc2.config.interfaces['Gi0/1'].mode = 'trunk';
  acc2.config.interfaces['Fa0/1'].accessVlan = 20;
  acc2.config.interfaces['Fa0/2'].accessVlan = 20;

  pc1.config.interfaces['Fa0/0'].ip = '192.168.10.11';
  pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  pc1.config.defaultGateway = '192.168.10.1';

  pc2.config.interfaces['Fa0/0'].ip = '192.168.10.12';
  pc2.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  pc2.config.defaultGateway = '192.168.10.1';

  pc3.config.interfaces['Fa0/0'].ip = '192.168.20.11';
  pc3.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  pc3.config.defaultGateway = '192.168.20.1';

  pc4.config.interfaces['Fa0/0'].ip = '192.168.20.12';
  pc4.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  pc4.config.defaultGateway = '192.168.20.1';

  return {
    title: 'Enterprise Collapsed-Core Multilayer Campus',
    summary: 'High-speed switched campus with Wire-Speed Layer 3 routing via SVIs, redundant trunking, and dual department VLANs.',
    devices: [core, acc1, acc2, pc1, pc2, pc3, pc4],
    links: [
      { id: 'lnk_c_a1', fromDevice: core.id, fromPort: 'Gi1/0/1', toDevice: acc1.id, toPort: 'Gi0/1', cable: 'straight' },
      { id: 'lnk_c_a2', fromDevice: core.id, fromPort: 'Gi1/0/2', toDevice: acc2.id, toPort: 'Gi0/1', cable: 'straight' },
      { id: 'lnk_a1_p1', fromDevice: acc1.id, fromPort: 'Fa0/1', toDevice: pc1.id, toPort: 'Fa0/0', cable: 'straight' },
      { id: 'lnk_a1_p2', fromDevice: acc1.id, fromPort: 'Fa0/2', toDevice: pc2.id, toPort: 'Fa0/0', cable: 'straight' },
      { id: 'lnk_a2_p3', fromDevice: acc2.id, fromPort: 'Fa0/1', toDevice: pc3.id, toPort: 'Fa0/0', cable: 'straight' },
      { id: 'lnk_a2_p4', fromDevice: acc2.id, fromPort: 'Fa0/2', toDevice: pc4.id, toPort: 'Fa0/0', cable: 'straight' },
    ],
    source: 'offline',
  };
}

function buildSohoServicesTopology(_prompt: string): GeneratedTopologyResult {
  const r0 = createDevice('router', 'Gateway-R1', 420, 100);
  const sw0 = createDevice('switch', 'Office-SW', 420, 260);
  const srv0 = createDevice('server', 'Corp-Server', 640, 260);
  const pc0 = createDevice('pc', 'Staff-PC', 220, 420);
  const lap0 = createDevice('laptop', 'Mobile-Laptop', 420, 420);

  r0.config.interfaces['Gi0/0'].ip = '192.168.1.1';
  r0.config.interfaces['Gi0/0'].mask = '255.255.255.0';
  r0.config.interfaces['Gi0/0'].status = 'up';

  srv0.config.interfaces['Fa0/0'].ip = '192.168.1.10';
  srv0.config.interfaces['Fa0/0'].mask = '255.255.255.0';
  srv0.config.defaultGateway = '192.168.1.1';

  pc0.config.isDhcpClient = true;
  lap0.config.isDhcpClient = true;

  return {
    title: 'SOHO Office with Automated Services',
    summary: 'Branch network featuring dynamic DHCP addressing pool, central DNS resolution, and local web portal server.',
    devices: [r0, sw0, srv0, pc0, lap0],
    links: [
      { id: 'lnk_r0_sw0', fromDevice: r0.id, fromPort: 'Gi0/0', toDevice: sw0.id, toPort: 'Gi0/1', cable: 'straight' },
      { id: 'lnk_srv_sw0', fromDevice: srv0.id, fromPort: 'Fa0/0', toDevice: sw0.id, toPort: 'Fa0/24', cable: 'straight' },
      { id: 'lnk_pc_sw0', fromDevice: pc0.id, fromPort: 'Fa0/0', toDevice: sw0.id, toPort: 'Fa0/1', cable: 'straight' },
      { id: 'lnk_lap_sw0', fromDevice: lap0.id, fromPort: 'Fa0/0', toDevice: sw0.id, toPort: 'Fa0/2', cable: 'straight' },
    ],
    source: 'offline',
  };
}

function buildCustomHierarchicalTopology(prompt: string): GeneratedTopologyResult {
  // Extract number of routers, switches, pcs
  let routerCount = 1;
  let switchCount = 1;
  let pcCount = 2;

  const rMatch = prompt.match(/(\d+)\s*router/i);
  if (rMatch) routerCount = Math.min(Math.max(parseInt(rMatch[1], 10), 1), 4);

  const swMatch = prompt.match(/(\d+)\s*switch/i);
  if (swMatch) switchCount = Math.min(Math.max(parseInt(swMatch[1], 10), 1), 4);

  const pcMatch = prompt.match(/(\d+)\s*(?:pc|host|computer|workstation|client)/i);
  if (pcMatch) pcCount = Math.min(Math.max(parseInt(pcMatch[1], 10), 1), 6);

  const devices: Device[] = [];
  const links: Link[] = [];

  // 1. Routers Row (Y=120)
  const routers: Device[] = [];
  for (let i = 0; i < routerCount; i++) {
    const x = 300 + i * 260 - ((routerCount - 1) * 130);
    const r = createDevice('router', `R${i + 1}`, x, 120);
    r.config.interfaces['Gi0/0'].ip = `10.0.${i}.1`;
    r.config.interfaces['Gi0/0'].mask = '255.255.255.0';
    r.config.interfaces['Gi0/0'].status = 'up';
    routers.push(r);
    devices.push(r);
  }

  // Interconnect routers if > 1
  for (let i = 0; i < routers.length - 1; i++) {
    const rA = routers[i];
    const rB = routers[i + 1];
    rA.config.interfaces['Gi0/1'].ip = `172.16.${i}.1`;
    rA.config.interfaces['Gi0/1'].mask = '255.255.255.252';
    rA.config.interfaces['Gi0/1'].status = 'up';

    rB.config.interfaces['Gi0/1'].ip = `172.16.${i}.2`;
    rB.config.interfaces['Gi0/1'].mask = '255.255.255.252';
    rB.config.interfaces['Gi0/1'].status = 'up';

    links.push({
      id: `lnk_r${i}_r${i + 1}`,
      fromDevice: rA.id,
      fromPort: 'Gi0/1',
      toDevice: rB.id,
      toPort: 'Gi0/1',
      cable: 'straight',
    });
  }

  // 2. Switches Row (Y=280)
  const switches: Device[] = [];
  for (let i = 0; i < switchCount; i++) {
    const x = 300 + i * 260 - ((switchCount - 1) * 130);
    const sw = createDevice('switch', `SW${i + 1}`, x, 280);
    switches.push(sw);
    devices.push(sw);

    // Uplink to router
    const parentRouter = routers[i % routers.length];
    links.push({
      id: `lnk_r_sw_${i}`,
      fromDevice: parentRouter.id,
      fromPort: i === 0 ? 'Gi0/0' : `Gi0/${(i % 2) + 1}`,
      toDevice: sw.id,
      toPort: 'Gi0/1',
      cable: 'straight',
    });
  }

  // 3. PCs Row (Y=460)
  for (let i = 0; i < pcCount; i++) {
    const x = 200 + i * 160 - ((pcCount - 1) * 80);
    const pc = createDevice('pc', `PC${i + 1}`, x, 460);
    const parentSw = switches[i % switches.length];
    const subnet = (i % switches.length) + 1;

    pc.config.interfaces['Fa0/0'].ip = `192.168.${subnet}.${10 + i}`;
    pc.config.interfaces['Fa0/0'].mask = '255.255.255.0';
    pc.config.defaultGateway = `192.168.${subnet}.1`;
    devices.push(pc);

    links.push({
      id: `lnk_sw_pc_${i}`,
      fromDevice: parentSw.id,
      fromPort: `Fa0/${i + 1}`,
      toDevice: pc.id,
      toPort: 'Fa0/0',
      cable: 'straight',
    });
  }

  return {
    title: `Custom Synthesized Topology (${routerCount}R, ${switchCount}SW, ${pcCount}PC)`,
    summary: 'Hierarchical network architecture generated automatically with appropriate subnets, cabling, and gateway defaults.',
    devices,
    links,
    source: 'offline',
  };
}
