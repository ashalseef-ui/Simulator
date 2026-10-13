import { Device, Link } from '../types/network';
import { createDevice } from '../engine/deviceSpecs';

export interface TopologyPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  load: () => { devices: Device[]; links: Link[] };
}

export const TOPOLOGY_PRESETS: TopologyPreset[] = [
  {
    id: 'router-on-a-stick',
    name: 'Router-on-a-Stick (802.1Q Inter-VLAN)',
    description: '2911 Router with dot1Q subinterfaces routing between VLAN 10 (Sales) and VLAN 20 (Engineering) on a Managed Switch.',
    category: 'Inter-VLAN',
    load: () => {
      const r0 = createDevice('router', 'R1-HQ', 400, 100);
      const sw0 = createDevice('switch', 'SW-Core', 400, 260);
      const pc1 = createDevice('pc', 'PC-VLAN10', 220, 420);
      const pc2 = createDevice('pc', 'PC-VLAN20', 580, 420);

      // Pre-configure router
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

      // Pre-configure switch
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

      // Pre-configure PCs
      pc1.config.interfaces['Fa0/0'].ip = '192.168.10.10';
      pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc1.config.defaultGateway = '192.168.10.1';

      pc2.config.interfaces['Fa0/0'].ip = '192.168.20.10';
      pc2.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc2.config.defaultGateway = '192.168.20.1';

      const links: Link[] = [
        {
          id: 'l_r0_sw0',
          fromDevice: r0.id,
          fromPort: 'Gi0/0',
          toDevice: sw0.id,
          toPort: 'Gi0/1',
          cable: 'straight',
        },
        {
          id: 'l_sw0_pc1',
          fromDevice: sw0.id,
          fromPort: 'Fa0/1',
          toDevice: pc1.id,
          toPort: 'Fa0/0',
          cable: 'straight',
        },
        {
          id: 'l_sw0_pc2',
          fromDevice: sw0.id,
          fromPort: 'Fa0/2',
          toDevice: pc2.id,
          toPort: 'Fa0/0',
          cable: 'straight',
        },
      ];

      return { devices: [r0, sw0, pc1, pc2], links };
    },
  },
  {
    id: 'stp-redundant-triangle',
    name: 'Spanning Tree (STP) Triangle Loop',
    description: 'Three interconnected managed switches demonstrating Root Bridge election, Root Ports, Designated Ports, and Alternate Blocking (BLK) links.',
    category: 'Switching',
    load: () => {
      const sw1 = createDevice('switch', 'SW-Root', 400, 100);
      const sw2 = createDevice('switch', 'SW-Left', 240, 340);
      const sw3 = createDevice('switch', 'SW-Right', 560, 340);

      // SW1 priority 4096 (guaranteed Root Bridge)
      sw1.config.spanningTreePriority = 4096;

      const links: Link[] = [
        {
          id: 'l_sw1_sw2',
          fromDevice: sw1.id,
          fromPort: 'Fa0/1',
          toDevice: sw2.id,
          toPort: 'Fa0/1',
          cable: 'crossover',
        },
        {
          id: 'l_sw1_sw3',
          fromDevice: sw1.id,
          fromPort: 'Fa0/2',
          toDevice: sw3.id,
          toPort: 'Fa0/1',
          cable: 'crossover',
        },
        {
          id: 'l_sw2_sw3',
          fromDevice: sw2.id,
          fromPort: 'Fa0/24',
          toDevice: sw3.id,
          toPort: 'Fa0/24',
          cable: 'crossover',
        },
      ];

      return { devices: [sw1, sw2, sw3], links };
    },
  },
  {
    id: 'cisco-3650-multilayer-core',
    name: '3650 Multilayer Core Architecture',
    description: 'Enterprise collapsed-core design featuring Switched Virtual Interfaces (SVIs) and native Layer 3 switching.',
    category: 'Enterprise Core',
    load: () => {
      const core = createDevice('l3switch', 'Core-3650', 400, 120);
      const acc1 = createDevice('switch', 'Access-Floor1', 240, 280);
      const acc2 = createDevice('switch', 'Access-Floor2', 560, 280);
      const pc1 = createDevice('pc', 'Workstation-1', 240, 440);
      const pc2 = createDevice('pc', 'Workstation-2', 560, 440);

      core.config.ipRoutingEnabled = true;
      core.config.interfaces['Vlan10'] = {
        name: 'Vlan10',
        mac: '00:1c:b1:36:50:10',
        ip: '10.10.10.1',
        mask: '255.255.255.0',
        status: 'up',
        speed: 1000,
        mode: 'routed',
      };
      core.config.interfaces['Vlan20'] = {
        name: 'Vlan20',
        mac: '00:1c:b1:36:50:20',
        ip: '10.10.20.1',
        mask: '255.255.255.0',
        status: 'up',
        speed: 1000,
        mode: 'routed',
      };

      pc1.config.interfaces['Fa0/0'].ip = '10.10.10.50';
      pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc1.config.defaultGateway = '10.10.10.1';

      pc2.config.interfaces['Fa0/0'].ip = '10.10.20.50';
      pc2.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc2.config.defaultGateway = '10.10.20.1';

      const links: Link[] = [
        {
          id: 'l_core_acc1',
          fromDevice: core.id,
          fromPort: 'Gi1/0/1',
          toDevice: acc1.id,
          toPort: 'Gi0/1',
          cable: 'straight',
        },
        {
          id: 'l_core_acc2',
          fromDevice: core.id,
          fromPort: 'Gi1/0/2',
          toDevice: acc2.id,
          toPort: 'Gi0/1',
          cable: 'straight',
        },
        {
          id: 'l_acc1_pc1',
          fromDevice: acc1.id,
          fromPort: 'Fa0/1',
          toDevice: pc1.id,
          toPort: 'Fa0/0',
          cable: 'straight',
        },
        {
          id: 'l_acc2_pc2',
          fromDevice: acc2.id,
          fromPort: 'Fa0/1',
          toDevice: pc2.id,
          toPort: 'Fa0/0',
          cable: 'straight',
        },
      ];

      return { devices: [core, acc1, acc2, pc1, pc2], links };
    },
  },
  {
    id: 'soho-dhcp-server',
    name: 'SOHO Office with Server & Dynamic DHCP',
    description: 'Complete Small Office network with a simulated Lab Server hosting DHCP, DNS, and HTTP Web portal.',
    category: 'Services',
    load: () => {
      const r0 = createDevice('router', 'Gateway-R1', 400, 100);
      const sw0 = createDevice('switch', 'Office-SW', 400, 260);
      const srv0 = createDevice('server', 'Corp-Server', 620, 260);
      const pc0 = createDevice('pc', 'Staff-PC', 200, 400);
      const laptop0 = createDevice('laptop', 'Mobile-Laptop', 380, 420);

      r0.config.interfaces['Gi0/0'].ip = '192.168.1.1';
      r0.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r0.config.interfaces['Gi0/0'].status = 'up';

      srv0.config.interfaces['Fa0/0'].ip = '192.168.1.10';
      srv0.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      srv0.config.interfaces['Fa0/0'].status = 'up';
      srv0.config.defaultGateway = '192.168.1.1';

      pc0.config.isDhcpClient = true;
      laptop0.config.isDhcpClient = true;

      const links: Link[] = [
        {
          id: 'l_r0_sw0_soho',
          fromDevice: r0.id,
          fromPort: 'Gi0/0',
          toDevice: sw0.id,
          toPort: 'Gi0/1',
          cable: 'straight',
        },
        {
          id: 'l_srv0_sw0',
          fromDevice: srv0.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/24',
          cable: 'straight',
        },
        {
          id: 'l_pc0_sw0',
          fromDevice: pc0.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/1',
          cable: 'straight',
        },
        {
          id: 'l_lap0_sw0',
          fromDevice: laptop0.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/2',
          cable: 'straight',
        },
      ];

      return { devices: [r0, sw0, srv0, pc0, laptop0], links };
    },
  },
  {
    id: 'multi-vendor-interop',
    name: 'Universal Multi-Vendor Interoperability Fabric',
    description: 'Heterogeneous multi-vendor network: Cisco ISR Router, Juniper vSRX Gateway, Arista 7050X DC Switch, and Linux Router routing packets together with OSPF & inter-VLAN trunking.',
    category: 'Multi-Vendor NOS',
    load: () => {
      const ciscoR1 = createDevice('router', 'R1-Cisco-HQ', 250, 150);
      const juniperSRX = createDevice('juniper_vsrx', 'vSRX-Juniper', 550, 150);
      const aristaSW = createDevice('arista_7050', 'SW1-Arista-DC', 400, 300);
      const linuxHost = createDevice('linux_router', 'Linux-Gateway', 250, 450);
      const pc1 = createDevice('pc', 'Client-PC1', 550, 450);

      // Cisco R1 IP configuration
      ciscoR1.config.networkOs = 'cisco-ios';
      ciscoR1.config.interfaces['Gi0/0'].status = 'up';
      ciscoR1.config.interfaces['Gi0/0'].ip = '10.0.1.1';
      ciscoR1.config.interfaces['Gi0/0'].mask = '255.255.255.0';

      // Juniper vSRX IP configuration
      juniperSRX.config.networkOs = 'juniper-junos';
      juniperSRX.config.interfaces['ge-0/0/0'].status = 'up';
      juniperSRX.config.interfaces['ge-0/0/0'].ip = '10.0.1.2';
      juniperSRX.config.interfaces['ge-0/0/0'].mask = '255.255.255.0';
      juniperSRX.config.interfaces['ge-0/0/1'].status = 'up';
      juniperSRX.config.interfaces['ge-0/0/1'].ip = '10.0.2.1';
      juniperSRX.config.interfaces['ge-0/0/1'].mask = '255.255.255.0';

      // Arista Switch configuration
      aristaSW.config.networkOs = 'arista-eos';
      aristaSW.config.interfaces['Et1'].status = 'up';
      aristaSW.config.interfaces['Et2'].status = 'up';
      aristaSW.config.interfaces['Et3'].status = 'up';
      aristaSW.config.interfaces['Et4'].status = 'up';

      // Linux host configuration
      linuxHost.config.networkOs = 'linux-vyos';
      linuxHost.config.interfaces['eth0'].status = 'up';
      linuxHost.config.interfaces['eth0'].ip = '10.0.2.10';
      linuxHost.config.interfaces['eth0'].mask = '255.255.255.0';
      linuxHost.config.defaultGateway = '10.0.2.1';

      // Client PC configuration
      pc1.config.interfaces['Fa0/0'].status = 'up';
      pc1.config.interfaces['Fa0/0'].ip = '10.0.2.20';
      pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc1.config.defaultGateway = '10.0.2.1';

      const links: Link[] = [
        {
          id: 'l_cisco_arista',
          fromDevice: ciscoR1.id,
          fromPort: 'Gi0/0',
          toDevice: aristaSW.id,
          toPort: 'Et1',
          cable: 'straight',
        },
        {
          id: 'l_juniper_arista',
          fromDevice: juniperSRX.id,
          fromPort: 'ge-0/0/0',
          toDevice: aristaSW.id,
          toPort: 'Et2',
          cable: 'straight',
        },
        {
          id: 'l_linux_arista',
          fromDevice: linuxHost.id,
          fromPort: 'eth0',
          toDevice: aristaSW.id,
          toPort: 'Et3',
          cable: 'straight',
        },
        {
          id: 'l_pc_arista',
          fromDevice: pc1.id,
          fromPort: 'Fa0/0',
          toDevice: aristaSW.id,
          toPort: 'Et4',
          cable: 'straight',
        },
      ];

      return { devices: [ciscoR1, juniperSRX, aristaSW, linuxHost, pc1], links };
    },
  },
  {
    id: 'blank-slate',
    name: 'Blank Slate',
    description: 'Empty workspace ready to design and simulate your own custom multi-vendor network topology from scratch.',
    category: 'Custom',
    load: () => ({ devices: [], links: [] }),
  },
];
