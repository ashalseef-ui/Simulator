export type NetworkOsType =
  | 'cisco-ios'
  | 'juniper-junos'
  | 'arista-eos'
  | 'linux-vyos'
  | 'mikrotik-routeros';

export type DeviceType =
  | 'pc'
  | 'laptop'
  | 'server'
  | 'ipphone'
  | 'printer'
  | 'switch'
  | 'switch2960_48'
  | 'switch3560'
  | 'switch3850'
  | 'switch9300'
  | 'l3switch'
  | 'nexus9000'
  | 'arista_7050'
  | 'juniper_ex'
  | 'router'
  | 'router4331'
  | 'router1941'
  | 'juniper_vsrx'
  | 'linux_router'
  | 'mikrotik_router'
  | 'firewall'
  | 'firepower'
  | 'wlc'
  | 'ap'
  | 'home_router'
  | 'cloud'
  | 'mpls_cloud'
  | 'modem'
  | 'iot_sensor'
  | 'iot_gateway';

export type CableType =
  | 'auto'
  | 'straight'
  | 'crossover'
  | 'rollover'
  | 'fiber'
  | 'dac'
  | 'serial'
  | 'serial_dte'
  | 'coaxial'
  | 'phone'
  | 'usb';

export interface DeviceInterface {
  name: string;
  ip?: string;
  mask?: string;
  ipv6Address?: string;
  ipv6LinkLocal?: string;
  mac: string;
  status: 'up' | 'down';
  speed: number;
  description?: string;
  duplex?: 'auto' | 'full' | 'half';
  voiceVlan?: number;
  portfast?: boolean;
  bpduguard?: boolean;
  cdpEnabled?: boolean;
  lldpEnabled?: boolean;
  mode?: 'access' | 'trunk' | 'routed';
  accessVlan?: number;
  trunkAllowedVlans?: number[];
  nativeVlan?: number;
  encapsulationDot1Q?: number;
  ipHelperAddress?: string;
  accessGroupIn?: string;
  accessGroupOut?: string;
  natType?: 'inside' | 'outside';
  dhcpSnoopingTrust?: boolean;
  channelGroup?: number;
  ospfHelloInterval?: number;
  ospfDeadInterval?: number;
  ospfCost?: number;
  ospfPriority?: number;
  ospfArea?: number;
  portSecurity?: {
    enabled: boolean;
    maxMacs: number;
    violation: 'shutdown' | 'restrict' | 'protect';
    stickyMacs: string[];
    violationCount?: number;
    state?: 'secure-up' | 'err-disabled';
  };
  hsrp?: {
    group: number;
    virtualIp: string;
    priority: number;
    preempt: boolean;
    state: 'Active' | 'Standby' | 'Listen';
  };
  tunnelSource?: string;
  tunnelDestination?: string;
  tunnelMode?: string;
  vrrp?: {
    group: number;
    virtualIp: string;
    priority: number;
    preempt: boolean;
    state: 'Master' | 'Backup';
  };
  glbp?: {
    group: number;
    virtualIp: string;
    priority: number;
    loadBalancing: 'round-robin' | 'host-dependent' | 'weighted';
    state: 'Active' | 'Standby';
  };
  servicePolicyInput?: string;
  servicePolicyOutput?: string;
  lldpMedEnabled?: boolean;
  mplsEnabled?: boolean;
  ipsecCryptoMap?: string;
  isisMetric?: number;
  isisCircuitType?: 'level-1' | 'level-2' | 'level-1-2';
}

export interface AccessListRule {
  action: 'permit' | 'deny';
  protocol?: 'ip' | 'tcp' | 'udp' | 'icmp';
  source: string;
  destination?: string;
  port?: number | string;
  matchCount?: number;
}

export interface AccessList {
  idOrName: string;
  type: 'standard' | 'extended';
  rules: AccessListRule[];
}

export interface NatConfig {
  enabled: boolean;
  insideInterfaces: string[];
  outsideInterfaces: string[];
  overloadAcl?: string;
  overloadInterface?: string;
  staticMappings?: { insideIp: string; outsideIp: string }[];
  translations?: {
    protocol: string;
    insideGlobal: string;
    insideLocal: string;
    outsideLocal: string;
    outsideGlobal: string;
  }[];
}

