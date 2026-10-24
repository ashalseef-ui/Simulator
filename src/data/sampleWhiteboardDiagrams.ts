export interface SampleWhiteboardDiagram {
  id: string;
  title: string;
  description: string;
  category: string;
  dataUrl: string;
  rawAnalysis: {
    title: string;
    summary: string;
    overallConfidence: number;
    devices: Array<{
      name: string;
      type: string;
      confidence: number;
      x: number;
      y: number;
      notes?: string;
    }>;
    links: Array<{
      from: string;
      fromPort: string;
      to: string;
      toPort: string;
      cable: 'straight' | 'crossover' | 'serial';
      confidence: number;
      autoHealed: boolean;
      notes?: string;
    }>;
    warnings: string[];
  };
}

// Helper to generate clean whiteboard SVG data URIs
function makeWhiteboardSvg(content: string, width = 800, height = 480): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <pattern id="wb-grid" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" stroke-width="0.5" opacity="0.6"/>
      </pattern>
      <filter id="marker-rough">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" />
      </filter>
    </defs>
    <!-- Whiteboard Surface -->
    <rect width="${width}" height="${height}" fill="#f8fafc" />
    <rect width="${width}" height="${height}" fill="url(#wb-grid)" />
    <!-- Whiteboard Frame Edge -->
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="none" stroke="#94a3b8" stroke-width="4" rx="8" />
    <path d="M 20 20 L ${width - 20} 20" stroke="#cbd5e1" stroke-width="1" />
    <!-- Diagram Drawings -->
    <g filter="url(#marker-rough)">
      ${content}
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 1. Campus Core & Dual Distribution Whiteboard
const campusSvgContent = `
  <!-- Title in blue marker -->
  <text x="40" y="50" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0284c7">CAMPUS CORE + ACCESS ARCHITECTURE</text>
  <text x="40" y="75" font-family="sans-serif" font-size="12" fill="#64748b">Date: 2026-10-24 | VLAN 10 (Sales), VLAN 20 (Eng)</text>

  <!-- Core Switch (Center Top) -->
  <rect x="330" y="110" width="140" height="60" rx="8" fill="#e0f2fe" stroke="#0284c7" stroke-width="3" stroke-dasharray="none" />
  <text x="360" y="145" font-family="sans-serif" font-size="15" font-weight="bold" fill="#0369a1">Core-SW1</text>
  <text x="365" y="162" font-family="sans-serif" font-size="11" fill="#0284c7">(L3 Core Switch)</text>

  <!-- Access Switch 1 (Left) -->
  <rect x="140" y="240" width="130" height="55" rx="6" fill="#f0fdf4" stroke="#16a34a" stroke-width="3" />
  <text x="170" y="272" font-family="sans-serif" font-size="14" font-weight="bold" fill="#15803d">SW-Access-1</text>
  <text x="175" y="288" font-family="sans-serif" font-size="10" fill="#16a34a">VLAN 10 (Sales)</text>

  <!-- Access Switch 2 (Right) -->
  <rect x="530" y="240" width="130" height="55" rx="6" fill="#f0fdf4" stroke="#16a34a" stroke-width="3" />
  <text x="560" y="272" font-family="sans-serif" font-size="14" font-weight="bold" fill="#15803d">SW-Access-2</text>
  <text x="565" y="288" font-family="sans-serif" font-size="10" fill="#16a34a">VLAN 20 (Eng)</text>

  <!-- Workstations Bottom -->
  <rect x="100" y="370" width="90" height="50" rx="4" fill="#faf5ff" stroke="#9333ea" stroke-width="2.5" />
  <text x="125" y="400" font-family="sans-serif" font-size="13" font-weight="bold" fill="#7e22ce">PC-Sales</text>

  <rect x="220" y="370" width="90" height="50" rx="4" fill="#faf5ff" stroke="#9333ea" stroke-width="2.5" />
  <text x="235" y="400" font-family="sans-serif" font-size="13" font-weight="bold" fill="#7e22ce">Sales-Host2</text>

  <rect x="550" y="370" width="90" height="50" rx="4" fill="#faf5ff" stroke="#9333ea" stroke-width="2.5" />
  <text x="575" y="400" font-family="sans-serif" font-size="13" font-weight="bold" fill="#7e22ce">PC-Eng</text>

  <!-- Trunk Links with Hand-Drawn Port Labels -->
  <!-- Core to Acc1 -->
  <line x1="360" y1="170" x2="220" y2="240" stroke="#0f172a" stroke-width="2.5" />
  <text x="260" y="195" font-family="monospace" font-size="11" fill="#475569">Trunk Gi0/1-Fa0/24</text>

  <!-- Core to Acc2 -->
  <line x1="440" y1="170" x2="580" y2="240" stroke="#0f172a" stroke-width="2.5" />
  <text x="480" y="195" font-family="monospace" font-size="11" fill="#475569">Trunk Gi0/2-Fa0/24</text>

  <!-- Access 1 to PCs -->
  <line x1="170" y1="295" x2="145" y2="370" stroke="#334155" stroke-width="2" />
  <text x="135" y="335" font-family="monospace" font-size="10" fill="#64748b">Fa0/1</text>

  <line x1="220" y1="295" x2="260" y2="370" stroke="#334155" stroke-width="2" />
  <text x="245" y="335" font-family="monospace" font-size="10" fill="#64748b">Fa0/2</text>

  <!-- Access 2 to PC -->
  <line x1="595" y1="295" x2="595" y2="370" stroke="#334155" stroke-width="2" />
  <text x="605" y="335" font-family="monospace" font-size="10" fill="#64748b">Fa0/1</text>
`;

