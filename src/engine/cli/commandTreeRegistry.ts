import { CommandNode } from './types';

export const COMMAND_TREE_REGISTRY: CommandNode[] = [
  // Exec Commands (User & Privileged)
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
    ],
  },
  {
    name: 'ping',
    aliases: [],
    description: 'Send echo messages',
    modes: ['user', 'priv'],
  },
  {
    name: 'traceroute',
    aliases: ['trace'],
    description: 'Trace route to destination',
    modes: ['user', 'priv'],
  },
  {
    name: 'show',
    aliases: ['sh'],
    description: 'Show running system information',
    modes: ['user', 'priv'],
    children: [
      { name: 'ip', description: 'IP information (route, interface, ospf, nat)', modes: ['user', 'priv'] },
      { name: 'interfaces', aliases: ['int'], description: 'Interface status and configuration', modes: ['user', 'priv'] },
      { name: 'running-config', aliases: ['run'], description: 'Current operating configuration', modes: ['priv'] },
      { name: 'startup-config', aliases: ['start'], description: 'Contents of startup configuration', modes: ['priv'] },
      { name: 'spanning-tree', aliases: ['span', 'stp'], description: 'Spanning Tree topology', modes: ['user', 'priv'] },
      { name: 'vlan', description: 'VLAN status and brief list', modes: ['user', 'priv'] },
      { name: 'mac', description: 'MAC address table', modes: ['user', 'priv'] },
      { name: 'cdp', description: 'CDP information', modes: ['user', 'priv'] },
      { name: 'lldp', description: 'LLDP information', modes: ['user', 'priv'] },
      { name: 'version', aliases: ['ver'], description: 'System hardware & software status', modes: ['user', 'priv'] },
      { name: 'access-lists', aliases: ['access-list', 'acl'], description: 'List access lists', modes: ['priv'] },
      { name: 'tech-support', aliases: ['tech'], description: 'Detailed diagnostic output', modes: ['priv'] },
      { name: 'arp', description: 'ARP table', modes: ['user', 'priv'] },
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
    ],
  },
  {
    name: 'copy',
    aliases: ['cp'],
    description: 'Copy configuration or image files',
    modes: ['priv'],
    children: [
      { name: 'running-config', aliases: ['run'], description: 'Copy running configuration', modes: ['priv'] },
    ],
  },
  {
    name: 'reload',
    aliases: [],
    description: 'Halt and perform a cold restart',
    modes: ['priv'],
  },
  {
    name: 'debug',
    aliases: ['deb'],
    description: 'Debugging functions',
    modes: ['priv'],
  },
  {
    name: 'undebug',
    aliases: ['u'],
    description: 'Disable debugging functions',
    modes: ['priv'],
  },
  {
    name: 'clear',
    aliases: [],
    description: 'Reset counters, arp, mac, or routing tables',
    modes: ['priv'],
  },

  // Global Config Commands
  {
    name: 'hostname',
    aliases: ['host'],
    description: 'Set system network name',
    modes: ['config'],
  },
  {
    name: 'interface',
    aliases: ['int'],
    description: 'Select an interface to configure',
    modes: ['config'],
  },
  {
    name: 'ip',
    aliases: [],
    description: 'Global IP configuration subcommands',
    modes: ['config'],
    children: [
      { name: 'route', description: 'Establish static routes', modes: ['config'] },
      { name: 'routing', description: 'Enable IP routing', modes: ['config'] },
      { name: 'dhcp', description: 'Configure DHCP server parameters', modes: ['config'] },
      { name: 'domain-name', description: 'Define the default domain name', modes: ['config'] },
      { name: 'domain-lookup', description: 'Enable DNS resolution', modes: ['config'] },
      { name: 'name-server', description: 'Specify DNS servers', modes: ['config'] },
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
    description: 'Vlan configuration commands',
    modes: ['config'],
  },
  {
    name: 'line',
    aliases: [],
    description: 'Configure a terminal line (console, vty)',
    modes: ['config'],
  },
  {
    name: 'access-list',
    aliases: ['acl'],
    description: 'Add an access list entry',
    modes: ['config'],
  },
  {
    name: 'banner',
    aliases: [],
    description: 'Define a login banner (motd)',
    modes: ['config'],
  },
  {
    name: 'username',
    aliases: ['user'],
    description: 'Establish user authentication credentials',
    modes: ['config'],
  },
  {
    name: 'enable',
    aliases: [],
    description: 'Modify enable password parameters',
    modes: ['config'],
    children: [
      { name: 'secret', description: 'Assign encrypted enable secret password', modes: ['config'] },
      { name: 'password', description: 'Assign enable password', modes: ['config'] },
    ],
  },
  {
    name: 'spanning-tree',
    aliases: ['span', 'stp'],
    description: 'Spanning Tree Subsystem',
    modes: ['config'],
  },

  // Interface Sub-Mode Commands
  {
    name: 'ip',
    aliases: [],
    description: 'Interface IP address configuration',
    modes: ['config-if', 'config-subif'],
    children: [
      { name: 'address', aliases: ['add'], description: 'Set interface IP address and subnet mask', modes: ['config-if', 'config-subif'] },
      { name: 'helper-address', description: 'Specify DHCP relay destination', modes: ['config-if', 'config-subif'] },
      { name: 'ospf', description: 'OSPF interface cost and timers', modes: ['config-if', 'config-subif'] },
      { name: 'access-group', description: 'Apply ACL to interface', modes: ['config-if', 'config-subif'] },
    ],
  },
  {
    name: 'shutdown',
    aliases: ['shut'],
    description: 'Shutdown the selected interface',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'switchport',
    aliases: ['sw'],
    description: 'Set switching mode characteristics',
    modes: ['config-if'],
    children: [
      { name: 'mode', description: 'Set access or trunk mode', modes: ['config-if'] },
      { name: 'access', description: 'Set access VLAN', modes: ['config-if'] },
      { name: 'trunk', description: 'Set trunk allowed VLANs or native VLAN', modes: ['config-if'] },
      { name: 'port-security', description: 'Port security configuration', modes: ['config-if'] },
      { name: 'voice', description: 'Configure Voice VLAN', modes: ['config-if'] },
    ],
  },
  {
    name: 'encapsulation',
    aliases: ['encap'],
    description: 'Set encapsulation type for 802.1Q subinterface',
    modes: ['config-subif'],
  },
  {
    name: 'standby',
    aliases: [],
    description: 'HSRP interface configuration commands',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'description',
    aliases: ['desc'],
    description: 'Interface specific description',
    modes: ['config-if', 'config-subif'],
  },
  {
    name: 'channel-group',
    aliases: [],
    description: 'Add this interface to an EtherChannel bundle',
    modes: ['config-if'],
  },

  // Router Sub-Mode Commands
  {
    name: 'network',
    aliases: ['net'],
    description: 'Enable routing on an IP network statement',
    modes: ['config-router', 'config-router-ospf' as any, 'config-router-rip' as any, 'config-router-eigrp' as any],
  },
  {
    name: 'router-id',
    aliases: [],
    description: 'OSPF router-id in IP address format',
    modes: ['config-router'],
  },
  {
    name: 'passive-interface',
    aliases: ['passive'],
    description: 'Suppress routing updates on an interface',
    modes: ['config-router'],
  },
  {
    name: 'default-information',
    aliases: [],
    description: 'Control distribution of default information',
    modes: ['config-router'],
  },
];
