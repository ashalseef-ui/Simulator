import { CommandNode } from './types';

export const COMMAND_TREE_REGISTRY: CommandNode[] = [
  // ==========================================
  // USER & PRIVILEGED EXEC MODE COMMANDS
  // ==========================================
  {
    name: 'enable',
    aliases: ['en'],
    description: 'Turn on privileged commands',
    modes: ['user'],
  },
  {
    name: 'disable',
    aliases: ['dis'],
    description: 'Turn off privileged commands',
    modes: ['priv'],
  },
  {
    name: 'configure',
    aliases: ['conf', 'config'],
    description: 'Enter configuration mode',
    modes: ['priv'],
    children: [
      { name: 'terminal', aliases: ['t'], description: 'Configure from the terminal', modes: ['priv'] },
      { name: 'memory', aliases: ['mem'], description: 'Configure from NVRAM memory', modes: ['priv'] },
    ],
  },
  {
    name: 'ping',
    aliases: ['p'],
    description: 'Send echo messages (ICMP)',
    modes: ['user', 'priv'],
  },
  {
    name: 'traceroute',
    aliases: ['trace', 'tr'],
    description: 'Trace route to destination',
    modes: ['user', 'priv'],
  },
  {
    name: 'ssh',
    aliases: [],
    description: 'Open a secure shell client connection',
    modes: ['priv'],
  },
  {
    name: 'telnet',
    aliases: ['tel'],
    description: 'Open a telnet connection to a remote host',
    modes: ['priv'],
  },
  {
    name: 'terminal',
    aliases: ['term'],
    description: 'Set terminal line parameters',
    modes: ['priv'],
    children: [
      { name: 'monitor', aliases: ['mon'], description: 'Copy debug output to current terminal', modes: ['priv'] },
      { name: 'no', description: 'Disable terminal monitor', modes: ['priv'] },
      { name: 'length', description: 'Set number of lines on a screen', modes: ['priv'] },
      { name: 'width', description: 'Set number of characters on a screen line', modes: ['priv'] },
    ],
  },
  {
    name: 'write',
    aliases: ['wr'],
    description: 'Write running configuration to memory',
    modes: ['priv'],
    children: [
      { name: 'memory', aliases: ['mem'], description: 'Write to NVRAM', modes: ['priv'] },
      { name: 'erase', description: 'Erase NVRAM configuration', modes: ['priv'] },
      { name: 'terminal', description: 'Display running configuration', modes: ['priv'] },
    ],
  },
  {
    name: 'copy',
    aliases: ['cp'],
    description: 'Copy configuration or image files',
    modes: ['priv'],
    children: [
      { name: 'running-config', aliases: ['run'], description: 'Copy running configuration', modes: ['priv'] },
      { name: 'startup-config', aliases: ['start'], description: 'Copy startup configuration', modes: ['priv'] },
      { name: 'flash:', description: 'Copy file from flash', modes: ['priv'] },
      { name: 'tftp:', description: 'Copy file from TFTP server', modes: ['priv'] },
    ],
  },
  {
    name: 'erase',
    aliases: [],
    description: 'Erase a filesystem or configuration',
    modes: ['priv'],
    children: [
      { name: 'startup-config', aliases: ['start'], description: 'Erase NVRAM startup config', modes: ['priv'] },
      { name: 'nvram:', description: 'Erase NVRAM filesystem', modes: ['priv'] },
    ],
  },
  {
    name: 'reload',
    aliases: ['rel'],
    description: 'Halt and perform a cold restart',
    modes: ['priv'],
  },
  {
    name: 'clock',
    aliases: [],
    description: 'Manage the system clock',
    modes: ['priv'],
    children: [
      { name: 'set', description: 'Set the time and date', modes: ['priv'] },
    ],
  },
  {
    name: 'debug',
    aliases: ['deb'],
    description: 'Debugging functions (use with caution)',
    modes: ['priv'],
    children: [
      { name: 'all', description: 'Enable all debugging facilities', modes: ['priv'] },
      { name: 'ip', description: 'IP protocol debugging (icmp, ospf, packet, dhcp)', modes: ['priv'] },
      { name: 'spanning-tree', aliases: ['stp'], description: 'Spanning Tree Protocol debugging', modes: ['priv'] },
      { name: 'arp', description: 'ARP packet debugging', modes: ['priv'] },
    ],
  },
  {
    name: 'undebug',
    aliases: ['u', 'undeb'],
    description: 'Disable debugging functions',
    modes: ['priv'],
    children: [
      { name: 'all', description: 'Turn off all debugging', modes: ['priv'] },
      { name: 'ip', description: 'Turn off IP debugging', modes: ['priv'] },
    ],
  },
  {
    name: 'clear',
    aliases: ['clr'],
    description: 'Reset counters, arp, mac, or routing tables',
    modes: ['priv'],
    children: [
      { name: 'arp-cache', aliases: ['arp'], description: 'Clear dynamic ARP cache', modes: ['priv'] },
      { name: 'mac', description: 'Clear dynamic MAC address table entries', modes: ['priv'] },
      { name: 'ip', description: 'Clear IP routing table, ospf, or nat translations', modes: ['priv'] },
      { name: 'counters', description: 'Clear interface packet counters', modes: ['priv'] },
      { name: 'logging', description: 'Clear logging buffer', modes: ['priv'] },
    ],
  },
  {
    name: 'redundancy',
    aliases: ['red'],
    description: 'Redundancy facility commands (Stateful Switchover)',
    modes: ['priv'],
    children: [
      { name: 'force-switchover', description: 'Force switchover to standby master', modes: ['priv'] },
    ],
  },

  // ==========================================
  // SHOW COMMAND HIERARCHY (User & Priv)
  // ==========================================
  {
    name: 'show',
    aliases: ['sh'],
    description: 'Show running system information',
    modes: ['user', 'priv'],
    children: [
      { name: 'ip', description: 'IP information (interface, route, ospf, bgp, nat, dhcp, protocols, access-lists, arp, ssh, sla)', modes: ['user', 'priv'] },
      { name: 'ipv6', description: 'IPv6 information (interface brief, route)', modes: ['user', 'priv'] },
      { name: 'interfaces', aliases: ['int'], description: 'Interface status, switchport, trunk, and counters', modes: ['user', 'priv'] },
      { name: 'running-config', aliases: ['run'], description: 'Current operating configuration in RAM', modes: ['priv'] },
      { name: 'startup-config', aliases: ['start'], description: 'Contents of startup configuration in NVRAM', modes: ['priv'] },
      { name: 'spanning-tree', aliases: ['span', 'stp'], description: 'Spanning Tree topology & PVST+ details', modes: ['user', 'priv'] },
      { name: 'vlan', aliases: ['vl'], description: 'VLAN status, brief table, and ID details', modes: ['user', 'priv'] },
      { name: 'mac', description: 'MAC address table', modes: ['user', 'priv'] },
      { name: 'mac-address-table', aliases: ['mac-addr'], description: 'MAC address table', modes: ['user', 'priv'] },
      { name: 'cdp', description: 'CDP neighbor and interface information', modes: ['user', 'priv'] },
      { name: 'lldp', description: 'LLDP neighbor and interface information', modes: ['user', 'priv'] },
      { name: 'version', aliases: ['ver'], description: 'System hardware & software version status', modes: ['user', 'priv'] },
      { name: 'access-lists', aliases: ['access-list', 'acl'], description: 'List IP standard/extended access lists', modes: ['priv'] },
      { name: 'port-security', aliases: ['port-sec'], description: 'Port security status and address table', modes: ['user', 'priv'] },
      { name: 'etherchannel', aliases: ['ether', 'channel-group'], description: 'EtherChannel and LACP bundle status', modes: ['user', 'priv'] },
      { name: 'standby', aliases: ['hsrp'], description: 'HSRP standby group status and timers', modes: ['user', 'priv'] },
      { name: 'vrrp', description: 'VRRP router redundancy group status', modes: ['user', 'priv'] },
      { name: 'glbp', description: 'GLBP gateway load balancing protocol status', modes: ['user', 'priv'] },
      { name: 'arp', description: 'ARP resolution cache table', modes: ['user', 'priv'] },
      { name: 'hosts', aliases: ['host'], description: 'IP domain lookup and static host cache', modes: ['user', 'priv'] },
      { name: 'vtp', description: 'VLAN Trunking Protocol status & domain', modes: ['user', 'priv'] },
      { name: 'clock', description: 'Display current system clock and UTC time', modes: ['user', 'priv'] },
      { name: 'history', aliases: ['hist'], description: 'Display session CLI execution history', modes: ['user', 'priv'] },
      { name: 'users', description: 'Display active VTY / console sessions', modes: ['user', 'priv'] },
      { name: 'flash:', aliases: ['flash', 'dir'], description: 'List files in flash filesystem', modes: ['user', 'priv'] },
      { name: 'inventory', aliases: ['inv'], description: 'Show chassis hardware inventory & serials', modes: ['user', 'priv'] },
      { name: 'logging', aliases: ['log'], description: 'Show syslog buffer and logging destinations', modes: ['user', 'priv'] },
      { name: 'processes', aliases: ['proc'], description: 'CPU utilization and active processes', modes: ['user', 'priv'] },
      { name: 'memory', aliases: ['mem'], description: 'System memory pool utilization', modes: ['user', 'priv'] },
      { name: 'tech-support', aliases: ['tech'], description: 'Detailed diagnostic health report for TAC', modes: ['priv'] },
      { name: 'switch', description: 'Cisco SwitchWise stack topology and rings', modes: ['user', 'priv'] },
      { name: 'redundancy', aliases: ['red'], description: 'SSO High Availability state', modes: ['user', 'priv'] },
      { name: 'ntp', description: 'NTP synchronization status and associations', modes: ['user', 'priv'] },
      { name: 'track', description: 'IP SLA tracking objects status', modes: ['user', 'priv'] },
      { name: 'policy-map', aliases: ['policy'], description: 'QoS policy maps and DSCP queueing', modes: ['user', 'priv'] },
      { name: 'class-map', aliases: ['class'], description: 'QoS traffic class classifications', modes: ['user', 'priv'] },
      { name: 'crypto', description: 'Cryptographic RSA keys and certificates', modes: ['priv'] },
      { name: 'feature', description: 'NX-OS enabled system features', modes: ['user', 'priv'] },
      { name: 'vpc', description: 'NX-OS Virtual PortChannel status', modes: ['user', 'priv'] },
      { name: 'vrf', description: 'VRF routing instances table', modes: ['user', 'priv'] },
      { name: 'wlan', description: 'WLC Wireless LAN SSIDs and status', modes: ['user', 'priv'] },
      { name: 'ap', description: 'WLC Registered Access Points', modes: ['user', 'priv'] },
      { name: 'client', description: 'WLC Associated wireless clients', modes: ['user', 'priv'] },
      { name: 'sysinfo', description: 'WLC controller operating system info', modes: ['user', 'priv'] },
      { name: 'nameif', description: 'ASA firewall security zones', modes: ['user', 'priv'] },
      { name: 'conn', description: 'ASA firewall active connection table', modes: ['user', 'priv'] },
      { name: 'xlate', description: 'ASA firewall NAT translation slots', modes: ['user', 'priv'] },
    ],
  },

  // ==========================================
  // GLOBAL CONFIGURATION MODE (config)
  // ==========================================
  {
    name: 'hostname',
    aliases: ['host'],
    description: 'Set system network name',
    modes: ['config'],
  },
  {
    name: 'interface',
    aliases: ['int'],
    description: 'Select an interface or range to configure',
    modes: ['config'],
  },
  {
    name: 'ip',
    aliases: [],
    description: 'Global IP configuration subcommands',
    modes: ['config'],
    children: [
      { name: 'route', description: 'Establish static IPv4 routes', modes: ['config'] },
      { name: 'routing', description: 'Enable IPv4 packet routing (Layer 3 forwarding)', modes: ['config'] },
      { name: 'default-gateway', description: 'Specify default gateway (Layer 2 management)', modes: ['config'] },
      { name: 'dhcp', description: 'Configure DHCP server pool, snooping, or exclusions', modes: ['config'] },
      { name: 'domain-name', description: 'Define the default domain name for DNS and SSH', modes: ['config'] },
      { name: 'domain-lookup', description: 'Enable DNS resolution', modes: ['config'] },
      { name: 'name-server', description: 'Specify DNS servers', modes: ['config'] },
      { name: 'host', description: 'Define static hostname to IP mapping', modes: ['config'] },
      { name: 'ssh', description: 'Configure SSH version parameters', modes: ['config'] },
      { name: 'nat', description: 'Configure NAT inside/outside source translation', modes: ['config'] },
      { name: 'sla', description: 'Configure IP SLA synthetic probes', modes: ['config'] },
    ],
  },
  {
    name: 'ipv6',
    aliases: [],
    description: 'Global IPv6 configuration subcommands',
    modes: ['config'],
    children: [
      { name: 'unicast-routing', description: 'Enable IPv6 packet forwarding', modes: ['config'] },
      { name: 'route', description: 'Establish static IPv6 route', modes: ['config'] },
    ],
  },
  {
    name: 'router',
    aliases: ['ro'],
    description: 'Enable a routing process',
    modes: ['config'],
    children: [
      { name: 'ospf', description: 'Open Shortest Path First (OSPF)', modes: ['config'] },
      { name: 'bgp', description: 'Border Gateway Protocol (BGP)', modes: ['config'] },
      { name: 'eigrp', description: 'Enhanced Interior Gateway Routing Protocol', modes: ['config'] },
      { name: 'rip', description: 'Routing Information Protocol', modes: ['config'] },
    ],
  },
  {
    name: 'vlan',
    aliases: ['vl'],
    description: 'VLAN database configuration commands (1-4094)',
    modes: ['config'],
  },
  {
    name: 'vtp',
    aliases: [],
    description: 'Configure VLAN Trunking Protocol (mode, domain, password)',
    modes: ['config'],
    children: [
      { name: 'mode', description: 'Set VTP mode (server, client, transparent, off)', modes: ['config'] },
      { name: 'domain', description: 'Set VTP administrative domain name', modes: ['config'] },
      { name: 'password', description: 'Set VTP domain password', modes: ['config'] },
    ],
  },
  {
    name: 'line',
    aliases: [],
    description: 'Configure a terminal line (console, vty)',
    modes: ['config'],
    children: [
      { name: 'con', aliases: ['console'], description: 'Primary console terminal line (con 0)', modes: ['config'] },
      { name: 'vty', description: 'Virtual terminal lines (vty 0 4, 0 15)', modes: ['config'] },
    ],
  },
  {
    name: 'access-list',
    aliases: ['acl'],
    description: 'Add an IP access list entry (standard 1-99, extended 100-199)',
    modes: ['config'],
  },
  {
    name: 'banner',
    aliases: [],
    description: 'Define a login banner (motd)',
    modes: ['config'],
    children: [
      { name: 'motd', description: 'Set message of the day banner', modes: ['config'] },
    ],
  },
  {
    name: 'username',
    aliases: ['user'],
    description: 'Establish user authentication credentials and privilege',
    modes: ['config'],
  },
  {
    name: 'enable',
    aliases: [],
    description: 'Modify enable password parameters',
    modes: ['config'],
    children: [
      { name: 'secret', description: 'Assign encrypted enable secret password', modes: ['config'] },
      { name: 'password', description: 'Assign enable password (plaintext in config)', modes: ['config'] },
    ],
  },
  {
    name: 'service',
    aliases: ['serv'],
    description: 'Modify network based services',
    modes: ['config'],
    children: [
      { name: 'password-encryption', description: 'Encrypt system passwords with type 7 cipher', modes: ['config'] },
    ],
  },
  {
    name: 'spanning-tree',
    aliases: ['span', 'stp'],
    description: 'Spanning Tree Subsystem (PVST+, Rapid-PVST, PortFast, Priority)',
    modes: ['config'],
    children: [
      { name: 'vlan', description: 'VLAN spanning tree parameters (priority, root primary/secondary)', modes: ['config'] },
      { name: 'mode', description: 'Configure STP mode (pvst, rapid-pvst, mst)', modes: ['config'] },
      { name: 'portfast', description: 'Spanning tree portfast global defaults', modes: ['config'] },
    ],
  },
  {
    name: 'crypto',
    aliases: [],
    description: 'Encryption subsystem',
    modes: ['config'],
    children: [
      { name: 'key', description: 'Generate or zeroize cryptographic RSA keypairs', modes: ['config'] },
    ],
  },
  {
    name: 'cdp',
    aliases: [],
    description: 'Global Cisco Discovery Protocol',
    modes: ['config'],
    children: [
      { name: 'run', description: 'Enable CDP globally', modes: ['config'] },
    ],
  },
  {
    name: 'lldp',
    aliases: [],
    description: 'Global Link Layer Discovery Protocol',
    modes: ['config'],
    children: [
      { name: 'run', description: 'Enable LLDP globally', modes: ['config'] },
    ],
  },
  {
    name: 'ntp',
    aliases: [],
    description: 'Configure Network Time Protocol',
    modes: ['config'],
    children: [
      { name: 'server', description: 'Specify NTP synchronization time server IP', modes: ['config'] },
    ],
  },
  {
    name: 'track',
    aliases: [],
    description: 'Object tracking for IP SLA or interface state',
    modes: ['config'],
  },
  {
    name: 'class-map',
    aliases: ['class'],
    description: 'Configure QoS class map match statements',
    modes: ['config'],
  },
  {
    name: 'policy-map',
    aliases: ['policy'],
    description: 'Configure QoS policy map service classes',
    modes: ['config'],
  },
  {
    name: 'monitor',
    aliases: ['mon'],
    description: 'Configure SPAN port mirroring sessions',
    modes: ['config'],
    children: [
      { name: 'session', description: 'Configure SPAN session source or destination port', modes: ['config'] },
    ],
  },
  {
    name: 'switch',
    aliases: ['sw'],
    description: 'Cisco SwitchWise Stack management (priority, renumber, provision)',
    modes: ['config'],
  },
  {
    name: 'feature',
    aliases: [],
    description: 'NX-OS feature enablement (ospf, vpc, lldp, lacp, bgp)',
    modes: ['config'],
  },
  {
    name: 'wlan',
    aliases: [],
    description: 'Wireless LAN Controller WLAN configurations',
    modes: ['config'],
  },
  {
    name: 'no',
    aliases: [],
    description: 'Negate a command or set its defaults (e.g. no ip routing, no shutdown)',
    modes: ['config', 'config-if', 'config-subif', 'config-router', 'config-line'],
  },
  {
    name: 'do',
    aliases: [],
    description: 'To run privileged exec commands from configuration mode (e.g. do show run)',
    modes: ['config', 'config-if', 'config-subif', 'config-router', 'config-dhcp', 'config-vlan', 'config-line'],
  },

  // ==========================================
  // INTERFACE SUB-MODE COMMANDS (config-if & config-subif)
  // ==========================================
  {
    name: 'ip',
    aliases: [],
    description: 'Interface IP address and protocol settings',
    modes: ['config-if', 'config-subif'],
    children: [
      { name: 'address', aliases: ['add', 'addr'], description: 'Set interface IP address and subnet mask', modes: ['config-if', 'config-subif'] },
      { name: 'helper-address', aliases: ['helper'], description: 'Specify DHCP relay destination IP address', modes: ['config-if', 'config-subif'] },
      { name: 'ospf', description: 'OSPF interface cost, priority, hello/dead timers', modes: ['config-if', 'config-subif'] },
      { name: 'access-group', aliases: ['access'], description: 'Apply ACL in or out to interface', modes: ['config-if', 'config-subif'] },
      { name: 'nat', description: 'Set interface as NAT inside or outside boundary', modes: ['config-if', 'config-subif'] },
      { name: 'dhcp', description: 'Configure DHCP snooping trust on interface', modes: ['config-if', 'config-subif'] },
    ],
  },
  {
    name: 'ipv6',
    aliases: [],
    description: 'Interface IPv6 address configuration',
    modes: ['config-if', 'config-subif'],
    children: [
      { name: 'address', description: 'Set IPv6 address (global unicast, link-local, or autoconfig)', modes: ['config-if', 'config-subif'] },
    ],
  },
  {
    name: 'shutdown',
    aliases: ['shut', 'sh'],
    description: 'Shutdown the selected interface (administrative down)',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'switchport',
    aliases: ['sw'],
    description: 'Set switching characteristics (access, trunk, VLAN, security)',
    modes: ['config-if'],
    children: [
      { name: 'mode', description: 'Set switchport mode (access or trunk)', modes: ['config-if'] },
      { name: 'access', description: 'Set access VLAN ID', modes: ['config-if'] },
      { name: 'trunk', description: 'Set trunk allowed VLANs or native VLAN', modes: ['config-if'] },
      { name: 'port-security', aliases: ['port-sec'], description: 'Configure port security (max, mac sticky, violation)', modes: ['config-if'] },
      { name: 'voice', description: 'Configure Voice VLAN for IP phones', modes: ['config-if'] },
      { name: 'nonegotiate', description: 'Disable Dynamic Trunking Protocol (DTP)', modes: ['config-if'] },
    ],
  },
  {
    name: 'encapsulation',
    aliases: ['encap'],
    description: 'Set encapsulation type for 802.1Q subinterface (Router-on-a-Stick)',
    modes: ['config-subif'],
    children: [
      { name: 'dot1Q', aliases: ['dot1q'], description: 'IEEE 802.1Q encapsulation with VLAN tag', modes: ['config-subif'] },
    ],
  },
  {
    name: 'standby',
    aliases: ['hsrp'],
    description: 'HSRP interface redundancy commands (IP, priority, preempt)',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'vrrp',
    aliases: [],
    description: 'VRRP interface redundancy commands (IP, priority, preempt)',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'glbp',
    aliases: [],
    description: 'GLBP gateway load balancing configuration',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'channel-group',
    aliases: ['chan'],
    description: 'Add this interface to an EtherChannel bundle (mode active/passive/on)',
    modes: ['config-if'],
  },
  {
    name: 'description',
    aliases: ['desc'],
    description: 'Interface specific descriptive label',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'speed',
    aliases: ['sp'],
    description: 'Configure interface port speed (10, 100, 1000, auto)',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'duplex',
    aliases: ['dup'],
    description: 'Configure duplex operation (full, half, auto)',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'spanning-tree',
    aliases: ['span', 'stp'],
    description: 'Interface Spanning Tree commands (portfast, bpduguard)',
    modes: ['config-if'],
    children: [
      { name: 'portfast', description: 'Enable Spanning Tree PortFast immediate forwarding', modes: ['config-if'] },
      { name: 'bpduguard', description: 'Enable Spanning Tree BPDU Guard on port', modes: ['config-if'] },
    ],
  },
  {
    name: 'tunnel',
    aliases: ['tu'],
    description: 'Configure GRE VPN tunnel parameters (source, destination, mode)',
    modes: ['config-if'],
    children: [
      { name: 'source', description: 'Specify tunnel source IP or interface', modes: ['config-if'] },
      { name: 'destination', description: 'Specify tunnel destination remote IP', modes: ['config-if'] },
      { name: 'mode', description: 'Specify tunnel mode (gre ip)', modes: ['config-if'] },
    ],
  },
  {
    name: 'service-policy',
    aliases: [],
    description: 'Attach QoS policy map (input / output) to interface',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'cdp',
    aliases: [],
    description: 'Enable or disable CDP per-interface',
    modes: ['config-if'],
    children: [
      { name: 'enable', description: 'Enable CDP on this interface', modes: ['config-if'] },
    ],
  },
  {
    name: 'nameif',
    aliases: [],
    description: 'ASA Firewall: Assign interface security zone name (inside, outside, dmz)',
    modes: ['config-if'],
  },
  {
    name: 'security-level',
    aliases: ['sec-level'],
    description: 'ASA Firewall: Assign interface security level (0-100)',
    modes: ['config-if'],
  },

  // ==========================================
  // ROUTER SUB-MODE COMMANDS (config-router)
  // ==========================================
  {
    name: 'network',
    aliases: ['net'],
    description: 'Enable routing on an IP network statement',
    modes: ['config-router', 'config-router-bgp', 'config-router-eigrp', 'config-router-rip'],
  },
  {
    name: 'router-id',
    aliases: ['rid'],
    description: 'Assign router identifier in 32-bit dotted-decimal IP format',
    modes: ['config-router', 'config-router-bgp', 'config-router-eigrp'],
  },
  {
    name: 'passive-interface',
    aliases: ['passive'],
    description: 'Suppress routing hello/update packets on an interface',
    modes: ['config-router'],
  },
  {
    name: 'default-information',
    aliases: ['def-info'],
    description: 'Control distribution of default information',
    modes: ['config-router'],
    children: [
      { name: 'originate', description: 'Advertise default gateway route into OSPF domain', modes: ['config-router'] },
    ],
  },
  {
    name: 'neighbor',
    aliases: ['nei'],
    description: 'BGP peering neighbor address and remote AS assignment',
    modes: ['config-router-bgp'],
  },
  {
    name: 'auto-summary',
    aliases: [],
    description: 'Automatic network number summarization',
    modes: ['config-router-eigrp', 'config-router-rip'],
  },
  {
    name: 'version',
    aliases: ['ver'],
    description: 'RIP routing protocol version (1 or 2)',
    modes: ['config-router-rip'],
  },

  // ==========================================
  // DHCP POOL CONFIG MODE (config-dhcp)
  // ==========================================
  {
    name: 'network',
    aliases: ['net'],
    description: 'Subnet network number and mask for DHCP pool',
    modes: ['config-dhcp'],
  },
  {
    name: 'default-router',
    aliases: ['default', 'gw'],
    description: 'Default gateway router IP address for DHCP clients',
    modes: ['config-dhcp'],
  },
  {
    name: 'dns-server',
    aliases: ['dns'],
    description: 'DNS domain name server IP address for DHCP clients',
    modes: ['config-dhcp'],
  },
  {
    name: 'domain-name',
    aliases: ['domain'],
    description: 'Domain name suffix handed out to DHCP clients',
    modes: ['config-dhcp'],
  },

  // ==========================================
  // VLAN CONFIG MODE (config-vlan)
  // ==========================================
  {
    name: 'name',
    aliases: [],
    description: 'Ascii descriptive name of the VLAN (e.g. Sales, Voice, Engineering)',
    modes: ['config-vlan'],
  },

  // ==========================================
  // LINE CONFIG MODE (config-line)
  // ==========================================
  {
    name: 'password',
    aliases: ['pwd'],
    description: 'Set line access authentication password',
    modes: ['config-line'],
  },
  {
    name: 'login',
    aliases: [],
    description: 'Enable password checking on login (or login local)',
    modes: ['config-line'],
    children: [
      { name: 'local', description: 'Authenticate using local username/password database', modes: ['config-line'] },
    ],
  },
  {
    name: 'transport',
    aliases: [],
    description: 'Define allowed transport protocols for incoming sessions',
    modes: ['config-line'],
    children: [
      { name: 'input', description: 'Define incoming protocols: ssh, telnet, none, all', modes: ['config-line'] },
    ],
  },
  {
    name: 'exec-timeout',
    aliases: ['timeout'],
    description: 'Set inactive EXEC timeout in minutes and seconds',
    modes: ['config-line'],
  },
  {
    name: 'logging',
    aliases: ['log'],
    description: 'Line logging configuration',
    modes: ['config-line'],
    children: [
      { name: 'synchronous', description: 'Synchronize unsolicited log messages with prompt', modes: ['config-line'] },
    ],
  },

  // ==========================================
  // NAVIGATION & MISC COMMANDS
  // ==========================================
  {
    name: 'exit',
    aliases: ['ex'],
    description: 'Exit current configuration mode or close session',
    modes: ['user', 'priv', 'config', 'config-if', 'config-subif', 'config-router', 'config-router-bgp', 'config-router-eigrp', 'config-router-rip', 'config-dhcp', 'config-vlan', 'config-line'],
  },
  {
    name: 'end',
    aliases: [],
    description: 'Exit immediately from configuration mode back to Privileged EXEC mode',
    modes: ['config', 'config-if', 'config-subif', 'config-router', 'config-router-bgp', 'config-router-eigrp', 'config-router-rip', 'config-dhcp', 'config-vlan', 'config-line'],
  },
];