// 2. 3-Router Triangle OSPF Backbone Whiteboard
const ospfSvgContent = `
  <text x="40" y="50" font-family="sans-serif" font-size="20" font-weight="bold" fill="#b91c1c">OSPF MULTI-ROUTER BACKBONE (AREA 0)</text>
  <text x="40" y="75" font-family="sans-serif" font-size="12" fill="#64748b">Point-to-point /30 subnets | Area 0</text>

  <!-- R1 (Top Center) -->
  <circle cx="400" cy="130" r="42" fill="#fef2f2" stroke="#dc2626" stroke-width="3" />
  <text x="388" y="136" font-family="sans-serif" font-size="17" font-weight="bold" fill="#b91c1c">R1</text>
  <text x="365" y="190" font-family="monospace" font-size="10" fill="#b91c1c">ID: 1.1.1.1</text>

  <!-- R2 (Bottom Left) -->
  <circle cx="220" cy="300" r="42" fill="#fef2f2" stroke="#dc2626" stroke-width="3" />
  <text x="208" y="306" font-family="sans-serif" font-size="17" font-weight="bold" fill="#b91c1c">R2</text>
  <text x="185" y="360" font-family="monospace" font-size="10" fill="#b91c1c">ID: 2.2.2.2</text>

  <!-- R3 (Bottom Right) -->
  <circle cx="580" cy="300" r="42" fill="#fef2f2" stroke="#dc2626" stroke-width="3" />
  <text x="568" y="306" font-family="sans-serif" font-size="17" font-weight="bold" fill="#b91c1c">R3</text>
  <text x="545" y="360" font-family="monospace" font-size="10" fill="#b91c1c">ID: 3.3.3.3</text>

  <!-- Branch Switch & PC on R2 -->
  <rect x="70" y="300" width="70" height="36" rx="4" fill="#f0fdf4" stroke="#16a34a" stroke-width="2" />
  <text x="82" y="323" font-family="sans-serif" font-size="11" font-weight="bold" fill="#15803d">SW-Branch</text>

  <rect x="60" y="380" width="70" height="36" rx="4" fill="#faf5ff" stroke="#9333ea" stroke-width="2" />
  <text x="75" y="403" font-family="sans-serif" font-size="11" font-weight="bold" fill="#7e22ce">PC-Branch</text>

  <!-- Triangle Links -->
  <!-- R1 to R2 -->
  <line x1="370" y1="155" x2="250" y2="275" stroke="#1e293b" stroke-width="3" />
  <text x="260" y="200" font-family="monospace" font-size="11" fill="#475569">10.0.12.0/30 (Gi0/0-Gi0/0)</text>

  <!-- R1 to R3 -->
  <line x1="430" y1="155" x2="550" y2="275" stroke="#1e293b" stroke-width="3" />
  <text x="480" y="200" font-family="monospace" font-size="11" fill="#475569">10.0.13.0/30 (Gi0/1-Gi0/0)</text>

  <!-- R2 to R3 -->
  <line x1="262" y1="300" x2="538" y2="300" stroke="#1e293b" stroke-width="3" stroke-dasharray="6 3" />
  <text x="360" y="320" font-family="monospace" font-size="11" fill="#475569">10.0.23.0/30 (Gi0/1-Gi0/1)</text>

  <!-- R2 to Branch -->
  <line x1="178" y1="315" x2="140" y2="315" stroke="#475569" stroke-width="2" />
  <line x1="95" y1="336" x2="95" y2="380" stroke="#475569" stroke-width="2" />
`;