export interface DhcpSnoopingConfig {
  enabled: boolean;
  vlans: number[];
  bindings: {
    mac: string;
    ip: string;
    lease: number;
    vlan: number;
    interface: string;
  }[];
}

export interface StaticRoute {
  network: string;
  mask: string;
  nextHop: string;
  interface?: string;
  distance?: number;
}

export interface OspfConfig {
  processId: number;
  routerId?: string;
  passiveInterfaces?: string[];
  defaultInformationOriginate?: boolean;
  networks: {
    network: string;
    wildcard: string;
    area: number;
  }[];
}

export interface BgpNeighbor {
  ip: string;
  remoteAs: number;
  description?: string;
  state?: 'Established' | 'Active' | 'Idle' | 'Connect' | 'OpenSent' | 'OpenConfirm';
  updateSource?: string;
  localPref?: number;
  med?: number;
  weight?: number;
  evpnEnabled?: boolean;
}

export interface BgpEvpnRoute {
  type: 'type-2' | 'type-3' | 'type-5';
  rd: string;
  rt: string;
  vni?: number;
  mac?: string;
  ip?: string;
  nextHop: string;
}

export interface BgpConfig {
  asn: number;
  routerId?: string;
  neighbors: BgpNeighbor[];
  networks: {
    network: string;
    mask: string;
  }[];
  addressFamilies?: {
    l2vpnEvpn?: boolean;
    ipv4Unicast?: boolean;
  };
  evpnRoutes?: BgpEvpnRoute[];
}

export interface DhcpPool {
  name: string;
  network: string;
  mask: string;
  defaultRouter: string;
  dnsServer?: string;
  leasedIps?: Record<string, string>; // IP -> MAC
}

export interface MacTableEntry {
  vlan: number;
  mac: string;
  type: 'DYNAMIC' | 'STATIC';
  port: string;
}

export interface ArpTableEntry {
  ip: string;
  mac: string;
  port?: string;
  interface?: string;
}

export interface StackMember {
  memberId: number;
  role: 'Active' | 'Standby' | 'Member';
  priority: number;
  mac: string;
  model: string;
  state: 'Ready' | 'Initializing' | 'Removed';
  stackPorts: { port1: 'Ok' | 'Down'; port2: 'Ok' | 'Down' };
}

export interface StackConfig {
  enabled: boolean;
  ringSpeed: string;
  ringState: 'Full' | 'Partial';
  members: StackMember[];
}

export interface EigrpConfig {
  asNumber: number;
  routerId?: string;
  autoSummary?: boolean;
  kValues?: [number, number, number, number, number];
  networks: {
    network: string;
    wildcard: string;
  }[];
  passiveInterfaces?: string[];
  neighbors?: {
    ip: string;
    interface: string;
    uptime: number;
    srtt: number;
    rto: number;
    holdTime: number;
  }[];
}

export interface RipConfig {
  version: number;
  autoSummary?: boolean;
  networks: string[];
}

export interface MplsLfibEntry {
  inLabel: number;
  outLabel: number | 'Pop' | 'Untagged';
  prefix: string;
  nextHop: string;
  outInterface: string;
}

export interface MplsConfig {
  enabled: boolean;
  routerId?: string;
  labelRange?: { min: number; max: number };
  ldpNeighbors?: { routerId: string; state: 'Operational' | 'Non-operational'; transportIp: string }[];
  lfib?: MplsLfibEntry[];
}

export interface IpsecConfig {
  isakmpPolicies?: { priority: number; encryption: string; hash: string; group: number; auth: string; lifetime: number }[];
  preSharedKeys?: Record<string, string>; // peer IP -> key
  transformSets?: Record<string, { name: string; espCipher: string; espAuth: string }>;
  cryptoMaps?: Record<string, { name: string; seq: number; acl: string; peer: string; transformSet: string }>;
  activeSessions?: { peerIp: string; state: 'UP-ACTIVE' | 'DOWN'; localIp: string; cryptoMap: string; packetsEncrypted: number; packetsDecrypted: number }[];
}

