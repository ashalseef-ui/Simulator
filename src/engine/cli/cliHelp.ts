import { Device } from '../../types/network';
import { CliMode } from './types';

export function getContextHelp(prefix: string, mode: CliMode, _device: Device): string {
  const pfx = prefix.trim().toLowerCase();

  // Subcommand help
  if (pfx === 'show' || pfx === 'sh') {
    return '  access-lists        List access lists\n  arp                 Arp table\n  cdp                 CDP information (neighbors, detail)\n  clock               Display the system clock\n  dhcp                Dynamic Host Configuration Protocol\n  etherchannel        EtherChannel information\n  flash:              Directory of flash:\n  history             Display the session command history\n  hosts               Display DNS domain and static host table\n  interfaces          Interface status and configuration\n  inventory           Show physical inventory\n  ip                  IP information (route, interface, ospf, bgp, eigrp, nat, dhcp, protocols, sla)\n  ipv6                IPv6 information (interface brief, route)\n  lldp                LLDP information\n  logging             Show logging buffer\n  mac-address-table   MAC address table\n  ntp                 NTP status\n  policy-map          QoS Policy Maps\n  port-security       Port Security status, interface, address\n  processes           Active process statistics (cpu)\n  redundancy          Stateful switchover status\n  running-config      Current operating configuration\n  spanning-tree       Spanning Tree topology & PVST+ details\n  standby             Hot Standby Router Protocol (HSRP)\n  startup-config      Contents of startup configuration (NVRAM)\n  switch              SwitchWise stack details and ring\n  tech-support        Detailed system diagnostic information\n  track               Object tracking status\n  version             System hardware & software status\n  vlan                VLAN information (brief, id, summary)\n  vrrp                VRRP redundancy status\n  vtp                 VTP domain and operational mode';
  }

  if (pfx === 'ip') {
    return '  address             Set the IP address of an interface\n  default-gateway     Specify default gateway (if not routing)\n  dhcp                Configure DHCP server parameters\n  domain-lookup       Enable IP Domain Name System hostname translation\n  domain-name         Define the default domain name\n  helper-address      Specify a destination address for UDP broadcasts\n  host                Define static hostname to IP mapping\n  nat                 Network Address Translation\n  ospf                OSPF interface subcommands\n  route               Establish static routes\n  routing             Enable IP routing\n  sla                 IP SLA synthetic probes\n  ssh                 Configure SSH version';
  }

  if (pfx === 'spanning-tree' || pfx === 'span' || pfx === 'stp') {
    return '  mode                Operating spanning-tree mode (pvst, rapid-pvst, mst)\n  portfast            Spanning Tree PortFast immediate forwarding\n  vlan                VLAN spanning-tree configuration (priority, root primary/secondary)';
  }

  if (pfx === 'debug') {
    return '  all                 Enable all debugging\n  ip icmp             ICMP packet debugging\n  ip ospf             OSPF events and adjacencies\n  ip packet           IP packet debugging\n  ip dhcp             DHCP server events\n  spanning-tree       STP BPDU and topology change debugging\n  arp                 ARP packet debugging';
  }

  if (pfx === 'switchport' || pfx === 'sw') {
    return '  access              Set access mode characteristics of the interface\n  mode                Set trunk or access mode of the interface\n  nonegotiate         Device will not engage in DTP negotiation\n  port-security       Security related command (maximum, mac-address, violation)\n  trunk               Set trunking characteristics of the interface (allowed, native)\n  voice               Configure Voice VLAN for VoIP phones';
  }

  if (pfx === 'router' || pfx === 'ro') {
    return '  bgp                 Border Gateway Protocol (BGP)\n  eigrp               Enhanced Interior Gateway Routing Protocol\n  ospf                Open Shortest Path First (OSPF)\n  rip                 Routing Information Protocol (RIP)';
  }

  if (pfx === 'copy' || pfx === 'cp') {
    return '  running-config      Copy running configuration (e.g. copy run start)\n  startup-config      Copy startup configuration\n  flash:              Copy from flash filesystem\n  tftp:               Copy from TFTP network host';
  }

  if (pfx === 'clear' || pfx === 'clr') {
    return '  arp-cache           Purge dynamic ARP entries\n  counters            Reset interface packet counters\n  ip ospf process     Reset OSPF neighbor adjacencies and SPF recalculation\n  ip route *          Flush routing cache\n  mac address-table   Purge dynamic CAM/MAC table entries\n  nat translations    Flush dynamic NAT translation slots';
  }

  if (pfx === 'vtp') {
    return '  domain              Set VTP administrative domain\n  mode                Set VTP operating mode (server, client, transparent, off)\n  password            Set VTP administrative password';
  }

  if (mode === 'user') {
    return '  enable       Turn on privileged commands\n  ping         Send echo messages (ICMP)\n  show         Show running system information\n  traceroute   Trace route to destination\n  exit         Exit from EXEC mode';
  }
  if (mode === 'priv') {
    return '  clear        Reset functions (arp, mac, ip route, ospf, counters)\n  clock        Manage the system clock (clock set)\n  configure    Enter configuration mode (terminal)\n  copy         Copy from one file to another (copy run start)\n  debug        Debugging functions (debug ip icmp, debug ip ospf)\n  disable      Turn off privileged commands\n  erase        Erase a filesystem (erase startup-config)\n  ping         Send echo messages\n  redundancy   Force SSO switchover\n  reload       Halt and perform a cold restart\n  show         Show running system information\n  ssh          Open a secure shell client connection\n  telnet       Open a telnet connection\n  terminal     Set terminal line parameters (terminal monitor)\n  traceroute   Trace route to destination\n  undebug      Disable debugging functions (undebug all)\n  write        Write running configuration to memory (wr mem)\n  exit         Exit from EXEC mode';
  }
  if (mode === 'config') {
    return '  access-list  Add an access list entry (standard / extended)\n  banner       Define a login banner (motd)\n  cdp          Global CDP configuration subcommands (cdp run)\n  class-map    Configure QoS classification match criteria\n  crypto       Encryption subsystem (crypto key generate rsa)\n  do           To run exec commands in config mode\n  enable       Modify enable password parameters (secret / password)\n  end          Exit from configure mode to Privileged EXEC\n  exit         Exit from configure mode\n  feature      NX-OS feature enablement (ospf, vpc, lldp, lacp)\n  hostname     Set system network name\n  interface    Select an interface to configure\n  ip           Global IP configuration subcommands (route, routing, dhcp, nat, sla)\n  ipv6         Global IPv6 configuration subcommands (unicast-routing, route)\n  line         Configure a terminal line (console, vty)\n  lldp         Global LLDP configuration subcommands (lldp run)\n  monitor      Configure SPAN port mirroring sessions\n  no           Negate a command or set its defaults\n  ntp          Configure NTP server time synchronization\n  policy-map   Configure QoS policy map service classes\n  router       Enable a routing process (ospf, bgp, eigrp, rip)\n  service      Modify use of network based services (password-encryption)\n  spanning-tree Spanning Tree Subsystem (vlan priority, mode, portfast)\n  switch       SwitchWise stack configuration (priority, provision)\n  track        Object tracking configuration for IP SLA\n  username     Establish User Name Authentication\n  vlan         Vlan configuration commands (1-4094)\n  vtp          Global VTP configuration commands\n  wlan         WLC Wireless LAN configuration';
  }
  if (mode === 'config-if' || mode === 'config-subif') {
    return '  cdp          CDP interface subcommands (cdp enable)\n  channel-group Add this interface to an EtherChannel bundle\n  description  Interface specific description label\n  duplex       Configure duplex operation (auto, full, half)\n  encapsulation Set encapsulation type for an interface (dot1Q)\n  glbp         GLBP gateway load balancing configuration\n  ip           Interface Internet Protocol config commands (address, helper-address, ospf, nat)\n  ipv6         Interface IPv6 config commands (address, autoconfig)\n  lldp         LLDP interface subcommands\n  nameif       ASA Firewall: Assign interface zone\n  no           Negate a command or set its defaults (no shutdown, no switchport)\n  security-level ASA Firewall: Assign security level (0-100)\n  service-policy Attach QoS policy map (input / output)\n  shutdown     Shutdown the selected interface\n  speed        Configure speed operation (10, 100, 1000, auto)\n  standby      HSRP interface configuration commands (ip, priority, preempt)\n  switchport   Set switching mode characteristics (access, trunk, vlan, port-security, voice)\n  tunnel       Configure GRE VPN tunnel parameters (source, destination, mode)\n  vrrp         VRRP interface redundancy commands\n  exit         Exit from interface configuration mode\n  end          Return directly to privileged exec mode\n  do           To run exec commands';
  }
  if (mode === 'config-router') {
    return '  auto-summary        Automatic network number summarization\n  default-information Control distribution of default information (originate)\n  neighbor            BGP neighbor IP and remote-as\n  network             Enable routing on an IP network\n  passive-interface   Suppress routing updates on an interface\n  router-id           OSPF/BGP router-id in IP address format\n  version             RIP protocol version (1 or 2)\n  exit                Exit from router configuration mode\n  end                 Return directly to privileged exec mode\n  do                  To run exec commands';
  }
  if (mode === 'config-dhcp') {
    return '  default-router      Default routers\n  dns-server          DNS servers\n  domain-name         Domain name\n  network             Network number and mask\n  exit                Exit from DHCP pool configuration mode\n  end                 Return directly to privileged exec mode\n  do                  To run exec commands';
  }
  if (mode === 'config-vlan') {
    return '  name                Ascii name of the VLAN\n  exit                Exit from VLAN configuration mode\n  end                 Return directly to privileged exec mode\n  do                  To run exec commands';
  }
  if (mode === 'config-line') {
    return '  exec-timeout        Set the EXEC timeout (minutes seconds)\n  logging             Modify message logging facilities (synchronous)\n  login               Enable password checking (or login local)\n  password            Set line access password\n  transport           Define transport protocols for line (input ssh, all)\n  exit                Exit from line configuration mode\n  end                 Return directly to privileged exec mode\n  do                  To run exec commands';
  }
  return '  exit         Exit current configuration mode\n  end          Return to privileged exec mode';
}