// 3. Perimeter Firewall & DMZ Whiteboard
const firewallSvgContent = `
  <text x="40" y="50" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ea580c">PERIMETER FIREWALL & DMZ ARCHITECTURE</text>
  <text x="40" y="75" font-family="sans-serif" font-size="12" fill="#64748b">Tri-homed security: Outside (ISP), DMZ (Public Web), Inside (LAN)</text>

  <!-- Outside Router (Top Left) -->
  <circle cx="160" cy="140" r="38" fill="#fef2f2" stroke="#dc2626" stroke-width="2.5" />
  <text x="135" y="145" font-family="sans-serif" font-size="14" font-weight="bold" fill="#b91c1c">ISP-Gateway</text>

  <!-- Perimeter Firewall (Center) -->
  <rect x="330" y="115" width="140" height="60" rx="8" fill="#fff7ed" stroke="#ea580c" stroke-width="3" />
  <text x="355" y="146" font-family="sans-serif" font-size="16" font-weight="bold" fill="#c2410c">ASA-FW01</text>
  <text x="365" y="163" font-family="sans-serif" font-size="11" fill="#ea580c">(Perimeter FW)</text>

  <!-- DMZ Web Server (Top Right) -->
  <rect x="600" y="120" width="110" height="55" rx="6" fill="#f0f9ff" stroke="#0284c7" stroke-width="2.5" />
  <text x="618" y="152" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0369a1">DMZ-Server</text>
  <text x="625" y="166" font-family="sans-serif" font-size="10" fill="#0284c7">Port 80/443</text>

  <!-- Inside Switch (Bottom Center) -->
  <rect x="340" y="270" width="120" height="50" rx="6" fill="#f0fdf4" stroke="#16a34a" stroke-width="2.5" />
  <text x="360" y="300" font-family="sans-serif" font-size="14" font-weight="bold" fill="#15803d">SW-Inside</text>

  <!-- Inside Workstation -->
  <rect x="350" y="380" width="100" height="48" rx="4" fill="#faf5ff" stroke="#9333ea" stroke-width="2" />
  <text x="365" y="408" font-family="sans-serif" font-size="13" font-weight="bold" fill="#7e22ce">PC-Inside</text>

  <!-- Connections -->
  <line x1="198" y1="140" x2="330" y2="140" stroke="#0f172a" stroke-width="2.5" />
  <text x="215" y="130" font-family="monospace" font-size="11" fill="#475569">Outside (Gi0/0)</text>

  <line x1="470" y1="140" x2="600" y2="140" stroke="#0f172a" stroke-width="2.5" />
  <text x="495" y="130" font-family="monospace" font-size="11" fill="#475569">DMZ (Gi0/2)</text>

  <line x1="400" y1="175" x2="400" y2="270" stroke="#0f172a" stroke-width="2.5" />
  <text x="410" y="225" font-family="monospace" font-size="11" fill="#475569">Inside (Gi0/1)</text>

  <line x1="400" y1="320" x2="400" y2="380" stroke="#334155" stroke-width="2" />
  <text x="410" y="355" font-family="monospace" font-size="10" fill="#64748b">Fa0/1</text>
`;