export interface VxlanConfig {
  nveInterface?: string;
  sourceInterface?: string;
  vniMembers?: Record<number, { vni: number; vlan: number; multicastGroup?: string; ingressReplication?: boolean }>;
  vtepPeers?: { ip: string; vni: number; state: 'Up' | 'Down' }[];
}

export interface Srv6Config {
  enabled: boolean;
  locator?: { name: string; prefix: string; length: number };
  sids?: { sid: string; behavior: 'End' | 'End.X' | 'End.DT4'; outInterface?: string; nextHop?: string }[];
}

export interface IsisConfig {
  processTag?: string;
  net?: string; // e.g. "49.0001.0000.0000.0001.00"
  isType: 'level-1' | 'level-2' | 'level-1-2';
  metricStyle?: 'narrow' | 'wide';
  neighbors?: {
    systemId: string;
    interface: string;
    localInterface?: string;
    level: 'L1' | 'L2' | 'L1L2';
    state: 'Up' | 'Init' | 'Down';
    snpa: string;
    holdtime?: number;
  }[];
  lspDatabase?: { lspId: string; seqNumber: string; checksum: string; lifetime: number }[];
}

export interface WirelessConfig {
  wlanProfiles?: { id: number; ssid: string; status: 'enabled' | 'disabled'; security: 'open' | 'wpa2-psk' | 'wpa3'; vlanId: number }[];
  associatedClients?: { mac: string; ip: string; ssid: string; rssi: number; apName: string }[];
  connectedAps?: { name: string; ip: string; mac: string; model: string; status: 'Registered' | 'Downloading' }[];
}

export interface IotConfig {
  role: 'sensor' | 'actuator' | 'gateway';
  sensorType?: 'temperature' | 'humidity' | 'motion' | 'smart_light' | 'camera' | 'smart_lock';
  mqttBroker?: string;
  mqttPort?: number;
  telemetry?: { temperature?: number; humidity?: number; motionDetected?: boolean; lightState?: 'ON' | 'OFF'; alert?: string };
  topics?: string[];
}

export interface DeviceConfig {
  hostname: string;
  networkOs?: NetworkOsType;
  interfaces: Record<string, DeviceInterface>;
  vlans: Record<number, { id: number; name: string }>;
  routes: StaticRoute[];
  ospf?: OspfConfig;
  bgp?: BgpConfig;
  eigrp?: EigrpConfig;
  rip?: RipConfig;
  mpls?: MplsConfig;
  ipsec?: IpsecConfig;
  vxlan?: VxlanConfig;
  srv6?: Srv6Config;
  isis?: IsisConfig;
  wireless?: WirelessConfig;
  iot?: IotConfig;
  dhcpPools?: Record<string, DhcpPool>;
  dhcpExcludedAddresses?: string[];
  accessLists?: Record<string, AccessList>;
  nat?: NatConfig;
  dhcpSnooping?: DhcpSnoopingConfig;
  portChannels?: Record<number, { id: number; protocol: string; mode: string; members: string[] }>;
  stack?: StackConfig;
  monitorSession?: { session: number; sourcePort: string; destinationPort: string };
  ipSla?: Record<number, { id: number; targetIp: string; frequency: number; state: 'Active' | 'Scheduled' }>;
  trackObjects?: Record<number, { id: number; type: string; targetId: number; status: 'Up' | 'Down' }>;
  classMaps?: Record<string, { name: string; matchType: string; matchValue: string }>;
  policyMaps?: Record<string, { name: string; classes: { className: string; priorityKbps?: number; bandwidthPercent?: number; setDscp?: string }[] }>;
  ipRoutingEnabled?: boolean;
  ipv6RoutingEnabled?: boolean;
  ipv6Routes?: { prefix: string; nextHop: string }[];
  spanningTreePriority?: number;
  spanningTreeVlanPriority?: Record<number, number>;
  spanningTreeMode?: string;
  portfastDefault?: boolean;
  bpduguardDefault?: boolean;
  bannerMotd?: string;
  enableSecret?: string;
  servicePasswordEncryption?: boolean;
  localUsers?: Record<string, { username: string; password?: string }>;
  vtp?: { mode: 'server' | 'client' | 'transparent' | 'off'; domain?: string; password?: string };
  ntpServer?: string;
  sshVersion?: number;
  domainName?: string;
  domainLookupEnabled?: boolean;
  staticHosts?: { hostname: string; ip: string }[];
  cdpGlobalEnabled?: boolean;
  lldpGlobalEnabled?: boolean;
  linePassword?: string;
  lineLogin?: string;
  transportInput?: string;
  execTimeout?: string;
  loggingSynchronous?: boolean;
  loggingBuffer?: string[];
  macTable?: MacTableEntry[];
  arpTable?: ArpTableEntry[];
  // End-host properties (PC, Laptop, Server)
  defaultGateway?: string;
  dnsServer?: string;
  isDhcpClient?: boolean;
  // Server-specific properties
  services?: {
    dhcp?: {
      enabled: boolean;
      poolName: string;
      startIp: string;
      mask: string;
      defaultGateway: string;
      dnsServer: string;
    };
    dns?: {
      enabled: boolean;
      records: { domain: string; ip: string }[];
    };
    http?: {
      enabled: boolean;
      title: string;
      body: string;
    };
  };
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  x: number;
  y: number;
  config: DeviceConfig;
}

