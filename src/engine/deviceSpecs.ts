import { Device, DeviceConfig, DeviceInterface, DeviceType, CableType } from '../types/network';
import { generateRandomMac } from '../utils/ipUtils';

export interface DeviceSpec {
  type: DeviceType;
  displayName: string;
  category: 'Routers' | 'Switches' | 'Security & Firewalls' | 'Wireless & Infrastructure' | 'WAN & Cloud' | 'End Devices';
  description: string;
  defaultPorts: { name: string; speed: 100 | 1000; isSerial?: boolean }[];
  icon: string;
  supportsCli: boolean;
  supportsDesktop: boolean;
  supportsServices: boolean;
  tags?: string[];
}

export const DEVICE_SPECS: Record<DeviceType, DeviceSpec> = {
  // ROUTERS
  router: {
    type: 'router',
    displayName: '2911 ISR Router (Emulated)',
    category: 'Routers',
    description: 'Modular Integrated Services Router. 3x GigabitEthernet, 2x Serial WAN, OSPFv2, Subinterfaces, DHCP pools.',
    defaultPorts: [
      { name: 'Gi0/0', speed: 1000 },
      { name: 'Gi0/1', speed: 1000 },
      { name: 'Gi0/2', speed: 1000 },
      { name: 'Se0/0/0', speed: 100, isSerial: true },
      { name: 'Se0/0/1', speed: 100, isSerial: true },
    ],
    icon: 'Waypoints',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['L3 Routing', 'OSPF', 'WAN', 'Serial', 'Subinterfaces'],
  },
  router4331: {
    type: 'router4331',
    displayName: '4331 ISR Router (Emulated)',
    category: 'Routers',
    description: 'Next-Gen Enterprise ISR. 3x Gigabit interfaces, hardware encryption, voice gateway, and SD-WAN ready.',
    defaultPorts: [
      { name: 'Gi0/0/0', speed: 1000 },
      { name: 'Gi0/0/1', speed: 1000 },
      { name: 'Gi0/0/2', speed: 1000 },
      { name: 'Se0/1/0', speed: 100, isSerial: true },
    ],
    icon: 'Waypoints',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Next-Gen ISR', 'L3', 'Fiber SFP', 'Branch Office'],
  },
  router1941: {
    type: 'router1941',
    displayName: '1941 ISR Router (Emulated)',
    category: 'Routers',
    description: 'Compact modular branch router. 2x GigabitEthernet, 2x HWIC slots for high-speed serial WAN uplinks.',
    defaultPorts: [
      { name: 'Gi0/0', speed: 1000 },
      { name: 'Gi0/1', speed: 1000 },
      { name: 'Se0/0/0', speed: 100, isSerial: true },
      { name: 'Se0/0/1', speed: 100, isSerial: true },
    ],
    icon: 'Waypoints',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Compact ISR', 'Branch Router', 'HWIC Serial'],
  },

  // SWITCHES
  switch: {
    type: 'switch',
    displayName: 'Catalyst 2960-24TT Switch (Emulated)',
    category: 'Switches',
    description: 'Enterprise Layer 2 Access Switch. 24 FastEthernet ports + 2 Gigabit uplinks. PVST+, 802.1Q VLAN trunking.',
    defaultPorts: [
      ...Array.from({ length: 24 }, (_, i) => ({
        name: `Fa0/${i + 1}`,
        speed: 100 as const,
      })),
      { name: 'Gi0/1', speed: 1000 as const },
      { name: 'Gi0/2', speed: 1000 as const },
    ],
    icon: 'Network',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Layer 2', '24-Port', '802.1Q VLANs', 'PVST+ STP'],
  },
  switch2960_48: {
    type: 'switch2960_48',
    displayName: 'Catalyst 2960-48TT Switch (Emulated)',
    category: 'Switches',
    description: 'High-Density Enterprise Layer 2 Switch. 48 FastEthernet ports + 2 Gigabit uplinks. PVST+, Voice VLAN, 802.1Q trunking.',
    defaultPorts: [
      ...Array.from({ length: 48 }, (_, i) => ({
        name: `Fa0/${i + 1}`,
        speed: 100 as const,
      })),
      { name: 'Gi0/1', speed: 1000 as const },
      { name: 'Gi0/2', speed: 1000 as const },
    ],
    icon: 'Network',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Layer 2', '48-Port', 'Voice VLAN', 'High-Density Access'],
  },
  switch3560: {
    type: 'switch3560',
    displayName: 'Catalyst 3560 L3 Switch (Emulated)',
    category: 'Switches',
    description: 'Enterprise Layer 3 Distribution Switch. 24 FastEthernet + 2 Gigabit SFP ports. Supports SVIs & IP routing.',
    defaultPorts: [
      ...Array.from({ length: 24 }, (_, i) => ({
        name: `Fa0/${i + 1}`,
        speed: 100 as const,
      })),
      { name: 'Gi0/1', speed: 1000 as const },
      { name: 'Gi0/2', speed: 1000 as const },
    ],
    icon: 'Boxes',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Layer 3 Switch', 'SVI', 'IP Routing', 'Distribution'],
  },
  l3switch: {
    type: 'l3switch',
    displayName: 'Catalyst 3650 Core Switch (Emulated)',
    category: 'Switches',
    description: 'Enterprise Collapsed-Core Multilayer Switch. 24 GigabitEthernet ports with wire-speed IP routing and SVIs.',
    defaultPorts: Array.from({ length: 24 }, (_, i) => ({
      name: `Gi1/0/${i + 1}`,
      speed: 1000 as const,
    })),
    icon: 'Boxes',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Layer 3 Core', '24x Gigabit', 'SVIs', 'OSPFv2'],
  },
  switch3850: {
    type: 'switch3850',
    displayName: 'Catalyst 3850-24P Switch (Emulated)',
    category: 'Switches',
    description: 'Next-Gen Multilayer Catalyst Switch. 24 Gigabit PoE+ ports, StackWise 480 support, and wire-speed routing.',
    defaultPorts: Array.from({ length: 24 }, (_, i) => ({
      name: `Gi1/0/${i + 1}`,
      speed: 1000 as const,
    })),
    icon: 'Boxes',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Catalyst 3850', 'StackWise 480', 'Layer 3 Multilayer', 'PoE+'],
  },
  switch9300: {
    type: 'switch9300',
    displayName: 'Catalyst 9300-48P Switch (Emulated)',
    category: 'Switches',
    description: 'Flagship Enterprise Access/Core Switch. 48 Gigabit Ethernet ports, Stackable architecture, and network orchestration ready.',
    defaultPorts: Array.from({ length: 48 }, (_, i) => ({
      name: `Gi1/0/${i + 1}`,
      speed: 1000 as const,
    })),
    icon: 'Boxes',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Catalyst 9300', '48-Port Gigabit', 'StackWise 480', 'Flagship Catalyst'],
  },
  nexus9000: {
    type: 'nexus9000',
    displayName: 'Nexus 9000 DC Switch (Emulated)',
    category: 'Switches',
    description: 'Data Center Spine/Leaf High-Density Switch. High-throughput line-rate switching for cloud fabrics.',
    defaultPorts: Array.from({ length: 16 }, (_, i) => ({
      name: `Eth1/${i + 1}`,
      speed: 1000 as const,
    })),
    icon: 'Boxes',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Data Center', 'Spine-Leaf', 'High-Density Fabric'],
  },

  // SECURITY & FIREWALLS
  firewall: {
    type: 'firewall',
    displayName: 'ASA 5506-X Security (Emulated)',
    category: 'Security & Firewalls',
    description: 'Next-Gen Firewall with 4x Gigabit ports, security levels, stateful inspection, and DMZ segmentation.',
    defaultPorts: [
      { name: 'Gi0/0', speed: 1000 },
      { name: 'Gi0/1', speed: 1000 },
      { name: 'Gi0/2', speed: 1000 },
      { name: 'Gi0/3', speed: 1000 },
    ],
    icon: 'Shield',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Stateful Firewall', 'Security Levels', 'DMZ', 'NAT'],
  },
  firepower: {
    type: 'firepower',
    displayName: 'Firepower 1010 NGFW (Emulated)',
    category: 'Security & Firewalls',
    description: 'Next-Gen Threat Prevention Firewall. 8x Gigabit ports with integrated deep packet inspection and intrusion defense.',
    defaultPorts: [
      ...Array.from({ length: 8 }, (_, i) => ({
        name: `Eth1/${i + 1}`,
        speed: 1000 as const,
      })),
    ],
    icon: 'ShieldAlert',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['NGFW', 'Threat Defense', 'Deep Packet Inspection'],
  },

  // WIRELESS & INFRASTRUCTURE
  wlc: {
    type: 'wlc',
    displayName: '3504 WLC Controller (Emulated)',
    category: 'Wireless & Infrastructure',
    description: 'Centralized Wireless LAN Controller. Manages access points, centralized WLAN SSIDs, and CAPWAP tunnels.',
    defaultPorts: [
      { name: 'Gi0/1', speed: 1000 },
      { name: 'Gi0/2', speed: 1000 },
      { name: 'Gi0/3', speed: 1000 },
      { name: 'Gi0/4', speed: 1000 },
    ],
    icon: 'Radio',
    supportsCli: true,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['WLC Controller', 'CAPWAP', 'SSID Management'],
  },
  ap: {
    type: 'ap',
    displayName: 'Aironet 3702 AP (Emulated)',
    category: 'Wireless & Infrastructure',
    description: 'Dual-Band 802.11ac Access Point. Connects wireless hosts to the wired backbone infrastructure.',
    defaultPorts: [
      { name: 'Gi0/0', speed: 1000 },
      { name: 'Gi0/1', speed: 1000 },
    ],
    icon: 'Wifi',
    supportsCli: false,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Access Point', '802.11ac Wi-Fi', 'PoE Uplink'],
  },
  home_router: {
    type: 'home_router',
    displayName: 'Wireless SOHO Gateway',
    category: 'Wireless & Infrastructure',
    description: 'Integrated SOHO Router. 4-port LAN switch, 1x WAN Internet port, built-in NAT, and DHCP service.',
    defaultPorts: [
      { name: 'Internet', speed: 1000 },
      { name: 'Eth1', speed: 100 },
      { name: 'Eth2', speed: 100 },
      { name: 'Eth3', speed: 100 },
      { name: 'Eth4', speed: 100 },
    ],
    icon: 'Router',
    supportsCli: false,
    supportsDesktop: true,
    supportsServices: true,
    tags: ['SOHO Gateway', 'Integrated NAT', '4-Port Switch'],
  },

  // WAN & CLOUD
  cloud: {
    type: 'cloud',
    displayName: 'Cloud / ISP WAN',
    category: 'WAN & Cloud',
    description: 'Simulated Internet Gateway and WAN Backbone with Ethernet and Serial interfaces.',
    defaultPorts: [
      { name: 'Eth0', speed: 1000 },
      { name: 'Eth1', speed: 1000 },
      { name: 'Eth2', speed: 1000 },
      { name: 'Eth3', speed: 1000 },
      { name: 'Se0', speed: 100, isSerial: true },
      { name: 'Se1', speed: 100, isSerial: true },
    ],
    icon: 'Cloud',
    supportsCli: false,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['ISP Gateway', 'WAN Cloud', 'Serial Backhaul'],
  },
  mpls_cloud: {
    type: 'mpls_cloud',
    displayName: 'MPLS Core Cloud',
    category: 'WAN & Cloud',
    description: 'Service Provider Multi-Protocol Label Switching WAN Backbone. Interconnects enterprise sites.',
    defaultPorts: [
      { name: 'Gi0/1', speed: 1000 },
      { name: 'Gi0/2', speed: 1000 },
      { name: 'Gi0/3', speed: 1000 },
      { name: 'Gi0/4', speed: 1000 },
      { name: 'Se0', speed: 100, isSerial: true },
      { name: 'Se1', speed: 100, isSerial: true },
    ],
    icon: 'CloudRain',
    supportsCli: false,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['MPLS Cloud', 'WAN Provider', 'Enterprise Core'],
  },
  modem: {
    type: 'modem',
    displayName: 'DSL / Cable Modem',
    category: 'WAN & Cloud',
    description: 'Broadband WAN Signal Converter. Bridges coaxial cable / DSL loop to Ethernet LAN gateway.',
    defaultPorts: [
      { name: 'Port0', speed: 100 },
      { name: 'Port1', speed: 1000 },
    ],
    icon: 'Cpu',
    supportsCli: false,
    supportsDesktop: false,
    supportsServices: false,
    tags: ['Broadband Modem', 'DSL / Cable', 'WAN Bridge'],
  },

  // END DEVICES
  pc: {
    type: 'pc',
    displayName: 'PC / Workstation',
    category: 'End Devices',
    description: 'Layer 3 Host. Supports static/DHCP IPv4, Ping, Traceroute, and Command Prompt.',
    defaultPorts: [{ name: 'Fa0/0', speed: 100 }],
    icon: 'Monitor',
    supportsCli: false,
    supportsDesktop: true,
    supportsServices: false,
    tags: ['Workstation', 'Static/DHCP IP', 'CMD Prompt'],
  },
  laptop: {
    type: 'laptop',
    displayName: 'Laptop Host',
    category: 'End Devices',
    description: 'Portable Workstation with FastEthernet port and IP configuration desktop suite.',
    defaultPorts: [{ name: 'Fa0/0', speed: 100 }],
    icon: 'Laptop',
    supportsCli: false,
    supportsDesktop: true,
    supportsServices: false,
    tags: ['Portable Host', 'DHCP Client', 'Browser'],
  },
  server: {
    type: 'server',
    displayName: 'Enterprise Lab Server',
    category: 'End Devices',
    description: 'Multi-service host simulating DHCP IP leasing, DNS domain resolution, and HTTP Web portal.',
    defaultPorts: [
      { name: 'Fa0/0', speed: 100 },
      { name: 'Fa0/1', speed: 100 },
    ],
    icon: 'Server',
    supportsCli: false,
    supportsDesktop: true,
    supportsServices: true,
    tags: ['DHCP Server', 'DNS Server', 'Web HTTP'],
  },
  ipphone: {
    type: 'ipphone',
    displayName: '7960 VoIP Phone (Emulated)',
    category: 'End Devices',
    description: 'Enterprise VoIP Phone with dual-port switch (PC daisy-chain & Switch PoE connection).',
    defaultPorts: [
      { name: 'SW-Port', speed: 100 },
      { name: 'PC-Port', speed: 100 },
    ],
    icon: 'PhoneCall',
    supportsCli: false,
    supportsDesktop: true,
    supportsServices: false,
    tags: ['VoIP Phone', 'PoE', 'PC Pass-Through'],
  },
  printer: {
    type: 'printer',
    displayName: 'Network Laser Printer',
    category: 'End Devices',
    description: 'Network-attached office printer with dedicated FastEthernet print queue interface.',
    defaultPorts: [{ name: 'Fa0/0', speed: 100 }],
    icon: 'Printer',
    supportsCli: false,
    supportsDesktop: true,
    supportsServices: false,
    tags: ['Network Device', 'Print Server', 'Static IP'],
  },
};

