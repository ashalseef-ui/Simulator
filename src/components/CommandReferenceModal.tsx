import React, { useState } from 'react';
import {
  Terminal,
  Search,
  X,
  Copy,
  Check,
  BookOpen,
  Filter,
  Shield,
  Layers,
  Network,
  Cpu,
  Globe,
  ArrowRightLeft,
} from 'lucide-react';
import {
  MULTI_VENDOR_ROSETTA_STONE,
  VENDOR_OS_PROFILES,
  RosettaStoneEntry,
} from '../engine/cli/multiVendorEngines';

interface CommandEntry {
  command: string;
  mode: string;
  category: string;
  description: string;
  syntax: string;
  example: string;
}

export const COMMAND_REFERENCE_LIST: CommandEntry[] = [
  // User / Priv Exec Navigation & Basic
  {
    command: 'enable',
    mode: 'User EXEC',
    category: 'EXEC Navigation',
    description: 'Enters Privileged EXEC mode from User EXEC mode.',
    syntax: 'enable',
    example: 'Router> enable',
  },
  {
    command: 'disable',
    mode: 'Privileged EXEC',
    category: 'EXEC Navigation',
    description: 'Returns to User EXEC mode from Privileged EXEC mode.',
    syntax: 'disable',
    example: 'Router# disable',
  },
  {
    command: 'configure terminal',
    mode: 'Privileged EXEC',
    category: 'Configuration',
    description: 'Enters Global Configuration mode from Privileged EXEC mode.',
    syntax: 'configure terminal',
    example: 'Router# configure terminal',
  },
  {
    command: 'exit',
    mode: 'All Modes',
    category: 'EXEC Navigation',
    description: 'Exits current mode or terminates connection session.',
    syntax: 'exit',
    example: 'Router(config)# exit',
  },
  {
    command: 'end',
    mode: 'Configuration Modes',
    category: 'EXEC Navigation',
    description: 'Immediately exits all configuration submodes back to Privileged EXEC.',
    syntax: 'end',
    example: 'Router(config-if)# end',
  },
  {
    command: 'write memory',
    mode: 'Privileged EXEC',
    category: 'File System & Config',
    description: 'Saves running-config from volatile RAM into non-volatile NVRAM (startup-config).',
    syntax: 'write memory (or "wr")',
    example: 'Router# write memory',
  },
  {
    command: 'copy running-config startup-config',
    mode: 'Privileged EXEC',
    category: 'File System & Config',
    description: 'Copies active running configuration to startup configuration in NVRAM.',
    syntax: 'copy running-config startup-config',
    example: 'Router# copy run start',
  },
  {
    command: 'erase startup-config',
    mode: 'Privileged EXEC',
    category: 'File System & Config',
    description: 'Erases device configuration stored in NVRAM.',
    syntax: 'erase startup-config (or "write erase")',
    example: 'Switch# erase startup-config',
  },
  {
    command: 'reload',
    mode: 'Privileged EXEC',
    category: 'System Operations',
    description: 'Halts the system and reboots the operating software.',
    syntax: 'reload',
    example: 'Router# reload',
  },

  // Show & Verification Commands
  {
    command: 'show ip interface brief',
    mode: 'User / Priv EXEC',
    category: 'IP & Interfaces',
    description: 'Displays a one-line summary of all interfaces, assigned IP addresses, and Layer 1/2 status.',
    syntax: 'show ip interface brief [| include <filter>]',
    example: 'Router# show ip interface brief',
  },
  {
    command: 'show ip route',
    mode: 'User / Priv EXEC',
    category: 'IP & Routing',
    description: 'Displays the current IPv4 routing table including Connected, Static, OSPF, and BGP routes.',
    syntax: 'show ip route',
    example: 'Router# show ip route',
  },
  {
    command: 'show running-config',
    mode: 'Privileged EXEC',
    category: 'Verification',
    description: 'Displays the complete configuration currently running in system memory.',
    syntax: 'show running-config [| include | section <pattern>]',
    example: 'Router# show run | section router ospf',
  },
  {
    command: 'show startup-config',
    mode: 'Privileged EXEC',
    category: 'Verification',
    description: 'Displays saved configuration preserved in NVRAM.',
    syntax: 'show startup-config',
    example: 'Router# show startup-config',
  },
  {
    command: 'show vlan brief',
    mode: 'User / Priv EXEC',
    category: 'VLANs & Layer 2',
    description: 'Displays all configured VLANs with their names, status, and assigned access ports.',
    syntax: 'show vlan brief',
    example: 'Switch# show vlan brief',
  },
  {
    command: 'show interfaces trunk',
    mode: 'User / Priv EXEC',
    category: 'VLANs & Layer 2',
    description: 'Lists all 802.1Q trunking interfaces, native VLANs, and allowed VLAN ranges.',
    syntax: 'show interfaces trunk',
    example: 'Switch# show interfaces trunk',
  },
  {
    command: 'show interfaces switchport',
    mode: 'User / Priv EXEC',
    category: 'VLANs & Layer 2',
    description: 'Shows administrative and operational switchport modes, access VLANs, and Voice VLANs.',
    syntax: 'show interfaces switchport',
    example: 'Switch# show interfaces switchport',
  },
  {
    command: 'show mac address-table',
    mode: 'User / Priv EXEC',
    category: 'VLANs & Layer 2',
    description: 'Displays dynamic and static MAC address entries learned per VLAN and port.',
    syntax: 'show mac address-table',
    example: 'Switch# show mac address-table',
  },
  {
    command: 'show spanning-tree',
    mode: 'User / Priv EXEC',
    category: 'Spanning Tree (STP)',
    description: 'Shows Per-VLAN Spanning Tree (PVST+) status, Root Bridge IDs, port roles (ROOT/DESG/ALT) and states (FWD/BLK).',
    syntax: 'show spanning-tree [vlan <vlan-id>]',
    example: 'Switch# show spanning-tree vlan 10',
  },
  {
    command: 'show port-security',
    mode: 'User / Priv EXEC',
    category: 'Security & PortSec',
    description: 'Displays overall switch port security summary, violation counters, and actions.',
    syntax: 'show port-security [interface <name>] [address]',
    example: 'Switch# show port-security interface Fa0/1',
  },
  {
    command: 'show ip ospf neighbor',
    mode: 'User / Priv EXEC',
    category: 'OSPF & Routing',
    description: 'Displays OSPF neighbor adjacency states (FULL, 2WAY, INIT), Dead timers, and DR/BDR roles.',
    syntax: 'show ip ospf neighbor',
    example: 'Router# show ip ospf neighbor',
  },
  {
    command: 'show ip ospf interface',
    mode: 'User / Priv EXEC',
    category: 'OSPF & Routing',
    description: 'Shows OSPF area, interface cost, priority, network type, and hello intervals.',
    syntax: 'show ip ospf interface',
    example: 'Router# show ip ospf interface Gi0/0',
  },
  {
    command: 'show ip protocols',
    mode: 'User / Priv EXEC',
    category: 'IP & Routing',
    description: 'Displays active routing protocols, process IDs, router IDs, and advertised networks.',
    syntax: 'show ip protocols',
    example: 'Router# show ip protocols',
  },
  {
    command: 'show etherchannel summary',
    mode: 'User / Priv EXEC',
    category: 'EtherChannel & LACP',
    description: 'Displays Port-Channel bundles, operational protocols (LACP/PAgP), and bundled member ports.',
    syntax: 'show etherchannel summary',
    example: 'Switch# show etherchannel summary',
  },
  {
    command: 'show standby brief',
    mode: 'User / Priv EXEC',
    category: 'First Hop Redundancy (FHRP)',
    description: 'Displays HSRP group status, active and standby router IPs, and virtual gateway IP.',
    syntax: 'show standby brief',
    example: 'Router# show standby brief',
  },
  {
    command: 'show cdp neighbors',
    mode: 'User / Priv EXEC',
    category: 'Discovery Protocols',
    description: 'Displays directly connected Cisco devices discovered via Cisco Discovery Protocol.',
    syntax: 'show cdp neighbors [detail]',
    example: 'Switch# show cdp neighbors detail',
  },
  {
    command: 'show lldp neighbors',
    mode: 'User / Priv EXEC',
    category: 'Discovery Protocols',
    description: 'Displays standard 802.1AB Link Layer Discovery Protocol neighbors.',
    syntax: 'show lldp neighbors [detail]',
    example: 'Switch# show lldp neighbors',
  },
  {
    command: 'show access-lists',
    mode: 'Privileged EXEC',
    category: 'Security & ACL',
    description: 'Displays configured standard and extended Access Control Lists and match statistics.',
    syntax: 'show access-lists [id]',
    example: 'Router# show access-lists',
  },
  {
    command: 'show ip dhcp binding',
    mode: 'User / Priv EXEC',
    category: 'DHCP & Services',
    description: 'Displays IP addresses leased to client MAC addresses by the local DHCP server.',
    syntax: 'show ip dhcp binding',
    example: 'Router# show ip dhcp binding',
  },
  {
    command: 'show ip dhcp snooping',
    mode: 'User / Priv EXEC',
    category: 'Security & DHCP',
    description: 'Shows DHCP snooping status across VLANs and trusted versus untrusted ports.',
    syntax: 'show ip dhcp snooping',
    example: 'Switch# show ip dhcp snooping',
  },
  {
    command: 'show ip nat translations',
    mode: 'User / Priv EXEC',
    category: 'NAT & PAT',
    description: 'Displays active NAT and PAT translation slots (inside local, inside global, outside).',
    syntax: 'show ip nat translations',
    example: 'Router# show ip nat translations',
  },
  {
    command: 'show version',
    mode: 'User / Priv EXEC',
    category: 'System Operations',
    description: 'Displays software version, system uptime, processor type, memory, and config register.',
    syntax: 'show version',
    example: 'Router# show version',
  },

  // Pipe Output Filtering
  {
    command: '| include <pattern>',
    mode: 'Output Modifier',
    category: 'CLI Output Filters',
    description: 'Filters command output to only display lines containing the matching expression.',
    syntax: '<show command> | include <regex/text>',
    example: 'Router# show run | include ip route',
  },
  {
    command: '| exclude <pattern>',
    mode: 'Output Modifier',
    category: 'CLI Output Filters',
    description: 'Filters command output to omit lines matching the specified pattern.',
    syntax: '<show command> | exclude <regex/text>',
    example: 'Router# show ip int br | exclude unassigned',
  },
  {
    command: '| begin <pattern>',
    mode: 'Output Modifier',
    category: 'CLI Output Filters',
    description: 'Begins output starting from the first line matching the pattern.',
    syntax: '<show command> | begin <regex/text>',
    example: 'Router# show run | begin line vty',
  },
  {
    command: '| section <pattern>',
    mode: 'Output Modifier',
    category: 'CLI Output Filters',
    description: 'Displays only the configuration block/section starting with the matched header.',
    syntax: '<show command> | section <regex/text>',
    example: 'Router# show run | section router ospf',
  },
  {
    command: '| count',
    mode: 'Output Modifier',
    category: 'CLI Output Filters',
    description: 'Counts the number of lines generated by the command output.',
    syntax: '<show command> | count',
    example: 'Switch# show mac address-table | count',
  },

  // Global Config Commands
  {
    command: 'hostname <name>',
    mode: 'Global Config',
    category: 'Configuration',
    description: 'Assigns network device name displayed in the CLI prompt.',
    syntax: 'hostname <string>',
    example: 'Router(config)# hostname Core-R1',
  },
  {
    command: 'ip routing',
    mode: 'Global Config',
    category: 'IP & Routing',
    description: 'Enables IPv4 routing on Layer 3 switches or routers.',
    syntax: 'ip routing',
    example: 'Switch(config)# ip routing',
  },
  {
    command: 'ip route <net> <mask> <next-hop>',
    mode: 'Global Config',
    category: 'IP & Routing',
    description: 'Configures a static IPv4 route (or default route 0.0.0.0 0.0.0.0).',
    syntax: 'ip route <network> <mask> <next-hop-ip>',
    example: 'Router(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1',
  },
  {
    command: 'ip default-gateway <ip>',
    mode: 'Global Config',
    category: 'IP & Interfaces',
    description: 'Specifies default gateway for a Layer 2 switch management IP.',
    syntax: 'ip default-gateway <ip-address>',
    example: 'Switch(config)# ip default-gateway 192.168.1.1',
  },
  {
    command: 'vlan <vlan-id>',
    mode: 'Global Config',
    category: 'VLANs & Layer 2',
    description: 'Enters VLAN configuration mode to create or rename a VLAN (1-4094).',
    syntax: 'vlan <1-4094>',
    example: 'Switch(config)# vlan 10',
  },
  {
    command: 'spanning-tree vlan <id> priority <val>',
    mode: 'Global Config',
    category: 'Spanning Tree (STP)',
    description: 'Sets bridge priority for STP root election in increments of 4096 (e.g. 0, 4096, 24576, 32768).',
    syntax: 'spanning-tree vlan <id> priority <0, 4096, ... 61440>',
    example: 'Switch(config)# spanning-tree vlan 1 priority 4096',
  },
  {
    command: 'spanning-tree vlan <id> root primary',
    mode: 'Global Config',
    category: 'Spanning Tree (STP)',
    description: 'Automatically sets bridge priority to 24576 to become the primary STP root bridge.',
    syntax: 'spanning-tree vlan <id> root primary',
    example: 'Switch(config)# spanning-tree vlan 1 root primary',
  },
  {
    command: 'spanning-tree mode rapid-pvst',
    mode: 'Global Config',
    category: 'Spanning Tree (STP)',
    description: 'Changes spanning tree operating mode to 802.1w Rapid PVST+.',
    syntax: 'spanning-tree mode [pvst | rapid-pvst]',
    example: 'Switch(config)# spanning-tree mode rapid-pvst',
  },
  {
    command: 'spanning-tree portfast default',
    mode: 'Global Config',
    category: 'Spanning Tree (STP)',
    description: 'Globally enables PortFast on all non-trunking access interfaces.',
    syntax: 'spanning-tree portfast default',
    example: 'Switch(config)# spanning-tree portfast default',
  },
  {
    command: 'router ospf <process-id>',
    mode: 'Global Config',
    category: 'OSPF & Routing',
    description: 'Initializes an OSPF routing process and enters router configuration mode.',
    syntax: 'router ospf <1-65535>',
    example: 'Router(config)# router ospf 1',
  },
  {
    command: 'ip dhcp pool <name>',
    mode: 'Global Config',
    category: 'DHCP & Services',
    description: 'Creates a DHCP address allocation pool and enters DHCP pool config mode.',
    syntax: 'ip dhcp pool <name>',
    example: 'Router(config)# ip dhcp pool LAN-POOL',
  },
  {
    command: 'ip dhcp excluded-address <low> [high]',
    mode: 'Global Config',
    category: 'DHCP & Services',
    description: 'Excludes static IP addresses (routers, printers, servers) from being leased by DHCP.',
    syntax: 'ip dhcp excluded-address <start-ip> [end-ip]',
    example: 'Router(config)# ip dhcp excluded-address 192.168.1.1 192.168.1.10',
  },
  {
    command: 'access-list <id> permit|deny <source>',
    mode: 'Global Config',
    category: 'Security & ACL',
    description: 'Defines an entry in a standard IPv4 Access List (1-99).',
    syntax: 'access-list <1-99> {permit | deny} <source-ip> [wildcard]',
    example: 'Router(config)# access-list 10 permit 192.168.1.0 0.0.0.255',
  },
  {
    command: 'line vty 0 4',
    mode: 'Global Config',
    category: 'Management & Lines',
    description: 'Enters virtual terminal line configuration for remote Telnet/SSH access.',
    syntax: 'line vty <start> <end>',
    example: 'Router(config)# line vty 0 4',
  },

  // Interface Config Commands
  {
    command: 'ip address <ip> <mask>',
    mode: 'Interface Config',
    category: 'IP & Interfaces',
    description: 'Assigns an IPv4 address and subnet mask to the selected interface.',
    syntax: 'ip address <ip-address> <subnet-mask>',
    example: 'Router(config-if)# ip address 192.168.1.1 255.255.255.0',
  },
  {
    command: 'no shutdown',
    mode: 'Interface Config',
    category: 'IP & Interfaces',
    description: 'Enables the interface and brings it up administratively.',
    syntax: 'no shutdown (or "no shut")',
    example: 'Router(config-if)# no shutdown',
  },
  {
    command: 'shutdown',
    mode: 'Interface Config',
    category: 'IP & Interfaces',
    description: 'Disables the interface administratively.',
    syntax: 'shutdown (or "shut")',
    example: 'Router(config-if)# shutdown',
  },
  {
    command: 'switchport mode access',
    mode: 'Interface Config',
    category: 'VLANs & Layer 2',
    description: 'Configures the port as a static access port connected to an end device.',
    syntax: 'switchport mode access',
    example: 'Switch(config-if)# switchport mode access',
  },
  {
    command: 'switchport access vlan <id>',
    mode: 'Interface Config',
    category: 'VLANs & Layer 2',
    description: 'Assigns an access port to a specific VLAN.',
    syntax: 'switchport access vlan <1-4094>',
    example: 'Switch(config-if)# switchport access vlan 10',
  },
  {
    command: 'switchport mode trunk',
    mode: 'Interface Config',
    category: 'VLANs & Layer 2',
    description: 'Configures the port as an 802.1Q trunk link carrying multiple VLANs.',
    syntax: 'switchport mode trunk',
    example: 'Switch(config-if)# switchport mode trunk',
  },
  {
    command: 'switchport trunk allowed vlan <vlans>',
    mode: 'Interface Config',
    category: 'VLANs & Layer 2',
    description: 'Limits which VLANs are allowed across the trunk link.',
    syntax: 'switchport trunk allowed vlan {all | <list> | add <list> | remove <list>}',
    example: 'Switch(config-if)# switchport trunk allowed vlan 10,20',
  },
  {
    command: 'switchport trunk native vlan <id>',
    mode: 'Interface Config',
    category: 'VLANs & Layer 2',
    description: 'Specifies the native (untagged) VLAN for the 802.1Q trunk.',
    syntax: 'switchport trunk native vlan <1-4094>',
    example: 'Switch(config-if)# switchport trunk native vlan 99',
  },
  {
    command: 'switchport port-security',
    mode: 'Interface Config',
    category: 'Security & PortSec',
    description: 'Enables port security on the access interface.',
    syntax: 'switchport port-security',
    example: 'Switch(config-if)# switchport port-security',
  },
  {
    command: 'switchport port-security maximum <count>',
    mode: 'Interface Config',
    category: 'Security & PortSec',
    description: 'Sets maximum number of secure MAC addresses allowed on this port.',
    syntax: 'switchport port-security maximum <1-1024>',
    example: 'Switch(config-if)# switchport port-security maximum 2',
  },
  {
    command: 'switchport port-security mac-address sticky',
    mode: 'Interface Config',
    category: 'Security & PortSec',
    description: 'Learns connected MAC addresses dynamically and saves them permanently into running-config.',
    syntax: 'switchport port-security mac-address sticky',
    example: 'Switch(config-if)# switchport port-security mac-address sticky',
  },
  {
    command: 'switchport port-security violation shutdown',
    mode: 'Interface Config',
    category: 'Security & PortSec',
    description: 'Configures port to transition to err-disabled shutdown state upon security violation.',
    syntax: 'switchport port-security violation {shutdown | restrict | protect}',
    example: 'Switch(config-if)# switchport port-security violation shutdown',
  },
  {
    command: 'encapsulation dot1Q <vlan-id>',
    mode: 'Subinterface Config',
    category: 'Inter-VLAN (RaaS)',
    description: 'Defines 802.1Q encapsulation and VLAN tag on router subinterfaces (Router-on-a-Stick).',
    syntax: 'encapsulation dot1Q <vlan-id>',
    example: 'Router(config-subif)# encapsulation dot1Q 10',
  },
  {
    command: 'ip helper-address <ip>',
    mode: 'Interface Config',
    category: 'DHCP & Services',
    description: 'Forwards UDP DHCP broadcast packets to a centralized DHCP server (DHCP Relay Agent).',
    syntax: 'ip helper-address <dhcp-server-ip>',
    example: 'Router(config-if)# ip helper-address 192.168.100.10',
  },
  {
    command: 'channel-group <num> mode active',
    mode: 'Interface Config',
    category: 'EtherChannel & LACP',
    description: 'Binds the interface into an LACP EtherChannel bundle using active negotiation.',
    syntax: 'channel-group <1-64> mode {active | passive | on}',
    example: 'Switch(config-if)# channel-group 1 mode active',
  },
  {
    command: 'standby <grp> ip <virtual-ip>',
    mode: 'Interface Config',
    category: 'First Hop Redundancy (FHRP)',
    description: 'Activates HSRP on the interface and assigns the shared virtual default gateway IP.',
    syntax: 'standby <1-255> ip <virtual-ip>',
    example: 'Router(config-if)# standby 1 ip 192.168.1.254',
  },
  {
    command: 'standby <grp> priority <val>',
    mode: 'Interface Config',
    category: 'First Hop Redundancy (FHRP)',
    description: 'Sets HSRP priority for active router election (default 100). Higher wins.',
    syntax: 'standby <1-255> priority <1-255>',
    example: 'Router(config-if)# standby 1 priority 110',
  },
  {
    command: 'standby <grp> preempt',
    mode: 'Interface Config',
    category: 'First Hop Redundancy (FHRP)',
    description: 'Allows router with higher priority to immediately reclaim Active role upon boot.',
    syntax: 'standby <1-255> preempt',
    example: 'Router(config-if)# standby 1 preempt',
  },

  // Router Submode
  {
    command: 'network <net> <wildcard> area <area-id>',
    mode: 'Router OSPF Config',
    category: 'OSPF & Routing',
    description: 'Enables OSPF routing on matching interfaces in the specified area (e.g. area 0).',
    syntax: 'network <network-address> <wildcard-mask> area <area-id>',
    example: 'Router(config-router)# network 192.168.1.0 0.0.0.255 area 0',
  },
  {
    command: 'router-id <ip>',
    mode: 'Router OSPF Config',
    category: 'OSPF & Routing',
    description: 'Assigns an explicit 32-bit dotted-decimal router identifier for OSPF.',
    syntax: 'router-id <ip-address>',
    example: 'Router(config-router)# router-id 1.1.1.1',
  },
  {
    command: 'passive-interface <iface>',
    mode: 'Router OSPF Config',
    category: 'OSPF & Routing',
    description: 'Suppresses OSPF hello broadcasts out of client access networks while still advertising the subnet.',
    syntax: 'passive-interface <interface-name>',
    example: 'Router(config-router)# passive-interface GigabitEthernet0/0',
  },
  {
    command: 'default-information originate',
    mode: 'Router OSPF Config',
    category: 'OSPF & Routing',
    description: 'Advertises the router default gateway route (0.0.0.0/0) into the OSPF domain.',
    syntax: 'default-information originate',
    example: 'Router(config-router)# default-information originate',
  },

  // Line Submode
  {
    command: 'login local',
    mode: 'Line Config',
    category: 'Management & Lines',
    description: 'Enforces authentication using local usernames and passwords created in global config.',
    syntax: 'login local',
    example: 'Router(config-line)# login local',
  },
  {
    command: 'transport input ssh',
    mode: 'Line Config',
    category: 'Management & Lines',
    description: 'Restricts incoming VTY connections to Secure Shell (SSH) only, blocking insecure Telnet.',
    syntax: 'transport input {ssh | telnet | all | none}',
    example: 'Router(config-line)# transport input ssh',
  },
  {
    command: 'logging synchronous',
    mode: 'Line Config',
    category: 'Management & Lines',
    description: 'Prevents console syslog messages from interrupting currently typed commands.',
    syntax: 'logging synchronous',
    example: 'Router(config-line)# logging synchronous',
  },
];

