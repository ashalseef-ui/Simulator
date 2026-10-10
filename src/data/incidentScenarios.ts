import { Device, Link } from '../types/network';
import { createDevice } from '../engine/deviceSpecs';

export interface IncidentScenario {
  id: string;
  ticketId: string;
  title: string;
  category: 'Layer 2 & STP' | 'Routing & OSPF' | 'Inter-VLAN & Trunking' | 'Security & ACL' | 'Network Services & DHCP' | 'Static Routing & Gateways';
  severity: 'P1 - Critical' | 'P2 - Major' | 'P3 - Moderate';
  difficulty: 'CCNA Associate' | 'CCNA Advanced' | 'CCNP Triage';
  slaMinutes: number;
  organization: string;
  summary: string;
  symptoms: string[];
  objective: string;
  topologySummary: string;
  initialTopology: () => { devices: Device[]; links: Link[] };
  validate: (devices: Device[], links: Link[]) => {
    passed: boolean;
    score: number;
    criteria: { name: string; passed: boolean; message: string }[];
  };
  hints: {
    level1: string; // Triage Clue
    level2: string; // Diagnostic Show/Debug commands
    level3: string; // Configuration commands
  };
}

export const INCIDENT_SCENARIOS: IncidentScenario[] = [
  {
    id: 'inc-101-ospf-mtu-adjacency',
    ticketId: 'INC-849201',
    title: 'Core OSPF Adjacency Failure & Hello Mismatch',
    category: 'Routing & OSPF',
    severity: 'P1 - Critical',
    difficulty: 'CCNA Advanced',
    slaMinutes: 15,
    organization: 'Apex Global Financial Services',
    summary: 'Branch Router R1 lost OSPF adjacency with Core Router R2 following a scheduled maintenance window. High-frequency trade routes are blackholed.',
    symptoms: [
      'OSPF neighbor status stuck in INIT or EXSTART state on R1 and R2.',
      'Routing table on R1 missing routes to the 10.200.0.0/24 Core Datacenter network.',
      'ICMP ping from Branch-PC to Core-Server (10.200.0.10) fails with 100% packet loss.',
    ],
    objective: 'Restore full OSPF adjacency (FULL/DR or FULL/BDR) between R1 and R2 on network 10.0.0.0/30 and establish end-to-end reachability.',
    topologySummary: 'Branch-PC <-> Switch-Branch <-> R1 (Branch) <== Serial/Gig Link ==> R2 (Core) <-> Switch-Core <-> Datacenter-Server',
    initialTopology: () => {
      const pc = createDevice('pc', 'Branch-PC', 80, 220);
      pc.config.interfaces['Fa0/0'].ip = '192.168.10.10';
      pc.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc.config.defaultGateway = '192.168.10.1';

      const sw1 = createDevice('switch', 'SW-Branch', 220, 220);

      const r1 = createDevice('router', 'R1-Branch', 380, 220);
      r1.config.hostname = 'R1-Branch';
      r1.config.interfaces['Gi0/0'].ip = '192.168.10.1';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r1.config.interfaces['Gi0/1'].ip = '10.0.0.1';
      r1.config.interfaces['Gi0/1'].mask = '255.255.255.252';
      r1.config.interfaces['Gi0/1'].ospfHelloInterval = 10;
      r1.config.interfaces['Gi0/1'].ospfDeadInterval = 40;
      r1.config.ospf = {
        processId: 1,
        networks: [
          { network: '192.168.10.0', wildcard: '0.0.0.255', area: 0 },
          { network: '10.0.0.0', wildcard: '0.0.0.3', area: 0 },
        ],
      };

      const r2 = createDevice('router', 'R2-Core', 580, 220);
      r2.config.hostname = 'R2-Core';
      r2.config.interfaces['Gi0/0'].ip = '10.0.0.2';
      r2.config.interfaces['Gi0/0'].mask = '255.255.255.252';
      r2.config.interfaces['Gi0/1'].ip = '10.200.0.1';
      r2.config.interfaces['Gi0/1'].mask = '255.255.255.0';
      // INCIDENT INJECTION: Hello timer misconfigured to 30 on R2 Gi0/0 causing timer mismatch drop
      r2.config.interfaces['Gi0/0'].ospfHelloInterval = 30;
      r2.config.interfaces['Gi0/0'].ospfDeadInterval = 120;
      // Also missing OSPF network statement for 10.0.0.0 on R2
      r2.config.ospf = {
        processId: 1,
        networks: [
          { network: '10.200.0.0', wildcard: '0.0.0.255', area: 0 },
        ],
      };

      const sw2 = createDevice('switch', 'SW-Core', 740, 220);

      const srv = createDevice('server', 'Core-Server', 880, 220);
      srv.config.interfaces['Fa0/0'].ip = '10.200.0.10';
      srv.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      srv.config.defaultGateway = '10.200.0.1';

      const links: Link[] = [
        { id: 'l1', fromDevice: pc.id, fromPort: 'Fa0/0', toDevice: sw1.id, toPort: 'Fa0/1', cable: 'straight' },
        { id: 'l2', fromDevice: sw1.id, fromPort: 'Gi0/1', toDevice: r1.id, toPort: 'Gi0/0', cable: 'straight' },
        { id: 'l3', fromDevice: r1.id, fromPort: 'Gi0/1', toDevice: r2.id, toPort: 'Gi0/0', cable: 'crossover' },
        { id: 'l4', fromDevice: r2.id, fromPort: 'Gi0/1', toDevice: sw2.id, toPort: 'Gi0/1', cable: 'straight' },
        { id: 'l5', fromDevice: sw2.id, fromPort: 'Fa0/1', toDevice: srv.id, toPort: 'Fa0/0', cable: 'straight' },
      ];

      return { devices: [pc, sw1, r1, r2, sw2, srv], links };
    },
    validate: (devices) => {
      const r2 = devices.find((d) => d.config.hostname === 'R2-Core' || d.name === 'R2-Core');
      const r1 = devices.find((d) => d.config.hostname === 'R1-Branch' || d.name === 'R1-Branch');

      const hasOspfNetOnR2 = r2?.config.ospf?.networks.some((n) => n.network === '10.0.0.0' || n.network === '10.0.0.2');
      const helloTimerMatch = r2?.config.interfaces['Gi0/0']?.ospfHelloInterval === 10 || !r2?.config.interfaces['Gi0/0']?.ospfHelloInterval;

      const c1 = {
        name: 'R2 OSPF network 10.0.0.0/30 area 0 configured',
        passed: !!hasOspfNetOnR2,
        message: 'Add "network 10.0.0.0 0.0.0.3 area 0" under "router ospf 1" on R2-Core.',
      };
      const c2 = {
        name: 'R2 Gi0/0 OSPF Hello interval matched to 10s',
        passed: !!helloTimerMatch,
        message: 'Run "interface Gi0/0" -> "ip ospf hello-interval 10" on R2-Core.',
      };
      const c3 = {
        name: 'R1 and R2 both running IP Routing',
        passed: !!r1?.config.ipRoutingEnabled && !!r2?.config.ipRoutingEnabled,
        message: 'Ensure "ip routing" is enabled on both routers.',
      };

      const criteria = [c1, c2, c3];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
    hints: {
      level1: 'OSPF adjacencies require matching Hello/Dead timers and a network statement covering the transit link subnet on BOTH routers.',
      level2: 'Execute "show ip ospf neighbor" and "show ip ospf interface Gi0/0" on R1 and R2 to compare timer intervals and area IDs.',
      level3: 'On R2-Core:\n  interface Gi0/0\n  ip ospf hello-interval 10\n  router ospf 1\n  network 10.0.0.0 0.0.0.3 area 0',
    },
  },
  {
    id: 'inc-102-stp-root-hijack',
    ticketId: 'INC-910411',
    title: 'Campus STP Root Bridge Hijack & Suboptimal Forwarding',
    category: 'Layer 2 & STP',
    severity: 'P1 - Critical',
    difficulty: 'CCNA Associate',
    slaMinutes: 10,
    organization: 'Metro Health Hospital Network',
    summary: 'A newly plugged access switch has usurped the Spanning Tree Root Bridge role from the Distribution Core Switch, causing high latency and blocked uplink paths.',
    symptoms: [
      'Core switch SW-Core is showing Root ID pointing to an unmanaged access switch.',
      'High-bandwidth uplinks between SW-Core and SW-Dist are blocked by STP (BLK state).',
      'Host medical telemetry stations experiencing erratic delay.',
    ],
    objective: 'Re-assert SW-Core as the Spanning Tree Root Bridge for VLAN 1 with priority 4096 (or 0) so that all core uplinks transition to Forwarding (FWD).',
    topologySummary: 'SW-Access-Rogue (Prio 4096) <== Trunk ==> SW-Core (Prio 32768) <== Trunk ==> SW-Dist (Prio 32768)',
    initialTopology: () => {
      const swRogue = createDevice('switch', 'SW-Access-Rogue', 180, 220);
      swRogue.config.hostname = 'SW-Access-Rogue';
      swRogue.config.spanningTreePriority = 4096; // Rogue lower priority!

      const swCore = createDevice('switch', 'SW-Core', 480, 140);
      swCore.config.hostname = 'SW-Core';
      swCore.config.spanningTreePriority = 32768;

      const swDist = createDevice('switch', 'SW-Dist', 480, 320);
      swDist.config.hostname = 'SW-Dist';
      swDist.config.spanningTreePriority = 32768;

      const pc = createDevice('pc', 'Telemetry-PC', 750, 220);
      pc.config.interfaces['Fa0/0'].ip = '10.10.1.50';
      pc.config.interfaces['Fa0/0'].mask = '255.255.255.0';

      const links: Link[] = [
        { id: 'l1', fromDevice: swRogue.id, fromPort: 'Gi0/1', toDevice: swCore.id, toPort: 'Gi0/1', cable: 'crossover' },
        { id: 'l2', fromDevice: swRogue.id, fromPort: 'Gi0/2', toDevice: swDist.id, toPort: 'Gi0/1', cable: 'crossover' },
        { id: 'l3', fromDevice: swCore.id, fromPort: 'Gi0/2', toDevice: swDist.id, toPort: 'Gi0/2', cable: 'crossover' },
        { id: 'l4', fromDevice: swDist.id, fromPort: 'Fa0/1', toDevice: pc.id, toPort: 'Fa0/0', cable: 'straight' },
      ];

      return { devices: [swRogue, swCore, swDist, pc], links };
    },
    validate: (devices) => {
      const swCore = devices.find((d) => d.config.hostname === 'SW-Core' || d.name === 'SW-Core');
      const swRogue = devices.find((d) => d.config.hostname === 'SW-Access-Rogue' || d.name === 'SW-Access-Rogue');

      const corePrio = swCore?.config.spanningTreePriority ?? 32768;
      const roguePrio = swRogue?.config.spanningTreePriority ?? 32768;

      const c1 = {
        name: 'SW-Core configured with lower bridge priority than SW-Access-Rogue',
        passed: corePrio < roguePrio,
        message: 'Set "spanning-tree vlan 1 priority 0" or 4096 on SW-Core and ensure it is lower than SW-Access-Rogue.',
      };
      const c2 = {
        name: 'SW-Core priority is a multiple of 4096 (0, 4096, 8192)',
        passed: corePrio % 4096 === 0,
        message: 'Bridge priority must strictly be an increment of 4096.',
      };

      const criteria = [c1, c2];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
    hints: {
      level1: 'The switch with the lowest numeric Bridge ID (Priority + MAC) becomes the Root Bridge for the Spanning Tree domain.',
      level2: 'Run "show spanning-tree" on SW-Core to check the current Root ID and Bridge ID priority.',
      level3: 'On SW-Core:\n  configure terminal\n  spanning-tree vlan 1 priority 0\n  end\n  write memory',
    },
  },
  {
    id: 'inc-103-inter-vlan-dot1q-mismatch',
    ticketId: 'INC-773190',
    title: 'Router-on-a-Stick 802.1Q Subinterface Tagging Mismatch',
    category: 'Inter-VLAN & Trunking',
    severity: 'P2 - Major',
    difficulty: 'CCNA Associate',
    slaMinutes: 12,
    organization: 'FinTech Cloud Operations',
    summary: 'Finance workstations on VLAN 10 cannot communicate with Marketing on VLAN 20. The Router-on-a-Stick subinterface has mismatched 802.1Q encapsulation.',
    symptoms: [
      'Finance PC (192.168.10.10) cannot ping its default gateway 192.168.10.1.',
      'Marketing PC (192.168.20.10) can ping gateway 192.168.20.1 but cannot reach Finance.',
      'ARP request packets from VLAN 10 are dropped at the router trunk interface.',
    ],
    objective: 'Correct the subinterface encapsulation on Router0 (Gi0/0.10) so it matches VLAN 10 tagging and restores Inter-VLAN routing.',
    topologySummary: 'PC-Finance (VLAN 10) + PC-Marketing (VLAN 20) -> SW0 (Trunk) -> Router0 (Gi0/0.10 & Gi0/0.20)',
    initialTopology: () => {
      const pcFin = createDevice('pc', 'PC-Finance', 140, 140);
      pcFin.config.interfaces['Fa0/0'].ip = '192.168.10.10';
      pcFin.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pcFin.config.defaultGateway = '192.168.10.1';

      const pcMkt = createDevice('pc', 'PC-Marketing', 140, 300);
      pcMkt.config.interfaces['Fa0/0'].ip = '192.168.20.10';
      pcMkt.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pcMkt.config.defaultGateway = '192.168.20.1';

      const sw = createDevice('switch', 'SW-Access', 380, 220);
      sw.config.vlans = {
        1: { id: 1, name: 'default' },
        10: { id: 10, name: 'Finance' },
        20: { id: 20, name: 'Marketing' },
      };
      sw.config.interfaces['Fa0/1'].mode = 'access';
      sw.config.interfaces['Fa0/1'].accessVlan = 10;
      sw.config.interfaces['Fa0/2'].mode = 'access';
      sw.config.interfaces['Fa0/2'].accessVlan = 20;
      sw.config.interfaces['Gi0/1'].mode = 'trunk';

      const rtr = createDevice('router', 'Router-RaaS', 640, 220);
      rtr.config.hostname = 'Router-RaaS';
      rtr.config.interfaces['Gi0/0'].status = 'up';

      // INCIDENT: Gi0/0.10 is incorrectly tagged with encapsulation dot1Q 30 or 20 instead of 10!
      rtr.config.interfaces['Gi0/0.10'] = {
        name: 'Gi0/0.10',
        mac: '00:1c:b1:00:10:01',
        ip: '192.168.10.1',
        mask: '255.255.255.0',
        status: 'up',
        speed: 1000,
        mode: 'routed',
        encapsulationDot1Q: 30, // BUG!
      };
      rtr.config.interfaces['Gi0/0.20'] = {
        name: 'Gi0/0.20',
        mac: '00:1c:b1:00:20:01',
        ip: '192.168.20.1',
        mask: '255.255.255.0',
        status: 'up',
        speed: 1000,
        mode: 'routed',
        encapsulationDot1Q: 20,
      };

      const links: Link[] = [
        { id: 'l1', fromDevice: pcFin.id, fromPort: 'Fa0/0', toDevice: sw.id, toPort: 'Fa0/1', cable: 'straight' },
        { id: 'l2', fromDevice: pcMkt.id, fromPort: 'Fa0/0', toDevice: sw.id, toPort: 'Fa0/2', cable: 'straight' },
        { id: 'l3', fromDevice: sw.id, fromPort: 'Gi0/1', toDevice: rtr.id, toPort: 'Gi0/0', cable: 'straight' },
      ];

      return { devices: [pcFin, pcMkt, sw, rtr], links };
    },
    validate: (devices) => {
      const rtr = devices.find((d) => d.config.hostname === 'Router-RaaS' || d.name === 'Router-RaaS');
      const if10 = rtr?.config.interfaces['Gi0/0.10'];
      const if20 = rtr?.config.interfaces['Gi0/0.20'];

      const c1 = {
        name: 'Gi0/0.10 configured with encapsulation dot1Q 10',
        passed: if10?.encapsulationDot1Q === 10,
        message: 'On Router-RaaS: "interface Gi0/0.10" -> "encapsulation dot1Q 10" -> "ip address 192.168.10.1 255.255.255.0"',
      };
      const c2 = {
        name: 'Gi0/0.10 IP address is 192.168.10.1/24',
        passed: if10?.ip === '192.168.10.1' && if10?.mask === '255.255.255.0',
        message: 'Verify Gi0/0.10 has IP 192.168.10.1 255.255.255.0.',
      };
      const c3 = {
        name: 'Gi0/0.20 configured with encapsulation dot1Q 20',
        passed: if20?.encapsulationDot1Q === 20 && if20?.ip === '192.168.20.1',
        message: 'Ensure Gi0/0.20 retains valid dot1Q 20 encapsulation and IP.',
      };

      const criteria = [c1, c2, c3];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
    hints: {
      level1: 'Each subinterface on a Router-on-a-Stick trunk requires the "encapsulation dot1Q <vlan-id>" command matching the client access VLAN.',
      level2: 'Use "show running-config" on Router-RaaS to inspect the encapsulation dot1Q tags for Gi0/0.10 and Gi0/0.20.',
      level3: 'On Router-RaaS:\n  interface Gi0/0.10\n  encapsulation dot1Q 10\n  ip address 192.168.10.1 255.255.255.0\n  no shutdown',
    },
  },
  {
    id: 'inc-104-acl-implicit-deny-lockout',
    ticketId: 'INC-652940',
    title: 'Access Policy Lockout - Implicit Deny Blocking DNS & HTTP Traffic',
    category: 'Security & ACL',
    severity: 'P1 - Critical',
    difficulty: 'CCNA Advanced',
    slaMinutes: 15,
    organization: 'Global Retail Commerce Corp',
    summary: 'A new security policy ACL applied to the border router inbound interface dropped all customer e-commerce web queries due to ACL ordering and missing permit statements.',
    symptoms: [
      'Customer hosts can no longer access Public-Web-Server (203.0.113.80).',
      'Router access-list 101 match counters show thousands of dropped packets.',
      'ICMP diagnostics and web connections time out with destination unreachable.',
    ],
    objective: 'Reconfigure Access List 101 on Border-Router to permit legitimate HTTP/IP traffic from internal subnet 192.168.1.0/24.',
    topologySummary: 'PC-Client -> Switch0 -> Border-Router (ACL 101 on Gi0/0) -> Cloud -> Web-Server',
    initialTopology: () => {
      const pc = createDevice('pc', 'PC-Client', 120, 220);
      pc.config.interfaces['Fa0/0'].ip = '192.168.1.50';
      pc.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc.config.defaultGateway = '192.168.1.1';

      const sw = createDevice('switch', 'Switch-LAN', 320, 220);

      const rtr = createDevice('router', 'Border-Router', 520, 220);
      rtr.config.hostname = 'Border-Router';
      rtr.config.interfaces['Gi0/0'].ip = '192.168.1.1';
      rtr.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      rtr.config.interfaces['Gi0/0'].accessGroupIn = '101';
      rtr.config.interfaces['Gi0/1'].ip = '203.0.113.1';
      rtr.config.interfaces['Gi0/1'].mask = '255.255.255.0';

      // INCIDENT: ACL 101 only denies telnet, and implicit deny at the end blocks everything else!
      rtr.config.accessLists = {
        '101': {
          idOrName: '101',
          type: 'extended',
          rules: [
            { action: 'deny', source: 'host 192.168.1.99', protocol: 'ip', matchCount: 42 },
            { action: 'deny', source: 'any', protocol: 'ip', matchCount: 1840 }, // BLOCKS ALL TRAFFIC!
          ],
        },
      };

      const srv = createDevice('server', 'Web-Server', 780, 220);
      srv.config.interfaces['Fa0/0'].ip = '203.0.113.80';
      srv.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      srv.config.defaultGateway = '203.0.113.1';

      const links: Link[] = [
        { id: 'l1', fromDevice: pc.id, fromPort: 'Fa0/0', toDevice: sw.id, toPort: 'Fa0/1', cable: 'straight' },
        { id: 'l2', fromDevice: sw.id, fromPort: 'Gi0/1', toDevice: rtr.id, toPort: 'Gi0/0', cable: 'straight' },
        { id: 'l3', fromDevice: rtr.id, fromPort: 'Gi0/1', toDevice: srv.id, toPort: 'Fa0/0', cable: 'straight' },
      ];

      return { devices: [pc, sw, rtr, srv], links };
    },
    validate: (devices) => {
      const rtr = devices.find((d) => d.config.hostname === 'Border-Router' || d.name === 'Border-Router');
      const acl101 = rtr?.config.accessLists?.['101'];

      const hasPermit = acl101?.rules.some((r) => r.action === 'permit' && (r.source.includes('any') || r.source.includes('192.168.1')));

      const c1 = {
        name: 'ACL 101 contains a permit rule for LAN or any traffic',
        passed: !!hasPermit,
        message: 'Add "access-list 101 permit ip 192.168.1.0 0.0.0.255 any" or "access-list 101 permit ip any any".',
      };
      const c2 = {
        name: 'ACL 101 does not unconditionally deny all IP traffic before permits',
        passed: !acl101?.rules.some((r, idx) => r.action === 'deny' && r.source === 'any' && idx < acl101.rules.length - 1),
        message: 'Remove unconditional deny any any rules positioned before permit rules.',
      };

      const criteria = [c1, c2];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
    hints: {
      level1: 'Standard ACLs process rules top-down and have an implicit "deny ip any any" at the bottom of every list.',
      level2: 'Execute "show access-lists" and "show ip interface Gi0/0" on Border-Router to check applied access groups.',
      level3: 'On Border-Router:\n  configure terminal\n  access-list 101 permit ip 192.168.1.0 0.0.0.255 any\n  access-list 101 permit ip any any',
    },
  },
  {
    id: 'inc-105-asymmetric-route-blackhole',
    ticketId: 'INC-549102',
    title: 'Asymmetric Static Route & Next-Hop Blackhole',
    category: 'Static Routing & Gateways',
    severity: 'P2 - Major',
    difficulty: 'CCNA Associate',
    slaMinutes: 10,
    organization: 'Continental Energy & Power Grid',
    summary: 'Branch Router R1 can send packets toward Remote Substation R2, but return traffic is dropped because R2 has a static route pointing to an invalid next-hop IP.',
    symptoms: [
      'Pings from Branch-PC to Remote-PC send 5 requests but receive 0 replies (0% success).',
      'Traceroute reaches R2 interface but halts on the return path.',
      'Routing table on R2 shows static route via non-existent IP 10.0.0.99.',
    ],
    objective: 'Remove the invalid static route on R2 and install the correct next-hop address pointing back to R1 (10.0.0.1).',
    topologySummary: 'PC-Branch -> R1 (10.0.0.1/30) <== Link ==> R2 (10.0.0.2/30) -> PC-Remote',
    initialTopology: () => {
      const pc1 = createDevice('pc', 'PC-Branch', 120, 220);
      pc1.config.interfaces['Fa0/0'].ip = '172.16.1.10';
      pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc1.config.defaultGateway = '172.16.1.1';

      const r1 = createDevice('router', 'R1-Branch', 340, 220);
      r1.config.hostname = 'R1-Branch';
      r1.config.interfaces['Gi0/0'].ip = '172.16.1.1';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r1.config.interfaces['Gi0/1'].ip = '10.0.0.1';
      r1.config.interfaces['Gi0/1'].mask = '255.255.255.252';
      r1.config.routes = [
        { network: '172.16.2.0', mask: '255.255.255.0', nextHop: '10.0.0.2' },
      ];

      const r2 = createDevice('router', 'R2-Remote', 560, 220);
      r2.config.hostname = 'R2-Remote';
      r2.config.interfaces['Gi0/0'].ip = '10.0.0.2';
      r2.config.interfaces['Gi0/0'].mask = '255.255.255.252';
      r2.config.interfaces['Gi0/1'].ip = '172.16.2.1';
      r2.config.interfaces['Gi0/1'].mask = '255.255.255.0';
      // INCIDENT: R2 has wrong next hop 10.0.0.99!
      r2.config.routes = [
        { network: '172.16.1.0', mask: '255.255.255.0', nextHop: '10.0.0.99' },
      ];

      const pc2 = createDevice('pc', 'PC-Remote', 780, 220);
      pc2.config.interfaces['Fa0/0'].ip = '172.16.2.10';
      pc2.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc2.config.defaultGateway = '172.16.2.1';

      const links: Link[] = [
        { id: 'l1', fromDevice: pc1.id, fromPort: 'Fa0/0', toDevice: r1.id, toPort: 'Gi0/0', cable: 'straight' },
        { id: 'l2', fromDevice: r1.id, fromPort: 'Gi0/1', toDevice: r2.id, toPort: 'Gi0/0', cable: 'crossover' },
        { id: 'l3', fromDevice: r2.id, fromPort: 'Gi0/1', toDevice: pc2.id, toPort: 'Fa0/0', cable: 'straight' },
      ];

      return { devices: [pc1, r1, r2, pc2], links };
    },
    validate: (devices) => {
      const r2 = devices.find((d) => d.config.hostname === 'R2-Remote' || d.name === 'R2-Remote');
      const routeTo172 = r2?.config.routes?.find((r) => r.network === '172.16.1.0');

      const c1 = {
        name: 'R2-Remote has static route to 172.16.1.0/24 with valid next-hop 10.0.0.1',
        passed: routeTo172?.nextHop === '10.0.0.1',
        message: 'On R2-Remote: "no ip route 172.16.1.0 255.255.255.0 10.0.0.99" followed by "ip route 172.16.1.0 255.255.255.0 10.0.0.1".',
      };

      const criteria = [c1];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
    hints: {
      level1: 'Two-way IP communication requires valid routing in BOTH forward and reverse directions.',
      level2: 'Run "show ip route" on R2-Remote and inspect the next-hop address for 172.16.1.0/24.',
      level3: 'On R2-Remote:\n  configure terminal\n  no ip route 172.16.1.0 255.255.255.0 10.0.0.99\n  ip route 172.16.1.0 255.255.255.0 10.0.0.1',
    },
  },
  {
    id: 'inc-106-dhcp-snooping-untrusted',
    ticketId: 'INC-402819',
    title: 'Enterprise DHCP Snooping Untrusted Uplink Drop',
    category: 'Network Services & DHCP',
    severity: 'P3 - Moderate',
    difficulty: 'CCNA Advanced',
    slaMinutes: 12,
    organization: 'Skyline Aerospace Engineering',
    summary: 'DHCP Snooping was activated across Campus Access Switches, but the uplink port connected to the Central DHCP Server was left untrusted, dropping all DHCP Offer packets.',
    symptoms: [
      'Client PCs configured for DHCP fail with APIPA (169.254.x.x) or unassigned IP.',
      'DHCP Discover frames reach the server, but DHCP Offer frames are discarded at Switch0 Gi0/1.',
      'Switch DHCP snooping drop statistics are actively incrementing.',
    ],
    objective: 'Configure "ip dhcp snooping trust" on Switch0 uplink port Gi0/1 so legitimate DHCP server responses are forwarded to client hosts.',
    topologySummary: 'PC-Client -> SW0 (Access) <== Trunk (Untrusted) ==> DHCP-Server-Router',
    initialTopology: () => {
      const pc = createDevice('pc', 'Host-PC1', 140, 220);

      const sw = createDevice('switch', 'SW-Floor1', 400, 220);
      sw.config.hostname = 'SW-Floor1';
      sw.config.dhcpSnooping = {
        enabled: true,
        vlans: [1],
        bindings: [],
      };
      // INCIDENT: Gi0/1 is NOT trusted!
      sw.config.interfaces['Gi0/1'].dhcpSnoopingTrust = false;

      const rtr = createDevice('router', 'DHCP-Server', 680, 220);
      rtr.config.hostname = 'DHCP-Server';
      rtr.config.interfaces['Gi0/0'].ip = '192.168.1.1';
      rtr.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      rtr.config.dhcpPools = {
        'LAN_POOL': {
          name: 'LAN_POOL',
          network: '192.168.1.0',
          mask: '255.255.255.0',
          defaultRouter: '192.168.1.1',
          dnsServer: '8.8.8.8',
        },
      };

      const links: Link[] = [
        { id: 'l1', fromDevice: pc.id, fromPort: 'Fa0/0', toDevice: sw.id, toPort: 'Fa0/1', cable: 'straight' },
        { id: 'l2', fromDevice: sw.id, fromPort: 'Gi0/1', toDevice: rtr.id, toPort: 'Gi0/0', cable: 'straight' },
      ];

      return { devices: [pc, sw, rtr], links };
    },
    validate: (devices) => {
      const sw = devices.find((d) => d.config.hostname === 'SW-Floor1' || d.name === 'SW-Floor1');
      const isTrusted = sw?.config.interfaces['Gi0/1']?.dhcpSnoopingTrust;

      const c1 = {
        name: 'Switch SW-Floor1 Gi0/1 configured as DHCP Snooping Trusted port',
        passed: !!isTrusted,
        message: 'On SW-Floor1: "interface Gi0/1" -> "ip dhcp snooping trust".',
      };

      const criteria = [c1];
      const passedCount = criteria.filter((c) => c.passed).length;
      return {
        passed: passedCount === criteria.length,
        score: Math.round((passedCount / criteria.length) * 100),
        criteria,
      };
    },
    hints: {
      level1: 'When DHCP Snooping is enabled, all switchports default to untrusted and discard DHCP server Offer/ACK packets.',
      level2: 'Run "show ip dhcp snooping" on SW-Floor1 to see trusted vs untrusted interface statuses.',
      level3: 'On SW-Floor1:\n  configure terminal\n  interface Gi0/1\n  ip dhcp snooping trust\n  end',
    },
  },
];
