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
    id: 'sp-mpls-evpn-vxlan',
    name: 'Service Provider MPLS, BGP EVPN & VXLAN Cloud Core',
    description: 'Next-Gen Service Provider Core with MPLS Label Switching, BGP EVPN Control Plane, and VXLAN Data-Plane Overlays.',
    category: 'Enterprise & SP',
    load: () => {
      const pe1 = createDevice('router', 'PE-Router-1', 120, 240);
      const coreP = createDevice('mpls_cloud', 'MPLS-Core-Cloud', 380, 240);
      const pe2 = createDevice('nexus9000', 'DC-Leaf-VTEP', 640, 240);
      const ce1 = createDevice('pc', 'Cust-Branch-Host', 120, 420);
      const ce2 = createDevice('server', 'Cust-HQ-Server', 640, 420);

      pe1.config.mpls = { enabled: true, routerId: '10.255.0.1', lfib: [{ inLabel: 1000, outLabel: 'Pop', prefix: '192.168.20.0', nextHop: '10.0.0.2', outInterface: 'Gi0/0' }] };
      pe1.config.interfaces['Gi0/0'].status = 'up';
      pe1.config.interfaces['Gi0/0'].ip = '10.0.0.1';
      pe1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      pe1.config.interfaces['Gi0/0'].mplsEnabled = true;

      pe1.config.interfaces['Gi0/1'].status = 'up';
      pe1.config.interfaces['Gi0/1'].ip = '192.168.10.1';
      pe1.config.interfaces['Gi0/1'].mask = '255.255.255.0';

      pe2.config.networkOs = 'cisco-ios';
      pe2.config.vxlan = {
        sourceInterface: 'Loopback0',
        vniMembers: { 10010: { vni: 10010, vlan: 10 } },
        vtepPeers: [{ ip: '10.255.255.1', vni: 10010, state: 'Up' }],
      };
      pe2.config.bgp = {
        asn: 65001,
        routerId: '10.255.255.2',
        neighbors: [{ ip: '10.255.255.1', remoteAs: 65001, state: 'Established' }],
        networks: [{ network: '192.168.20.0', mask: '255.255.255.0' }],
        addressFamilies: { l2vpnEvpn: true },
      };
      pe2.config.interfaces['Eth1/1'].status = 'up';
      pe2.config.interfaces['Eth1/1'].ip = '10.0.1.2';
      pe2.config.interfaces['Eth1/1'].mask = '255.255.255.0';
      pe2.config.interfaces['Eth1/2'].status = 'up';
      pe2.config.interfaces['Eth1/2'].ip = '192.168.20.1';
      pe2.config.interfaces['Eth1/2'].mask = '255.255.255.0';

      ce1.config.interfaces['Fa0/0'].status = 'up';
      ce1.config.interfaces['Fa0/0'].ip = '192.168.10.10';
      ce1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      ce1.config.defaultGateway = '192.168.10.1';

      ce2.config.interfaces['Fa0/0'].status = 'up';
      ce2.config.interfaces['Fa0/0'].ip = '192.168.20.10';
      ce2.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      ce2.config.defaultGateway = '192.168.20.1';

      const links: Link[] = [
        { id: 'l_ce1_pe1', fromDevice: ce1.id, fromPort: 'Fa0/0', toDevice: pe1.id, toPort: 'Gi0/1', cable: 'straight' },
        { id: 'l_pe1_core', fromDevice: pe1.id, fromPort: 'Gi0/0', toDevice: coreP.id, toPort: 'Gi0/1', cable: 'fiber' },
        { id: 'l_core_pe2', fromDevice: coreP.id, fromPort: 'Gi0/2', toDevice: pe2.id, toPort: 'Eth1/1', cable: 'fiber' },
        { id: 'l_pe2_ce2', fromDevice: pe2.id, fromPort: 'Eth1/2', toDevice: ce2.id, toPort: 'Fa0/0', cable: 'straight' },
      ];

      return { devices: [pe1, coreP, pe2, ce1, ce2], links };
    },
  },
  {
    id: 'smart-campus-iot-wireless',
    name: 'Smart Campus: Wireless 802.11ax, IoT Sensors & HSRP',
    description: 'High-Availability Campus with HSRP Gateway Redundancy, 802.11 Wireless AP/WLC, and Environmental IoT Telemetry Sensors.',
    category: 'Enterprise & SP',
    load: () => {
      const r1 = createDevice('router', 'Campus-Core-A', 200, 160);
      const r2 = createDevice('router', 'Campus-Core-B', 500, 160);
      const sw = createDevice('switch', 'Distribution-Switch', 350, 300);
      const wlc = createDevice('wlc', 'Campus-WLC', 160, 460);
      const ap = createDevice('ap', 'Access-Point-1', 350, 460);
      const laptop = createDevice('laptop', 'Faculty-Laptop', 350, 600);
      const sensor = createDevice('iot_sensor', 'IoT-Temp-Sensor', 540, 460);

      // HSRP on Core A (Active)
      r1.config.interfaces['Gi0/0'].status = 'up';
      r1.config.interfaces['Gi0/0'].ip = '192.168.1.2';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r1.config.interfaces['Gi0/0'].hsrp = { group: 1, virtualIp: '192.168.1.1', priority: 120, preempt: true, state: 'Active' };

      // HSRP on Core B (Standby)
      r2.config.interfaces['Gi0/0'].status = 'up';
      r2.config.interfaces['Gi0/0'].ip = '192.168.1.3';
      r2.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r2.config.interfaces['Gi0/0'].hsrp = { group: 1, virtualIp: '192.168.1.1', priority: 100, preempt: false, state: 'Standby' };

      // Wireless WLC & AP
      wlc.config.wireless = {
        wlanProfiles: [{ id: 1, ssid: 'Campus-Secure-WiFi', status: 'enabled', security: 'wpa2-psk', vlanId: 1 }],
      };
      wlc.config.interfaces['Gi0/1'].status = 'up';
      wlc.config.interfaces['Gi0/1'].ip = '192.168.1.20';
      wlc.config.interfaces['Gi0/1'].mask = '255.255.255.0';

      laptop.config.interfaces['Fa0/0'].status = 'up';
      laptop.config.interfaces['Fa0/0'].ip = '192.168.1.100';
      laptop.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      laptop.config.defaultGateway = '192.168.1.1'; // Points to HSRP VIP

      sensor.config.interfaces['Eth0'].status = 'up';
      sensor.config.interfaces['Eth0'].ip = '192.168.1.150';
      sensor.config.interfaces['Eth0'].mask = '255.255.255.0';
      sensor.config.defaultGateway = '192.168.1.1';
      sensor.config.iot = {
        role: 'sensor',
        sensorType: 'temperature',
        mqttBroker: '192.168.1.20',
        telemetry: { temperature: 22.4, humidity: 46, alert: 'Nominal' },
      };

      const links: Link[] = [
        { id: 'l_r1_sw', fromDevice: r1.id, fromPort: 'Gi0/0', toDevice: sw.id, toPort: 'Gi0/1', cable: 'straight' },
        { id: 'l_r2_sw', fromDevice: r2.id, fromPort: 'Gi0/0', toDevice: sw.id, toPort: 'Gi0/2', cable: 'straight' },
        { id: 'l_sw_wlc', fromDevice: sw.id, fromPort: 'Fa0/1', toDevice: wlc.id, toPort: 'Gi0/1', cable: 'straight' },
        { id: 'l_sw_ap', fromDevice: sw.id, fromPort: 'Fa0/2', toDevice: ap.id, toPort: 'Gi0/0', cable: 'straight' },
        { id: 'l_ap_laptop', fromDevice: ap.id, fromPort: 'Gi0/1', toDevice: laptop.id, toPort: 'Fa0/0', cable: 'auto' },
        { id: 'l_sw_sensor', fromDevice: sw.id, fromPort: 'Fa0/3', toDevice: sensor.id, toPort: 'Eth0', cable: 'straight' },
      ];

      return { devices: [r1, r2, sw, wlc, ap, laptop, sensor], links };
    },
  },
  {
    id: 'eigrp-isis-ipsec-srv6',
    name: 'Carrier WAN: EIGRP, IS-IS Backbone, IPsec VPN & SRv6',
    description: 'Enterprise Hybrid WAN: EIGRP routing at branch, ISO IS-IS Level-2 Service Provider core, Site-to-Site IPsec VPN tunnel, and Segment Routing over IPv6 (SRv6).',
    category: 'Enterprise & SP',
    load: () => {
      const branchRouter = createDevice('router', 'Branch-EIGRP-R1', 120, 220);
      const isisRouter1 = createDevice('router', 'SP-Core-ISIS-P1', 380, 140);
      const isisRouter2 = createDevice('router', 'SP-Core-ISIS-P2', 640, 140);
      const hqRouter = createDevice('router', 'HQ-SRv6-Gateway', 900, 220);
      const branchPC = createDevice('pc', 'Branch-Workstation', 120, 420);
      const hqServer = createDevice('server', 'HQ-Enterprise-DC', 900, 420);

      // Branch Router: EIGRP AS 100 + IPsec endpoint
      branchRouter.config.eigrp = {
        asNumber: 100,
        routerId: '10.255.1.1',
        networks: [
          { network: '192.168.10.0', wildcard: '0.0.0.255' },
          { network: '10.0.1.0', wildcard: '0.0.0.255' },
        ],
      };
      branchRouter.config.interfaces['Gi0/0'].status = 'up';
      branchRouter.config.interfaces['Gi0/0'].ip = '10.0.1.1';
      branchRouter.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      branchRouter.config.interfaces['Gi0/1'].status = 'up';
      branchRouter.config.interfaces['Gi0/1'].ip = '192.168.10.1';
      branchRouter.config.interfaces['Gi0/1'].mask = '255.255.255.0';
      branchRouter.config.ipsec = {
        cryptoMaps: {
          'BRANCH-TO-HQ': {
            name: 'BRANCH-TO-HQ',
            seq: 10,
            acl: 'VPN-ACL',
            peer: '10.0.2.2',
            transformSet: 'ESP-AES-SHA',
          },
        },
      };
      branchRouter.config.accessLists = {
        'VPN-ACL': {
          idOrName: 'VPN-ACL',
          type: 'extended',
          rules: [{ action: 'permit', protocol: 'ip', source: '192.168.10.0 0.0.0.255', destination: '192.168.20.0 0.0.0.255' }],
        },
      };
      branchRouter.config.interfaces['Gi0/0'].ipsecCryptoMap = 'BRANCH-TO-HQ';

      // SP Core Router 1: IS-IS Level-2
      isisRouter1.config.isis = {
        net: '49.0001.0000.0000.0001.00',
        isType: 'level-2',
        metricStyle: 'wide',
      };
      isisRouter1.config.interfaces['Gi0/0'].status = 'up';
      isisRouter1.config.interfaces['Gi0/0'].ip = '10.0.1.2';
      isisRouter1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      isisRouter1.config.interfaces['Gi0/1'].status = 'up';
      isisRouter1.config.interfaces['Gi0/1'].ip = '172.16.1.1';
      isisRouter1.config.interfaces['Gi0/1'].mask = '255.255.255.0';

      // SP Core Router 2: IS-IS Level-2
      isisRouter2.config.isis = {
        net: '49.0001.0000.0000.0002.00',
        isType: 'level-2',
        metricStyle: 'wide',
      };
      isisRouter2.config.interfaces['Gi0/0'].status = 'up';
      isisRouter2.config.interfaces['Gi0/0'].ip = '172.16.1.2';
      isisRouter2.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      isisRouter2.config.interfaces['Gi0/1'].status = 'up';
      isisRouter2.config.interfaces['Gi0/1'].ip = '10.0.2.1';
      isisRouter2.config.interfaces['Gi0/1'].mask = '255.255.255.0';

      // HQ Gateway: SRv6 + IPsec endpoint
      hqRouter.config.srv6 = {
        enabled: true,
        locator: { name: 'HQ-LOC', prefix: '2001:db8:acad::', length: 48 },
        sids: [
          { sid: '2001:db8:acad:1::', behavior: 'End' },
          { sid: '2001:db8:acad:2::', behavior: 'End.X', outInterface: 'Gi0/0' },
          { sid: '2001:db8:acad:100::', behavior: 'End.DT4' },
        ],
      };
      hqRouter.config.interfaces['Gi0/0'].status = 'up';
      hqRouter.config.interfaces['Gi0/0'].ip = '10.0.2.2';
      hqRouter.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      hqRouter.config.interfaces['Gi0/1'].status = 'up';
      hqRouter.config.interfaces['Gi0/1'].ip = '192.168.20.1';
      hqRouter.config.interfaces['Gi0/1'].mask = '255.255.255.0';
      hqRouter.config.ipsec = {
        cryptoMaps: {
          'HQ-TO-BRANCH': {
            name: 'HQ-TO-BRANCH',
            seq: 10,
            acl: 'VPN-ACL-HQ',
            peer: '10.0.1.1',
            transformSet: 'ESP-AES-SHA',
          },
        },
      };
      hqRouter.config.accessLists = {
        'VPN-ACL-HQ': {
          idOrName: 'VPN-ACL-HQ',
          type: 'extended',
          rules: [{ action: 'permit', protocol: 'ip', source: '192.168.20.0 0.0.0.255', destination: '192.168.10.0 0.0.0.255' }],
        },
      };
      hqRouter.config.interfaces['Gi0/0'].ipsecCryptoMap = 'HQ-TO-BRANCH';

      // Branch PC & HQ Server
      branchPC.config.interfaces['Fa0/0'].status = 'up';
      branchPC.config.interfaces['Fa0/0'].ip = '192.168.10.50';
      branchPC.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      branchPC.config.defaultGateway = '192.168.10.1';

      hqServer.config.interfaces['Fa0/0'].status = 'up';
      hqServer.config.interfaces['Fa0/0'].ip = '192.168.20.50';
      hqServer.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      hqServer.config.defaultGateway = '192.168.20.1';

      const links: Link[] = [
        { id: 'l_br_pc', fromDevice: branchPC.id, fromPort: 'Fa0/0', toDevice: branchRouter.id, toPort: 'Gi0/1', cable: 'straight' },
        { id: 'l_br_isis1', fromDevice: branchRouter.id, fromPort: 'Gi0/0', toDevice: isisRouter1.id, toPort: 'Gi0/0', cable: 'straight' },
        { id: 'l_isis1_isis2', fromDevice: isisRouter1.id, fromPort: 'Gi0/1', toDevice: isisRouter2.id, toPort: 'Gi0/0', cable: 'fiber' },
        { id: 'l_isis2_hq', fromDevice: isisRouter2.id, fromPort: 'Gi0/1', toDevice: hqRouter.id, toPort: 'Gi0/0', cable: 'straight' },
        { id: 'l_hq_srv', fromDevice: hqRouter.id, fromPort: 'Gi0/1', toDevice: hqServer.id, toPort: 'Fa0/0', cable: 'straight' },
      ];

      return { devices: [branchRouter, isisRouter1, isisRouter2, hqRouter, branchPC, hqServer], links };
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
