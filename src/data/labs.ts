import { LabScenario, Link } from '../types/network';
import { createDevice } from '../engine/deviceSpecs';

export const LAB_SCENARIOS: LabScenario[] = [
  {
    id: 'lab-1-arp-fundamentals',
    title: '1. LAN & ARP Fundamentals',
    category: 'CCNA Layer 2',
    difficulty: 'Beginner',
    summary: 'Configure static IP addressing on PC hosts connected to an access switch and observe address resolution.',
    objective: 'Assign IP addresses 192.168.1.10/24 to PC0 and 192.168.1.20/24 to PC1, then verify connectivity.',
    instructions: [
      'Open PC0 desktop settings and set IP to 192.168.1.10 with Subnet Mask 255.255.255.0.',
      'Open PC1 desktop settings and set IP to 192.168.1.20 with Subnet Mask 255.255.255.0.',
      'Ensure both PCs are connected to Switch0 via Straight-Through copper cables.',
      'Open Command Prompt on PC0 and test ping to 192.168.1.20.',
      'Click "Verify Configuration" to check your work.',
    ],
    tips: [
      'Devices in the same broadcast domain must share the same network address (192.168.1.0/24).',
      'The initial ping triggers an ARP broadcast to resolve MAC addresses.',
    ],
    initialTopology: () => {
      const pc0 = createDevice('pc', 'PC0', 160, 200);
      const pc1 = createDevice('pc', 'PC1', 600, 200);
      const sw0 = createDevice('switch', 'Switch0', 380, 200);

      const links: Link[] = [
        {
          id: 'link_pc0_sw0',
          fromDevice: pc0.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/1',
          cable: 'straight',
        },
        {
          id: 'link_pc1_sw0',
          fromDevice: pc1.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/2',
          cable: 'straight',
        },
      ];

      return { devices: [pc0, sw0, pc1], links };
    },
    validate: (devices) => {
      const pc0 = devices.find((d) => d.name === 'PC0');
      const pc1 = devices.find((d) => d.name === 'PC1');

      const c1 = {
        name: 'PC0 configured with 192.168.1.10/24',
        passed: pc0?.config.interfaces['Fa0/0']?.ip === '192.168.1.10' && pc0?.config.interfaces['Fa0/0']?.mask === '255.255.255.0',
        message: 'Set PC0 Fa0/0 IP to 192.168.1.10 and Mask to 255.255.255.0',
      };
      const c2 = {
        name: 'PC1 configured with 192.168.1.20/24',
        passed: pc1?.config.interfaces['Fa0/0']?.ip === '192.168.1.20' && pc1?.config.interfaces['Fa0/0']?.mask === '255.255.255.0',
        message: 'Set PC1 Fa0/0 IP to 192.168.1.20 and Mask to 255.255.255.0',
      };

      const criteria = [c1, c2];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
  },
  {
    id: 'lab-2-vlans-trunks',
    title: '2. VLANs & 802.1Q Trunks',
    category: 'CCNA Switching',
    difficulty: 'Intermediate',
    summary: 'Segment traffic into VLAN 10 (Sales) and VLAN 20 (Engineering) across two switches connected via an 802.1Q trunk link.',
    objective: 'Create VLAN 10 and 20 on both switches, configure Fa0/1 as access VLAN 10, Fa0/2 as access VLAN 20, and Gi0/1 as trunk.',
    instructions: [
      'On Switch0 and Switch1, enter Global Config: `vlan 10` (name Sales), `vlan 20` (name Engineering).',
      'On both switches, configure interface Gi0/1: `switchport mode trunk`.',
      'On Switch0, configure `interface Fa0/1`: `switchport mode access`, `switchport access vlan 10`.',
      'On Switch0, configure `interface Fa0/2`: `switchport mode access`, `switchport access vlan 20`.',
    ],
    initialTopology: () => {
      const sw0 = createDevice('switch', 'Switch0', 260, 200);
      const sw1 = createDevice('switch', 'Switch1', 520, 200);
      const pc0 = createDevice('pc', 'PC-Sales', 120, 320);
      const pc1 = createDevice('pc', 'PC-Eng', 120, 100);

      const links: Link[] = [
        {
          id: 'link_sw0_sw1',
          fromDevice: sw0.id,
          fromPort: 'Gi0/1',
          toDevice: sw1.id,
          toPort: 'Gi0/1',
          cable: 'crossover',
        },
        {
          id: 'link_pc0_sw0',
          fromDevice: pc0.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/1',
          cable: 'straight',
        },
        {
          id: 'link_pc1_sw0',
          fromDevice: pc1.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/2',
          cable: 'straight',
        },
      ];

      return { devices: [sw0, sw1, pc0, pc1], links };
    },
    validate: (devices) => {
      const sw0 = devices.find((d) => d.name === 'Switch0');
      const sw1 = devices.find((d) => d.name === 'Switch1');

      const c1 = {
        name: 'VLAN 10 and 20 created on Switch0',
        passed: !!(sw0?.config.vlans[10] && sw0?.config.vlans[20]),
        message: 'Create VLAN 10 and 20 in Switch0 configuration',
      };
      const c2 = {
        name: 'Switch0 Gi0/1 configured as 802.1Q trunk',
        passed: sw0?.config.interfaces['Gi0/1']?.mode === 'trunk',
        message: 'Execute "switchport mode trunk" on Switch0 Gi0/1',
      };
      const c3 = {
        name: 'Switch0 Fa0/1 in VLAN 10 & Fa0/2 in VLAN 20',
        passed: sw0?.config.interfaces['Fa0/1']?.accessVlan === 10 && sw0?.config.interfaces['Fa0/2']?.accessVlan === 20,
        message: 'Assign Fa0/1 to VLAN 10 and Fa0/2 to VLAN 20',
      };
      const c4 = {
        name: 'Switch1 Gi0/1 configured as trunk',
        passed: sw1?.config.interfaces['Gi0/1']?.mode === 'trunk',
        message: 'Execute "switchport mode trunk" on Switch1 Gi0/1',
      };

      const criteria = [c1, c2, c3, c4];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
  },
  {
    id: 'lab-3-router-on-a-stick',
    title: '3. Inter-VLAN Routing (Router-on-a-Stick)',
    category: 'CCNA Routing',
    difficulty: 'Intermediate',
    summary: 'Configure 802.1Q subinterfaces on a router to route between VLAN 10 and VLAN 20.',
    objective: 'Configure router subinterfaces Gi0/0.10 and Gi0/0.20 with dot1Q encapsulation and default gateway IPs.',
    instructions: [
      'On Router0: `interface Gi0/0`, then `no shutdown`.',
      'Create subinterface `interface Gi0/0.10`: `encapsulation dot1Q 10`, `ip address 192.168.10.1 255.255.255.0`.',
      'Create subinterface `interface Gi0/0.20`: `encapsulation dot1Q 20`, `ip address 192.168.20.1 255.255.255.0`.',
      'Configure Switch0 Gi0/1 as trunk port.',
      'Set PC0 IP 192.168.10.10 (Gateway 192.168.10.1) and PC1 IP 192.168.20.10 (Gateway 192.168.20.1).',
    ],
    initialTopology: () => {
      const r0 = createDevice('router', 'Router0', 380, 80);
      const sw0 = createDevice('switch', 'Switch0', 380, 240);
      const pc0 = createDevice('pc', 'PC0', 200, 360);
      const pc1 = createDevice('pc', 'PC1', 560, 360);

      // Pre-set switch ports
      sw0.config.interfaces['Fa0/1'].accessVlan = 10;
      sw0.config.interfaces['Fa0/2'].accessVlan = 20;
      sw0.config.interfaces['Gi0/1'].mode = 'trunk';

      const links: Link[] = [
        {
          id: 'link_r0_sw0',
          fromDevice: r0.id,
          fromPort: 'Gi0/0',
          toDevice: sw0.id,
          toPort: 'Gi0/1',
          cable: 'straight',
        },
        {
          id: 'link_pc0_sw0',
          fromDevice: pc0.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/1',
          cable: 'straight',
        },
        {
          id: 'link_pc1_sw0',
          fromDevice: pc1.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/2',
          cable: 'straight',
        },
      ];

      return { devices: [r0, sw0, pc0, pc1], links };
    },
    validate: (devices) => {
      const r0 = devices.find((d) => d.name === 'Router0');
      const sub10 = r0?.config.interfaces['Gi0/0.10'];
      const sub20 = r0?.config.interfaces['Gi0/0.20'];

      const c1 = {
        name: 'Gi0/0 parent interface is active (no shutdown)',
        passed: r0?.config.interfaces['Gi0/0']?.status === 'up',
        message: 'Run "no shutdown" on Router0 Gi0/0',
      };
      const c2 = {
        name: 'Subinterface Gi0/0.10: dot1Q 10, IP 192.168.10.1/24',
        passed: sub10?.encapsulationDot1Q === 10 && sub10?.ip === '192.168.10.1',
        message: 'Configure Gi0/0.10 with encapsulation dot1Q 10 and IP 192.168.10.1 255.255.255.0',
      };
      const c3 = {
        name: 'Subinterface Gi0/0.20: dot1Q 20, IP 192.168.20.1/24',
        passed: sub20?.encapsulationDot1Q === 20 && sub20?.ip === '192.168.20.1',
        message: 'Configure Gi0/0.20 with encapsulation dot1Q 20 and IP 192.168.20.1 255.255.255.0',
      };

      const criteria = [c1, c2, c3];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
  },
  {
    id: 'lab-4-l3-switch-core',
    title: '4. 3650 Multilayer Core Switch Architecture',
    category: 'CCNA Enterprise',
    difficulty: 'Intermediate',
    summary: 'Enable IP routing and create Switched Virtual Interfaces (SVIs) on a multilayer switch to route locally.',
    objective: 'Enable `ip routing`, configure SVI `interface Vlan10` and `interface Vlan20`.',
    instructions: [
      'Open CLI on CoreSwitch3650 and enter `configure terminal`.',
      'Enable hardware routing: `ip routing`.',
      'Create and configure SVI 10: `interface Vlan10`, `ip address 10.1.10.1 255.255.255.0`, `no shutdown`.',
      'Create and configure SVI 20: `interface Vlan20`, `ip address 10.1.20.1 255.255.255.0`, `no shutdown`.',
    ],
    initialTopology: () => {
      const l3 = createDevice('l3switch', 'CoreSwitch3650', 380, 160);
      const pc0 = createDevice('pc', 'PC10', 220, 320);
      const pc1 = createDevice('pc', 'PC20', 540, 320);

      l3.config.interfaces['Gi1/0/1'].accessVlan = 10;
      l3.config.interfaces['Gi1/0/2'].accessVlan = 20;

      const links: Link[] = [
        {
          id: 'link_l3_pc10',
          fromDevice: l3.id,
          fromPort: 'Gi1/0/1',
          toDevice: pc0.id,
          toPort: 'Fa0/0',
          cable: 'straight',
        },
        {
          id: 'link_l3_pc20',
          fromDevice: l3.id,
          fromPort: 'Gi1/0/2',
          toDevice: pc1.id,
          toPort: 'Fa0/0',
          cable: 'straight',
        },
      ];

      return { devices: [l3, pc0, pc1], links };
    },
    validate: (devices) => {
      const l3 = devices.find((d) => d.name === 'CoreSwitch3650');
      const v10 = l3?.config.interfaces['Vlan10'];
      const v20 = l3?.config.interfaces['Vlan20'];

      const c1 = {
        name: 'IP Routing enabled on Multilayer Switch',
        passed: !!l3?.config.ipRoutingEnabled,
        message: 'Execute "ip routing" in global configuration',
      };
      const c2 = {
        name: 'SVI Vlan10 configured with IP 10.1.10.1/24',
        passed: v10?.ip === '10.1.10.1' && v10?.status === 'up',
        message: 'Set interface Vlan10 IP to 10.1.10.1 255.255.255.0 and no shutdown',
      };
      const c3 = {
        name: 'SVI Vlan20 configured with IP 10.1.20.1/24',
        passed: v20?.ip === '10.1.20.1' && v20?.status === 'up',
        message: 'Set interface Vlan20 IP to 10.1.20.1 255.255.255.0 and no shutdown',
      };

      const criteria = [c1, c2, c3];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
  },
  {
    id: 'lab-5-static-routing',
    title: '5. Static Routing & Gateway of Last Resort',
    category: 'CCNA Routing',
    difficulty: 'Intermediate',
    summary: 'Establish end-to-end connectivity between two distinct sites across a point-to-point link using static routes.',
    objective: 'Configure static route `ip route 192.168.2.0 255.255.255.0 10.0.0.2` on R1 and return route on R2.',
    instructions: [
      'On R1: `ip route 192.168.2.0 255.255.255.0 10.0.0.2`.',
      'On R2: `ip route 192.168.1.0 255.255.255.0 10.0.0.1`.',
      'Verify routing tables using `show ip route`.',
    ],
    initialTopology: () => {
      const r1 = createDevice('router', 'R1', 260, 180);
      const r2 = createDevice('router', 'R2', 540, 180);

      r1.config.interfaces['Gi0/0'].ip = '192.168.1.1';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r1.config.interfaces['Gi0/0'].status = 'up';
      r1.config.interfaces['Gi0/1'].ip = '10.0.0.1';
      r1.config.interfaces['Gi0/1'].mask = '255.255.255.252';
      r1.config.interfaces['Gi0/1'].status = 'up';

      r2.config.interfaces['Gi0/0'].ip = '192.168.2.1';
      r2.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r2.config.interfaces['Gi0/0'].status = 'up';
      r2.config.interfaces['Gi0/1'].ip = '10.0.0.2';
      r2.config.interfaces['Gi0/1'].mask = '255.255.255.252';
      r2.config.interfaces['Gi0/1'].status = 'up';

      const links: Link[] = [
        {
          id: 'link_r1_r2',
          fromDevice: r1.id,
          fromPort: 'Gi0/1',
          toDevice: r2.id,
          toPort: 'Gi0/1',
          cable: 'crossover',
        },
      ];

      return { devices: [r1, r2], links };
    },
    validate: (devices) => {
      const r1 = devices.find((d) => d.name === 'R1');
      const r2 = devices.find((d) => d.name === 'R2');

      const r1Route = r1?.config.routes.find(
        (r) => r.network === '192.168.2.0' && r.nextHop === '10.0.0.2'
      );
      const r2Route = r2?.config.routes.find(
        (r) => r.network === '192.168.1.0' && r.nextHop === '10.0.0.1'
      );

      const c1 = {
        name: 'R1 static route to 192.168.2.0/24 via 10.0.0.2',
        passed: !!r1Route,
        message: 'Add static route: ip route 192.168.2.0 255.255.255.0 10.0.0.2',
      };
      const c2 = {
        name: 'R2 return static route to 192.168.1.0/24 via 10.0.0.1',
        passed: !!r2Route,
        message: 'Add static route: ip route 192.168.1.0 255.255.255.0 10.0.0.1',
      };

      const criteria = [c1, c2];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
  },
  {
    id: 'lab-6-ospfv2',
    title: '6. Single-Area OSPFv2 Routing',
    category: 'CCNA Routing',
    difficulty: 'Advanced',
    summary: 'Configure Open Shortest Path First (OSPFv2) single area 0 across two routers with wildcard masks.',
    objective: 'Configure `router ospf 1` and advertise local subnets in Area 0.',
    instructions: [
      'On R1: `router ospf 1`, `network 192.168.1.0 0.0.0.255 area 0`, `network 10.0.0.0 0.0.0.3 area 0`.',
      'On R2: `router ospf 1`, `network 192.168.2.0 0.0.0.255 area 0`, `network 10.0.0.0 0.0.0.3 area 0`.',
      'Check OSPF configuration with `show running-config`.',
    ],
    initialTopology: () => {
      const r1 = createDevice('router', 'R1', 260, 180);
      const r2 = createDevice('router', 'R2', 540, 180);

      r1.config.interfaces['Gi0/0'].ip = '192.168.1.1';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r1.config.interfaces['Gi0/0'].status = 'up';
      r1.config.interfaces['Gi0/1'].ip = '10.0.0.1';
      r1.config.interfaces['Gi0/1'].mask = '255.255.255.252';
      r1.config.interfaces['Gi0/1'].status = 'up';

      r2.config.interfaces['Gi0/0'].ip = '192.168.2.1';
      r2.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r2.config.interfaces['Gi0/0'].status = 'up';
      r2.config.interfaces['Gi0/1'].ip = '10.0.0.2';
      r2.config.interfaces['Gi0/1'].mask = '255.255.255.252';
      r2.config.interfaces['Gi0/1'].status = 'up';

      const links: Link[] = [
        {
          id: 'link_r1_r2_ospf',
          fromDevice: r1.id,
          fromPort: 'Gi0/1',
          toDevice: r2.id,
          toPort: 'Gi0/1',
          cable: 'crossover',
        },
      ];

      return { devices: [r1, r2], links };
    },
    validate: (devices) => {
      const r1 = devices.find((d) => d.name === 'R1');
      const r2 = devices.find((d) => d.name === 'R2');

      const r1Ospf = r1?.config.ospf?.networks.some((n) => n.network.startsWith('10.0.0') && n.area === 0);
      const r2Ospf = r2?.config.ospf?.networks.some((n) => n.network.startsWith('10.0.0') && n.area === 0);

      const c1 = {
        name: 'R1 OSPF Process 1 configured with Area 0',
        passed: !!r1Ospf,
        message: 'Configure "router ospf 1" and network statements on R1',
      };
      const c2 = {
        name: 'R2 OSPF Process 1 configured with Area 0',
        passed: !!r2Ospf,
        message: 'Configure "router ospf 1" and network statements on R2',
      };

      const criteria = [c1, c2];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
  },
  {
    id: 'lab-7-dhcp-server',
    title: '7. DHCP Server & Dynamic Pool Configuration',
    category: 'CCNA Services',
    difficulty: 'Intermediate',
    summary: 'Configure router DHCP services providing dynamic IPv4 configuration to workstation clients.',
    objective: 'Define an IP DHCP pool `LAN-POOL` with network 192.168.1.0/24, default-router 192.168.1.1, and dns-server 8.8.8.8.',
    instructions: [
      'On Router0: `ip dhcp pool LAN-POOL`.',
      'Specify network: `network 192.168.1.0 255.255.255.0`.',
      'Specify gateway: `default-router 192.168.1.1`.',
      'Specify DNS: `dns-server 8.8.8.8`.',
      'Open PC0 IP settings and toggle to "DHCP Client" to receive lease.',
    ],
    initialTopology: () => {
      const r0 = createDevice('router', 'Router0', 380, 140);
      const sw0 = createDevice('switch', 'Switch0', 380, 260);
      const pc0 = createDevice('pc', 'PC0', 380, 380);

      r0.config.interfaces['Gi0/0'].ip = '192.168.1.1';
      r0.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r0.config.interfaces['Gi0/0'].status = 'up';

      const links: Link[] = [
        {
          id: 'link_r0_sw0',
          fromDevice: r0.id,
          fromPort: 'Gi0/0',
          toDevice: sw0.id,
          toPort: 'Gi0/1',
          cable: 'straight',
        },
        {
          id: 'link_pc0_sw0',
          fromDevice: pc0.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/1',
          cable: 'straight',
        },
      ];

      return { devices: [r0, sw0, pc0], links };
    },
    validate: (devices) => {
      const r0 = devices.find((d) => d.name === 'Router0');
      const pool = r0?.config.dhcpPools ? Object.values(r0.config.dhcpPools)[0] : undefined;

      const c1 = {
        name: 'DHCP Pool configured on Router0',
        passed: !!pool,
        message: 'Create a DHCP pool using "ip dhcp pool <name>"',
      };
      const c2 = {
        name: 'Pool network set to 192.168.1.0/24',
        passed: pool?.network === '192.168.1.0' && pool?.mask === '255.255.255.0',
        message: 'Define pool network: network 192.168.1.0 255.255.255.0',
      };
      const c3 = {
        name: 'Default router set to 192.168.1.1',
        passed: pool?.defaultRouter === '192.168.1.1',
        message: 'Set default-router 192.168.1.1',
      };

      const criteria = [c1, c2, c3];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
  },
  {
    id: 'lab-8-port-security',
    title: '8. Switchport Port Security',
    category: 'CCNA Security',
    difficulty: 'Intermediate',
    summary: 'Harden access ports against MAC address flooding and unauthorized device connections.',
    objective: 'Enable port-security with maximum 1 MAC and violation shutdown on Switch0 Fa0/1.',
    instructions: [
      'On Switch0: `interface Fa0/1`.',
      'Set access mode: `switchport mode access`.',
      'Enable port security: `switchport port-security`.',
      'Set max MACs: `switchport port-security maximum 1`.',
    ],
    initialTopology: () => {
      const sw0 = createDevice('switch', 'Switch0', 380, 200);
      const pc0 = createDevice('pc', 'PC0', 200, 200);

      const links: Link[] = [
        {
          id: 'link_pc0_sw0',
          fromDevice: pc0.id,
          fromPort: 'Fa0/0',
          toDevice: sw0.id,
          toPort: 'Fa0/1',
          cable: 'straight',
        },
      ];

      return { devices: [sw0, pc0], links };
    },
    validate: (devices) => {
      const sw0 = devices.find((d) => d.name === 'Switch0');
      const pSec = sw0?.config.interfaces['Fa0/1']?.portSecurity;

      const c1 = {
        name: 'Port Security enabled on Fa0/1',
        passed: !!pSec?.enabled,
        message: 'Execute "switchport port-security" on interface Fa0/1',
      };
      const c2 = {
        name: 'Maximum MAC addresses set to 1',
        passed: pSec?.maxMacs === 1,
        message: 'Execute "switchport port-security maximum 1"',
      };

      const criteria = [c1, c2];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
  },
  {
    id: 'lab-9-stp-tuning',
    title: '9. STP Root Bridge Priority Tuning',
    category: 'CCNA Switching',
    difficulty: 'Intermediate',
    summary: 'Elect a designated switch as the STP Root Bridge by manipulating the bridge priority value.',
    objective: 'Lower Switch0 priority to 4096 so it wins the Root Bridge election over Switch1 and Switch2.',
    instructions: [
      'In a 3-switch redundant loop, the switch with lowest Bridge ID becomes Root.',
      'On Switch0: `spanning-tree vlan 1 priority 4096`.',
      'Verify with `show spanning-tree` that Switch0 reports "This bridge is the root".',
    ],
    initialTopology: () => {
      const sw0 = createDevice('switch', 'Switch0', 380, 100);
      const sw1 = createDevice('switch', 'Switch1', 220, 320);
      const sw2 = createDevice('switch', 'Switch2', 540, 320);

      const links: Link[] = [
        {
          id: 'link_sw0_sw1',
          fromDevice: sw0.id,
          fromPort: 'Fa0/1',
          toDevice: sw1.id,
          toPort: 'Fa0/1',
          cable: 'crossover',
        },
        {
          id: 'link_sw0_sw2',
          fromDevice: sw0.id,
          fromPort: 'Fa0/2',
          toDevice: sw2.id,
          toPort: 'Fa0/2',
          cable: 'crossover',
        },
        {
          id: 'link_sw1_sw2',
          fromDevice: sw1.id,
          fromPort: 'Fa0/24',
          toDevice: sw2.id,
          toPort: 'Fa0/24',
          cable: 'crossover',
        },
      ];

      return { devices: [sw0, sw1, sw2], links };
    },
    validate: (devices) => {
      const sw0 = devices.find((d) => d.name === 'Switch0');

      const c1 = {
        name: 'Switch0 Bridge Priority set to 4096',
        passed: sw0?.config.spanningTreePriority === 4096,
        message: 'Execute "spanning-tree vlan 1 priority 4096" on Switch0',
      };

      const criteria = [c1];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
  },
  {
    id: 'lab-10-comprehensive-capstone',
    title: '10. Enterprise Branch Office Capstone',
    category: 'CCNA Capstone',
    difficulty: 'Advanced',
    summary: 'Comprehensive lab integrating VLANs, 802.1Q trunks, subinterfaces, static default routes, and DHCP.',
    objective: 'Complete the full end-to-end branch topology configuration connecting PC0 and Server0.',
    instructions: [
      'Configure Router0 subinterface Gi0/0.10: `encapsulation dot1Q 10`, `ip address 10.0.10.1 255.255.255.0`.',
      'Configure Router0 interface Gi0/1 (WAN): `ip address 203.0.113.1 255.255.255.252`, `no shutdown`.',
      'Add default route on Router0: `ip route 0.0.0.0 0.0.0.0 203.0.113.2`.',
      'Configure Switch0 Gi0/1 as trunk port.',
      'Assign PC0 to VLAN 10 with IP 10.0.10.50 and default gateway 10.0.10.1.',
    ],
    initialTopology: () => {
      const r0 = createDevice('router', 'Router0', 380, 140);
      const sw0 = createDevice('switch', 'Switch0', 220, 260);
      const pc0 = createDevice('pc', 'PC0', 100, 380);
      const srv = createDevice('server', 'Server0', 580, 140);

      srv.config.interfaces['Fa0/0'].ip = '203.0.113.2';
      srv.config.interfaces['Fa0/0'].mask = '255.255.255.252';
      srv.config.interfaces['Fa0/0'].status = 'up';

      const links: Link[] = [
        {
          id: 'link_r0_sw0',
          fromDevice: r0.id,
          fromPort: 'Gi0/0',
          toDevice: sw0.id,
          toPort: 'Gi0/1',
          cable: 'straight',
        },
        {
          id: 'link_sw0_pc0',
          fromDevice: sw0.id,
          fromPort: 'Fa0/1',
          toDevice: pc0.id,
          toPort: 'Fa0/0',
          cable: 'straight',
        },
        {
          id: 'link_r0_srv',
          fromDevice: r0.id,
          fromPort: 'Gi0/1',
          toDevice: srv.id,
          toPort: 'Fa0/0',
          cable: 'crossover',
        },
      ];

      return { devices: [r0, sw0, pc0, srv], links };
    },
    validate: (devices) => {
      const r0 = devices.find((d) => d.name === 'Router0');
      const sw0 = devices.find((d) => d.name === 'Switch0');

      const sub10 = r0?.config.interfaces['Gi0/0.10'];
      const defaultRoute = r0?.config.routes.find((r) => r.network === '0.0.0.0');

      const c1 = {
        name: 'Router0 subinterface Gi0/0.10 configured',
        passed: sub10?.encapsulationDot1Q === 10 && sub10?.ip === '10.0.10.1',
        message: 'Configure Gi0/0.10 with dot1Q 10 and IP 10.0.10.1/24',
      };
      const c2 = {
        name: 'Router0 default route (0.0.0.0/0) via 203.0.113.2',
        passed: !!defaultRoute,
        message: 'Add default route: ip route 0.0.0.0 0.0.0.0 203.0.113.2',
      };
      const c3 = {
        name: 'Switch0 Gi0/1 configured as trunk',
        passed: sw0?.config.interfaces['Gi0/1']?.mode === 'trunk',
        message: 'Set Switch0 Gi0/1 to switchport mode trunk',
      };

      const criteria = [c1, c2, c3];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
  },
];