export const SAMPLE_WHITEBOARD_DIAGRAMS: SampleWhiteboardDiagram[] = [
  {
    id: 'wb-campus-arch',
    title: 'Enterprise Campus (Core + Dual Access)',
    category: 'Enterprise Campus',
    description: 'Whiteboard drawing of a Multilayer L3 Core switch trunked to 2 Access switches serving Sales and Engineering PCs.',
    dataUrl: makeWhiteboardSvg(campusSvgContent),
    rawAnalysis: {
      title: 'Enterprise Campus Core & Dual Access',
      summary: 'L3 Core switch with 802.1Q trunks connecting 2 access switches with workstations on VLAN 10 and VLAN 20.',
      overallConfidence: 96,
      devices: [
        { name: 'Core-SW1', type: 'l3switch', confidence: 98, x: 420, y: 110, notes: 'L3 switch with dual SVI gateways' },
        { name: 'SW-Access-1', type: 'switch', confidence: 96, x: 230, y: 260, notes: 'Access switch for VLAN 10 (Sales)' },
        { name: 'SW-Access-2', type: 'switch', confidence: 96, x: 610, y: 260, notes: 'Access switch for VLAN 20 (Engineering)' },
        { name: 'PC-Sales', type: 'pc', confidence: 95, x: 170, y: 440, notes: 'Workstation in Sales department' },
        { name: 'Sales-Host2', type: 'laptop', confidence: 93, x: 290, y: 440, notes: 'Secondary host in Sales subnet' },
        { name: 'PC-Eng', type: 'pc', confidence: 96, x: 610, y: 440, notes: 'Workstation in Engineering subnet' },
      ],
      links: [
        { from: 'Core-SW1', fromPort: 'Gig0/1', to: 'SW-Access-1', toPort: 'Fa0/24', cable: 'straight', confidence: 96, autoHealed: false, notes: 'Trunk uplink detected' },
        { from: 'Core-SW1', fromPort: 'Gig0/2', to: 'SW-Access-2', toPort: 'Fa0/24', cable: 'straight', confidence: 95, autoHealed: false, notes: 'Trunk uplink detected' },
        { from: 'SW-Access-1', fromPort: 'Fa0/1', to: 'PC-Sales', toPort: 'FastEthernet0', cable: 'straight', confidence: 94, autoHealed: false, notes: 'Access port VLAN 10' },
        { from: 'SW-Access-1', fromPort: 'Fa0/2', to: 'Sales-Host2', toPort: 'FastEthernet0', cable: 'straight', confidence: 92, autoHealed: false, notes: 'Access port VLAN 10' },
        { from: 'SW-Access-2', fromPort: 'Fa0/1', to: 'PC-Eng', toPort: 'FastEthernet0', cable: 'straight', confidence: 94, autoHealed: false, notes: 'Access port VLAN 20' },
      ],
      warnings: [],
    },
  },
  {
    id: 'wb-ospf-triangle',
    title: '3-Router OSPF Backbone Napkin Sketch',
    category: 'Routing Protocols',
    description: 'Hand-drawn triangle network of three core routers running OSPF Area 0 with point-to-point subnets and a branch LAN.',
    dataUrl: makeWhiteboardSvg(ospfSvgContent),
    rawAnalysis: {
      title: '3-Router OSPF Triangle Backbone',
      summary: 'Triangular OSPF Area 0 core with /30 interconnects, router IDs, and branch workstation.',
      overallConfidence: 93,
      devices: [
        { name: 'R1', type: 'router', confidence: 97, x: 420, y: 110, notes: 'OSPF Core Router 1 (1.1.1.1)' },
        { name: 'R2', type: 'router', confidence: 95, x: 230, y: 290, notes: 'OSPF Core Router 2 (2.2.2.2)' },
        { name: 'R3', type: 'router', confidence: 95, x: 610, y: 290, notes: 'OSPF Core Router 3 (3.3.3.3)' },
        { name: 'SW-Branch', type: 'switch', confidence: 90, x: 110, y: 290, notes: 'Branch access switch' },
        { name: 'PC-Branch', type: 'pc', confidence: 94, x: 110, y: 440, notes: 'Branch office client' },
      ],
      links: [
        { from: 'R1', fromPort: 'Gi0/0', to: 'R2', toPort: 'Gi0/0', cable: 'crossover', confidence: 92, autoHealed: false, notes: 'Subnet 10.0.12.0/30' },
        { from: 'R1', fromPort: 'Gi0/1', to: 'R3', toPort: 'Gi0/0', cable: 'crossover', confidence: 93, autoHealed: false, notes: 'Subnet 10.0.13.0/30' },
        { from: 'R2', fromPort: 'Gi0/1', to: 'R3', toPort: 'Gi0/1', cable: 'crossover', confidence: 89, autoHealed: true, notes: 'Port label was faint; auto-assigned Gi0/1 on both routers' },
        { from: 'R2', fromPort: 'Gi0/2', to: 'SW-Branch', toPort: 'Fa0/24', cable: 'straight', confidence: 91, autoHealed: false, notes: 'Branch LAN gateway' },
        { from: 'SW-Branch', fromPort: 'Fa0/1', to: 'PC-Branch', toPort: 'FastEthernet0', cable: 'straight', confidence: 95, autoHealed: false, notes: 'Client access port' },
      ],
      warnings: [
        'R2 <-> R3 port label was partially smudged. Auto-healed to Gi0/1 <-> Gi0/1.',
      ],
    },
  },
  {
    id: 'wb-firewall-dmz',
    title: 'Perimeter Firewall & DMZ Architecture',
    category: 'Network Security',
    description: 'Whiteboard layout of an edge security firewall separating the outside untrusted ISP, public DMZ web server, and trusted inside network.',
    dataUrl: makeWhiteboardSvg(firewallSvgContent),
    rawAnalysis: {
      title: 'Perimeter Firewall & DMZ Security Zone',
      summary: 'Tri-homed firewall with ISP gateway, isolated DMZ server, and corporate inside LAN.',
      overallConfidence: 95,
      devices: [
        { name: 'ISP-Gateway', type: 'router', confidence: 96, x: 160, y: 130, notes: 'Simulated Internet uplink router' },
        { name: 'ASA-FW01', type: 'firewall', confidence: 97, x: 420, y: 130, notes: 'Perimeter firewall appliance' },
        { name: 'DMZ-Server', type: 'server', confidence: 95, x: 680, y: 130, notes: 'Public HTTP/HTTPS web server' },
        { name: 'SW-Inside', type: 'switch', confidence: 93, x: 420, y: 290, notes: 'Internal LAN distribution switch' },
        { name: 'PC-Inside', type: 'pc', confidence: 96, x: 420, y: 440, notes: 'Trusted inside workstation' },
      ],
      links: [
        { from: 'ISP-Gateway', fromPort: 'Gi0/0', to: 'ASA-FW01', toPort: 'Gi0/0', cable: 'straight', confidence: 97, autoHealed: false, notes: 'Outside zone interface' },
        { from: 'ASA-FW01', fromPort: 'Gi0/2', to: 'DMZ-Server', toPort: 'FastEthernet0', cable: 'straight', confidence: 94, autoHealed: false, notes: 'DMZ zone interface' },
        { from: 'ASA-FW01', fromPort: 'Gi0/1', to: 'SW-Inside', toPort: 'Fa0/24', cable: 'straight', confidence: 95, autoHealed: false, notes: 'Inside zone interface' },
        { from: 'SW-Inside', fromPort: 'Fa0/1', to: 'PC-Inside', toPort: 'FastEthernet0', cable: 'straight', confidence: 96, autoHealed: false, notes: 'Trusted LAN client' },
      ],
      warnings: [],
    },
  },
];