export function createDefaultDeviceConfig(type: DeviceType, hostname: string): DeviceConfig {
  const spec = DEVICE_SPECS[type];
  const interfaces: Record<string, DeviceInterface> = {};

  const isSwitchType = type === 'switch' || type === 'switch3560' || type === 'l3switch' || type === 'nexus9000';
  const isRouterType = type === 'router' || type === 'router4331' || type === 'router1941' || type === 'firewall' || type === 'firepower';

  spec.defaultPorts.forEach((p) => {
    // Routers and Firewalls default to administratively shutdown in IOS-compatible CLI
    // Switches and End Devices default to up
    const isShutdownDefault = isRouterType;
    interfaces[p.name] = {
      name: p.name,
      mac: generateRandomMac(),
      status: isShutdownDefault ? 'down' : 'up',
      speed: p.speed,
      mode: isSwitchType ? 'access' : 'routed',
      accessVlan: 1,
      trunkAllowedVlans: [1],
      nativeVlan: 1,
    };
  });

  const baseConfig: DeviceConfig = {
    hostname,
    interfaces,
    vlans: { 1: { id: 1, name: 'default' } },
    routes: [],
    ipRoutingEnabled: isRouterType || type === 'l3switch' || type === 'switch3560' || type === 'nexus9000',
    spanningTreePriority: 32768,
    macTable: [],
    arpTable: [],
  };

  if (type === 'pc' || type === 'laptop' || type === 'printer' || type === 'ipphone') {
    baseConfig.isDhcpClient = false;
    baseConfig.defaultGateway = '';
    baseConfig.dnsServer = '';
  }

  if (type === 'server') {
    baseConfig.services = {
      dhcp: {
        enabled: true,
        poolName: 'SERVER-POOL',
        startIp: '192.168.1.100',
        mask: '255.255.255.0',
        defaultGateway: '192.168.1.1',
        dnsServer: '192.168.1.10',
      },
      dns: {
        enabled: true,
        records: [
          { domain: 'netsim.local', ip: '192.168.1.10' },
          { domain: 'example.com', ip: '192.168.1.10' },
        ],
      },
      http: {
        enabled: true,
        title: 'NetT-Sim Enterprise Portal',
        body: 'Welcome to the NetT-Sim Network Simulation Lab Web Server.',
      },
    };
  }

  if (type === 'home_router') {
    baseConfig.services = {
      dhcp: {
        enabled: true,
        poolName: 'SOHO-LAN-POOL',
        startIp: '192.168.0.100',
        mask: '255.255.255.0',
        defaultGateway: '192.168.0.1',
        dnsServer: '8.8.8.8',
      },
    };
  }

  return baseConfig;
}