export interface Link {
  id: string;
  fromDevice: string;
  fromPort: string;
  toDevice: string;
  toPort: string;
  cable: CableType;
  resolvedCable?: CableType; // if 'auto' was chosen
  isMismatch?: boolean;
}

export interface StpPortInfo {
  deviceId: string;
  port: string;
  role: 'ROOT' | 'DESG' | 'ALTN';
  state: 'FWD' | 'BLK' | 'LIS' | 'LRN';
  cost: number;
  edge?: boolean;
  vlan?: number;
}

export interface StpTopologyState {
  rootBridgeId: string;
  rootBridgePriority: number;
  rootBridgeMac: string;
  ports: Record<string, StpPortInfo>; // key: `${deviceId}:${port}`
  vlan?: number;
  vlans?: Record<number, StpTopologyState>; // Per-VLAN instances (PVST+)
}

export interface PacketL2Frame {
  preamble: string;
  srcMac: string;
  dstMac: string;
  type: string; // e.g. "0x0800 (IPv4)", "0x0806 (ARP)", "0x8847 (MPLS)"
  vlan?: number;
  mplsLabels?: number[];
}

export interface PacketL3Header {
  version: number;
  ihl: number;
  tos: number;
  totalLength: number;
  ttl: number;
  protocol: string; // "ICMP", "UDP", "OSPF", "EIGRP", "ESP", "BGP", "IS-IS"
  srcIp: string;
  dstIp: string;
  espSpi?: string;
  vxlanVni?: number;
  srv6SidList?: string[];
}

export interface PacketL4Payload {
  protocol: string;
  summary: string;
  details: Record<string, any>;
}

export interface SimulationStep {
  id: string;
  stepIndex: number;
  totalSteps: number;
  type:
    | 'ARP'
    | 'ICMP'
    | 'DHCP'
    | 'OSPF'
    | 'DNS'
    | 'EIGRP'
    | 'BGP'
    | 'HSRP'
    | 'IPSEC'
    | 'MPLS'
    | 'EVPN'
    | 'SRV6'
    | 'ISIS'
    | 'VXLAN'
    | 'WIRELESS'
    | 'MQTT';
  stage: string;
  fromDeviceId: string;
  toDeviceId: string;
  fromPort: string;
  toPort: string;
  linkId?: string;
  status: 'forward' | 'reply' | 'broadcast' | 'drop' | 'success';
  message: string;
  l2Frame: PacketL2Frame;
  l3Packet: PacketL3Header;
  l4Payload: PacketL4Payload;
}

export interface DeviceWindowState {
  id: string;
  deviceId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
  activeTab: 'cli' | 'config' | 'desktop' | 'services';
}

export interface LabScenario {
  id: string;
  title: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  summary: string;
  objective: string;
  instructions: string[];
  tips?: string[];
  initialTopology: () => { devices: Device[]; links: Link[] };
  validate: (devices: Device[], links: Link[]) => {
    passed: boolean;
    score: number; // 0 to 100
    criteria: { name: string; passed: boolean; message: string }[];
  };
}