interface CommandReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCommand?: (cmd: string) => void;
}

export const CommandReferenceModal: React.FC<CommandReferenceModalProps> = ({
  isOpen,
  onClose,
  onInsertCommand,
}) => {
  const [viewMode, setViewMode] = useState<'rosetta' | 'cisco'>('rosetta');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const ciscoCategories = [
    'All',
    'EXEC Navigation',
    'Verification',
    'CLI Output Filters',
    'IP & Interfaces',
    'IP & Routing',
    'VLANs & Layer 2',
    'Spanning Tree (STP)',
    'OSPF & Routing',
    'Security & PortSec',
    'Security & ACL',
    'EtherChannel & LACP',
    'First Hop Redundancy (FHRP)',
    'DHCP & Services',
    'Management & Lines',
    'File System & Config',
  ];

  const rosettaCategories = [
    'All',
    'Interfaces & IP',
    'Routing & Gateways',
    'VLANs & Switching',
    'Routing Protocols (OSPF)',
    'ARP & Tables',
    'Save & Commit',
    'Diagnostics & Troubleshooting',
    'System & Identity',
  ];

  const categories = viewMode === 'rosetta' ? rosettaCategories : ciscoCategories;

  const filteredCommands = COMMAND_REFERENCE_LIST.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.command.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.syntax.toLowerCase().includes(term) ||
      item.mode.toLowerCase().includes(term);
    return matchesCat && matchesSearch;
  });

  const filteredRosetta = MULTI_VENDOR_ROSETTA_STONE.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.task.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.cisco.toLowerCase().includes(term) ||
      item.juniper.toLowerCase().includes(term) ||
      item.arista.toLowerCase().includes(term) ||
      item.linux.toLowerCase().includes(term) ||
      item.mikrotik.toLowerCase().includes(term) ||
      item.note.toLowerCase().includes(term);
    return matchesCat && matchesSearch;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/40">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Universal Network CLI & Multi-Vendor Command Matrix
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  Universal Simulator Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cross-Vendor CLI Translation: Cisco IOS · Juniper Junos · Arista EOS · Linux / VyOS · MikroTik RouterOS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => {
                  setViewMode('rosetta');
                  setSelectedCategory('All');
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'rosetta'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Cross-Vendor Rosetta Stone
              </button>
              <button
                onClick={() => {
                  setViewMode('cisco');
                  setSelectedCategory('All');
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'cisco'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Cisco IOS Encyclopedia
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                viewMode === 'rosetta'
                  ? 'Search networking task, syntax, or command across all 5 vendors (e.g. show ip route, commit, ping, vlan)...'
                  : 'Search Cisco commands, syntax, keywords, or descriptions...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 outline-none focus:border-sky-500 font-mono transition-colors"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500 font-medium cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Vendor Profile Badges Bar (Rosetta view) */}
        {viewMode === 'rosetta' && (
          <div className="px-6 py-2 bg-slate-950/80 border-b border-slate-800/80 text-[11px] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-semibold mr-1">Supported NOS Dialects:</span>
              {Object.values(VENDOR_OS_PROFILES).map((prof) => (
                <span
                  key={prof.id}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${prof.badgeColor}`}
                >
                  {prof.badge}
                </span>
              ))}
            </div>
            <span className="text-slate-500 font-mono text-[10px]">
              Showing {filteredRosetta.length} Operations in {selectedCategory}
            </span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3 bg-slate-950/40">
          {viewMode === 'rosetta' ? (
            /* ========================================================= */
            /* MULTI-VENDOR ROSETTA STONE MATRIX                         */
            /* ========================================================= */
            filteredRosetta.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Globe className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm font-semibold text-slate-400">No matching multi-vendor operations found</p>
                <p className="text-xs text-slate-500 mt-1">Try another search keyword or switch category to "All".</p>
              </div>
            ) : (
              filteredRosetta.map((entry, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-3 shadow-sm"
                >
                  {/* Task Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{entry.task}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                        {entry.category}
                      </span>
                    </div>
                  </div>

                  {/* Multi-Vendor Comparison Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                    {/* 1. Cisco IOS */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-sky-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-sky-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          Cisco IOS / IOS-XE
                        </span>
                        <button
                          onClick={() => handleCopy(entry.cisco)}
                          title="Copy Cisco command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap leading-tight break-all">
                        {entry.cisco}
                      </pre>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(entry.cisco.split('\n')[0]);
                            onClose();
                          }}
                          className="mt-2 text-[9px] font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 py-0.5 px-1.5 rounded border border-sky-500/30 self-start cursor-pointer"
                        >
                          Insert
                        </button>
                      )}
                    </div>

                    {/* 2. Juniper Junos */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-emerald-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Juniper Junos OS
                        </span>
                        <button
                          onClick={() => handleCopy(entry.juniper)}
                          title="Copy Juniper command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-emerald-300 whitespace-pre-wrap leading-tight break-all">
                        {entry.juniper}
                      </pre>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(entry.juniper.split('\n')[0]);
                            onClose();
                          }}
                          className="mt-2 text-[9px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 py-0.5 px-1.5 rounded border border-emerald-500/30 self-start cursor-pointer"
                        >
                          Insert
                        </button>
                      )}
                    </div>

                    {/* 3. Arista EOS */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-indigo-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          Arista EOS
                        </span>
                        <button
                          onClick={() => handleCopy(entry.arista)}
                          title="Copy Arista command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-indigo-300 whitespace-pre-wrap leading-tight break-all">
                        {entry.arista}
                      </pre>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(entry.arista.split('\n')[0]);
                            onClose();
                          }}
                          className="mt-2 text-[9px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 py-0.5 px-1.5 rounded border border-indigo-500/30 self-start cursor-pointer"
                        >
                          Insert
                        </button>
                      )}
                    </div>

                    {/* 4. Linux / VyOS */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Linux / VyOS
                        </span>
                        <button
                          onClick={() => handleCopy(entry.linux)}
                          title="Copy Linux command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-amber-300 whitespace-pre-wrap leading-tight break-all">
                        {entry.linux}
                      </pre>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(entry.linux.split('\n')[0]);
                            onClose();
                          }}
                          className="mt-2 text-[9px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 py-0.5 px-1.5 rounded border border-amber-500/30 self-start cursor-pointer"
                        >
                          Insert
                        </button>
                      )}
                    </div>

                    {/* 5. MikroTik RouterOS */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-rose-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          MikroTik RouterOS
                        </span>
                        <button
                          onClick={() => handleCopy(entry.mikrotik)}
                          title="Copy MikroTik command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-rose-300 whitespace-pre-wrap leading-tight break-all">
                        {entry.mikrotik}
                      </pre>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(entry.mikrotik.split('\n')[0]);
                            onClose();
                          }}
                          className="mt-2 text-[9px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 py-0.5 px-1.5 rounded border border-rose-500/30 self-start cursor-pointer"
                        >
                          Insert
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Architecture & Engineering Note */}
                  <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                    <span className="text-sky-400 font-bold uppercase text-[9px] shrink-0 mt-0.5">Note:</span>
                    <span>{entry.note}</span>
                  </div>
                </div>
              ))
            )
          ) : (
            /* ========================================================= */
            /* CISCO IOS SINGLE COMMAND ENCYCLOPEDIA                     */
            /* ========================================================= */
            filteredCommands.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <BookOpen className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm font-semibold text-slate-400">No matching commands found</p>
                <p className="text-xs text-slate-500 mt-1">Try another search keyword or select "All" categories.</p>
              </div>
            ) : (
              filteredCommands.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-2 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/50">
                        {item.command}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {item.mode}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopy(item.example)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copy command to clipboard"
                      >
                        {copiedCmd === item.example ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(item.example.replace(/^.*?#\s*|.*?>\s*|.*?\(config.*?\)?#\s*/, ''));
                            onClose();
                          }}
                          className="px-2 py-1 rounded bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 text-xs font-semibold transition-colors cursor-pointer"
                          title="Send to active device CLI"
                        >
                          Insert
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/60 text-slate-400">
                      <span className="text-slate-500 text-[10px] block uppercase font-sans font-bold">Syntax</span>
                      <span className="text-amber-300/90">{item.syntax}</span>
                    </div>
                    <div className="bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/60 text-slate-400">
                      <span className="text-slate-500 text-[10px] block uppercase font-sans font-bold">Example</span>
                      <span className="text-emerald-400">{item.example}</span>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <span>WireCraft Universal Network Operating System Architecture</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400">Cisco · Juniper · Arista · Linux/VyOS · MikroTik</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors cursor-pointer"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
};