export function createDevice(type: DeviceType, name: string, x: number, y: number): Device {
  return {
    id: `dev_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    type,
    x,
    y,
    config: createDefaultDeviceConfig(type, name),
  };
}

/**
 * Validates MDI/MDIX cabling standard between two devices and ports
 */
export function validateCabling(
  devA: Device,
  portA: string,
  devB: Device,
  portB: string,
  cableType: CableType
): { valid: boolean; recommendedCable: CableType; message?: string } {
  const isSerialA = portA.toLowerCase().startsWith('se');
  const isSerialB = portB.toLowerCase().startsWith('se');

  // Serial connections
  if (isSerialA || isSerialB) {
    if (isSerialA && isSerialB) {
      const valid = cableType === 'serial' || cableType === 'serial_dte' || cableType === 'auto';
      return {
        valid,
        recommendedCable: 'serial',
        message: valid
          ? undefined
          : 'Serial WAN interfaces require a Serial V.35 DCE or DTE cable.',
      };
    } else {
      return {
        valid: false,
        recommendedCable: 'serial',
        message: 'Cannot connect a Serial interface to an Ethernet interface.',
      };
    }
  }

  // Coaxial connection for Modem / Cloud WAN
  if (cableType === 'coaxial') {
    const isCoaxCompatible = devA.type === 'modem' || devA.type === 'cloud' || devB.type === 'modem' || devB.type === 'cloud';
    return {
      valid: isCoaxCompatible,
      recommendedCable: 'coaxial',
      message: isCoaxCompatible ? undefined : 'Coaxial cable is intended for Broadband Modem to ISP Cloud connections.',
    };
  }

  // Telephone line for DSL Modem / Cloud
  if (cableType === 'phone') {
    const isPhoneCompatible = devA.type === 'modem' || devA.type === 'cloud' || devB.type === 'modem' || devB.type === 'cloud';
    return {
      valid: isPhoneCompatible,
      recommendedCable: 'phone',
      message: isPhoneCompatible ? undefined : 'Telephone line (RJ11) is intended for DSL Modem to ISP connections.',
    };
  }

  // High-Speed Fiber Optic & SFP+ DAC Twinax
  if (cableType === 'fiber' || cableType === 'dac') {
    return {
      valid: true,
      recommendedCable: cableType,
    };
  }

  // Console Rollover & USB Console
  if (cableType === 'rollover' || cableType === 'usb') {
    return {
      valid: true,
      recommendedCable: cableType,
    };
  }

  // End devices, Routers, and Firewalls are MDI devices
  const mdiTypes = ['pc', 'laptop', 'server', 'ipphone', 'printer', 'router', 'router4331', 'router1941', 'firewall', 'firepower', 'home_router'];
  const isMdiA = mdiTypes.includes(devA.type);
  const isMdiB = mdiTypes.includes(devB.type);

  // Switches, Controllers, APs, and Clouds are MDI-X devices
  const mdixTypes = ['switch', 'switch3560', 'l3switch', 'nexus9000', 'wlc', 'ap', 'cloud', 'mpls_cloud', 'modem'];
  const isMdixA = mdixTypes.includes(devA.type);
  const isMdixB = mdixTypes.includes(devB.type);

  let recommendedCable: CableType = 'straight';

  // Dissimilar devices (MDI to MDI-X) -> Straight-Through
  if ((isMdiA && isMdixB) || (isMdixA && isMdiB)) {
    recommendedCable = 'straight';
  }
  // Similar devices (MDI to MDI or MDI-X to MDI-X) -> Crossover
  else if ((isMdiA && isMdiB) || (isMdixA && isMdixB)) {
    recommendedCable = 'crossover';
  }

  if (cableType === 'auto') {
    return { valid: true, recommendedCable };
  }

  const valid = cableType === recommendedCable;
  return {
    valid,
    recommendedCable,
    message: valid
      ? undefined
      : `MDI/MDIX Mismatch: Connecting ${devA.name} (${devA.type}) to ${devB.name} (${devB.type}) requires a ${recommendedCable === 'crossover' ? 'Crossover' : 'Straight-Through'} cable.`,
  };
}
