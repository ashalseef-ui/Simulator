import { Device, DeviceConfig, Link, NetworkOsType } from '../../types/network';
import { isValidIp, maskToCidr, cidrToMask, getNetworkAddress } from '../../utils/ipUtils';
import { CliSession } from '../cliEngine';
import { deepClone } from '../../utils/deepClone';

export interface VendorOsMetadata {
  id: NetworkOsType;
  name: string;
  vendor: string;
  version: string;
  badge: string;
  badgeColor: string;
  promptExample: string;
  description: string;
  banner: string;
}

export const VENDOR_OS_PROFILES: Record<NetworkOsType, VendorOsMetadata> = {
  'cisco-ios': {
    id: 'cisco-ios',
    name: 'Cisco IOS / IOS-XE',
    vendor: 'Cisco Systems',
    version: '15.9(3)M6 / IOS-XE 17.6',
    badge: 'Cisco IOS',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    promptExample: 'Router#',
    description: 'De facto industry standard imperative CLI with User, Privileged Exec, and Global Configuration modes.',
    banner: `Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.9(3)M6, RELEASE SOFTWARE (fc1)
Technical Support: http://www.cisco.com/techsupport
Copyright (c) 1986-2024 by Cisco Systems, Inc.`,
  },
  'juniper-junos': {
    id: 'juniper-junos',
    name: 'Juniper Junos OS',
    vendor: 'Juniper Networks',
    version: 'Junos OS 22.4R1.10',
    badge: 'Juniper Junos',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    promptExample: 'root@host> | [edit] root@host#',
    description: 'Hierarchical, transactional candidate-configuration architecture with commit, commit check, and rollback.',
    banner: `--- JUNOS 22.4R1.10 built by builder on 2024-01-15 04:32:11 UTC ---
Juniper Networks Junos OS Operational Gateway Platform
Type 'configure' to enter configuration mode, or '?' for context help.`,
  },
  'arista-eos': {
    id: 'arista-eos',
    name: 'Arista EOS',
    vendor: 'Arista Networks',
    version: 'EOS 4.28.1F-27221375',
    badge: 'Arista EOS',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    promptExample: 'Switch# | Switch(config)#',
    description: 'Extensible Operating System with standard Linux kernel underneath, direct bash shell access, and cloud spine-leaf fabric.',
    banner: `Arista Networks EOS (vEOS-lab-4.28.1F)
Linux 5.10.104.arista.1 (x86_64)
System MAC: 00:1c:73:00:00:01, Memory: 4194304 kB
Type 'bash' for direct access to the underlying Linux shell.`,
  },
  'linux-vyos': {
    id: 'linux-vyos',
    name: 'Linux / VyOS Network OS',
    vendor: 'Debian / VyOS Project',
    vendorVersion: 'Debian 12 / VyOS 1.4-rolling',
    version: 'Linux 6.1.0-net / VyOS 1.4',
    badge: 'Linux / VyOS',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    promptExample: 'root@gateway:~# | ip addr',
    description: 'Standard Linux iproute2 suite (ip addr, ip route, ping, iptables) alongside declarative VyOS router commands.',
    banner: `Linux gateway 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 x86_64
Debian GNU/Linux 12 (bookworm) - IP Forwarding & FRRouting Gateway
Use 'ip addr', 'ip route', 'ping -c 4', or 'cat /etc/network/interfaces'.`,
  } as any,
  'mikrotik-routeros': {
    id: 'mikrotik-routeros',
    name: 'MikroTik RouterOS v7',
    vendor: 'MikroTik Ltd.',
    version: 'RouterOS v7.14.3 (stable)',
    badge: 'MikroTik RouterOS',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    promptExample: '[admin@MikroTik] >',
    description: 'Hierarchical menu-based command structure with scriptable parameter flags (/ip address print, /ip route add).',
    banner: `  MMM      MMM       KKK                          TTTTTTTTTTT      KKK
  MMMM    MMMM       KKK   TTTTTTTTTTT             TTT            KKK
  MMM MMMM MMM  III  KKK  KKK  RRRRR   OOOOOO      TTT   III  KKK  KKK
  MMM  MM  MMM  III  KKKKK     RRR  RR OOO  OOO    TTT   III  KKKKK
  MMM      MMM  III  KKK  KKK  RRRRR   OOO  OOO    TTT   III  KKK  KKK
  MMM      MMM  III  KKK   KKK RRR  RR  OOOOOO     TTT   III  KKK   KKK

  MikroTik RouterOS 7.14.3 (c) 1999-2024       https://www.mikrotik.com/
  Type '?' for command menu list, or '/export' for configuration.`,
  },
};

// -------------------------------------------------------------------------
// MULTI-VENDOR CLI ROSETTA STONE MATRIX
// -------------------------------------------------------------------------
export interface RosettaStoneEntry {
  category: 'Interfaces & IP' | 'Routing & Gateways' | 'VLANs & Switching' | 'Routing Protocols (OSPF)' | 'ARP & Tables' | 'Save & Commit' | 'Diagnostics & Troubleshooting' | 'System & Identity';
  task: string;
  cisco: string;
  juniper: string;
  arista: string;
  linux: string;
  mikrotik: string;
  note: string;
}

export const MULTI_VENDOR_ROSETTA_STONE: RosettaStoneEntry[] = [
  {
    category: 'Interfaces & IP',
    task: 'Display interface brief status & IP addresses',
    cisco: 'show ip interface brief',
    juniper: 'show interfaces terse',
    arista: 'show ip interface brief',
    linux: 'ip -br addr show  (or: ip addr)',
    mikrotik: '/ip address print',
    note: 'The fundamental first command run by network engineers to verify link and L3 addressing.',
  },
  {
    category: 'Interfaces & IP',
    task: 'Assign IPv4 address to an interface',
    cisco: 'int Gi0/0\n ip address 192.168.1.1 255.255.255.0\n no shutdown',
    juniper: 'set interfaces ge-0/0/0 unit 0 family inet address 192.168.1.1/24',
    arista: 'int Ethernet1\n no switchport\n ip address 192.168.1.1/24',
    linux: 'ip addr add 192.168.1.1/24 dev eth0\nip link set eth0 up',
    mikrotik: '/ip address add address=192.168.1.1/24 interface=ether1',
    note: 'Cisco uses dotted-decimal masks; Juniper, Arista, Linux, and MikroTik natively use CIDR /24 prefix lengths.',
  },
  {
    category: 'Interfaces & IP',
    task: 'Display detailed physical interface counters & errors',
    cisco: 'show interfaces GigabitEthernet0/0',
    juniper: 'show interfaces ge-0/0/0 extensive',
    arista: 'show interfaces Ethernet1',
    linux: 'ip -s link show dev eth0\nethtool eth0',
    mikrotik: '/interface ethernet print stats',
    note: 'Shows RX/TX packets, cyclic redundancy check (CRC) errors, MTU, and duplex status.',
  },
  {
    category: 'Interfaces & IP',
    task: 'Enable / Administrative Up on an interface',
    cisco: 'no shutdown',
    juniper: 'delete interfaces ge-0/0/0 disable',
    arista: 'no shutdown',
    linux: 'ip link set dev eth0 up',
    mikrotik: '/interface enable ether1',
    note: 'Cisco default ports on routers are shutdown; Juniper ports are enabled unless explicitly set disabled.',
  },
  {
    category: 'Routing & Gateways',
    task: 'Display IP routing table',
    cisco: 'show ip route',
    juniper: 'show route',
    arista: 'show ip route',
    linux: 'ip route show  (or: route -n)',
    mikrotik: '/ip route print',
    note: 'Shows connected, static, OSPF, and BGP prefixes with next-hop gateways and metrics.',
  },
  {
    category: 'Routing & Gateways',
    task: 'Configure IPv4 static route / default gateway',
    cisco: 'ip route 0.0.0.0 0.0.0.0 192.168.1.254',
    juniper: 'set routing-options static route 0.0.0.0/0 next-hop 192.168.1.254',
    arista: 'ip route 0.0.0.0/0 192.168.1.254',
    linux: 'ip route add default via 192.168.1.254',
    mikrotik: '/ip route add dst-address=0.0.0.0/0 gateway=192.168.1.254',
    note: 'Configures default gateway for traffic destined beyond the local broadcast domain.',
  },
  {
    category: 'Routing & Gateways',
    task: 'Enable IP routing / forwarding engine',
    cisco: 'ip routing',
    juniper: 'Enabled by default in Junos kernel',
    arista: 'ip routing',
    linux: 'sysctl -w net.ipv4.ip_forward=1',
    mikrotik: 'Enabled by default in RouterOS',
    note: 'L3 switches (Catalyst/Arista) and Linux require explicit routing/forwarding enablement.',
  },
  {
    category: 'VLANs & Switching',
    task: 'Display VLAN database & port memberships',
    cisco: 'show vlan brief',
    juniper: 'show vlans',
    arista: 'show vlan',
    linux: 'bridge vlan show',
    mikrotik: '/interface bridge vlan print',
    note: 'Shows VLAN IDs, assigned human-readable names, and tagged/untagged port members.',
  },
  {
    category: 'VLANs & Switching',
    task: 'Configure 802.1Q trunk port',
    cisco: 'int Gi0/1\n switchport mode trunk\n switchport trunk allowed vlan 10,20',
    juniper: 'set interfaces ge-0/0/0 unit 0 family ethernet-switching interface-mode trunk vlan members [ 10 20 ]',
    arista: 'int Ethernet1\n switchport mode trunk\n switchport trunk allowed vlan 10,20',
    linux: 'bridge vlan add dev eth0 vid 10 tagged\nbridge vlan add dev eth0 vid 20 tagged',
    mikrotik: '/interface bridge vlan add bridge=bridge1 tagged=ether1 vlan-ids=10,20',
    note: 'Encapsulates Ethernet frames with 802.1Q 4-byte tags for multi-VLAN traversal.',
  },
  {
    category: 'Routing Protocols (OSPF)',
    task: 'Display OSPF neighbors & adjacency states',
    cisco: 'show ip ospf neighbor',
    juniper: 'show ospf neighbor',
    arista: 'show ip ospf neighbor',
    linux: 'vtysh -c "show ip ospf neighbor"',
    mikrotik: '/routing ospf neighbor print',
    note: 'Verifies 2-Way, ExStart, Exchange, and Full state adjacencies with neighbor Router-IDs.',
  },
  {
    category: 'Routing Protocols (OSPF)',
    task: 'Enable OSPF process and activate area on interface',
    cisco: 'router ospf 1\n network 10.0.0.0 0.0.0.255 area 0',
    juniper: 'set protocols ospf area 0.0.0.0 interface ge-0/0/0.0',
    arista: 'router ospf 1\n int Ethernet1\n  ip ospf 1 area 0',
    linux: 'router ospf\n network 10.0.0.0/24 area 0.0.0.0',
    mikrotik: '/routing ospf interface-template add area=backbone interfaces=ether1',
    note: 'Juniper and modern Cisco configure OSPF directly on the interface rather than via wildcard mask network statements.',
  },
  {
    category: 'ARP & Tables',
    task: 'Display ARP resolution cache (IP to MAC mapping)',
    cisco: 'show ip arp',
    juniper: 'show arp',
    arista: 'show ip arp',
    linux: 'ip neigh show  (or: arp -n)',
    mikrotik: '/ip arp print',
    note: 'Displays learned Address Resolution Protocol bindings for local broadcast subnets.',
  },
  {
    category: 'ARP & Tables',
    task: 'Display MAC address forwarding table (L2 CAM)',
    cisco: 'show mac address-table',
    juniper: 'show ethernet-switching table',
    arista: 'show mac address-table',
    linux: 'bridge fdb show',
    mikrotik: '/interface bridge host print',
    note: 'Lists learned source MAC addresses mapped to hardware physical switch ports and VLANs.',
  },
  {
    category: 'Save & Commit',
    task: 'Save active configuration to persistent memory',
    cisco: 'copy running-config startup-config  (or: write memory)',
    juniper: 'commit  (in [edit] mode)',
    arista: 'copy running-config startup-config  (or: write memory)',
    linux: 'netplan apply  (or: /etc/init.d/networking restart)',
    mikrotik: 'Auto-saves immediately to storage',
    note: 'Juniper uses transactional candidate commits. Changes are not live until you type commit.',
  },
  {
    category: 'Save & Commit',
    task: 'Check candidate configuration syntax before applying',
    cisco: 'N/A (Cisco applies commands immediately)',
    juniper: 'commit check',
    arista: 'N/A (EOS session-config commit check)',
    linux: 'netplan try',
    mikrotik: 'N/A',
    note: 'Exclusive feature of Junos and modern transactional NOS to prevent downtime from typos.',
  },
  {
    category: 'Save & Commit',
    task: 'Rollback uncommitted or previous configuration',
    cisco: 'archive config rollback  (in IOS-XE)',
    juniper: 'rollback 0  (or: rollback 1)',
    arista: 'configure replace flash:startup-config',
    linux: 'git checkout /etc/network/interfaces',
    mikrotik: '/system backup load',
    note: 'Juniper keeps up to 50 historical rollback snapshots accessible by index.',
  },
  {
    category: 'Diagnostics & Troubleshooting',
    task: 'Send ICMP echo requests (Ping)',
    cisco: 'ping 192.168.1.1',
    juniper: 'ping 192.168.1.1 count 4',
    arista: 'ping 192.168.1.1',
    linux: 'ping -c 4 192.168.1.1',
    mikrotik: '/ping 192.168.1.1 count=4',
    note: 'Verifies layer 3 end-to-end IP reachability and measures round-trip latency.',
  },
  {
    category: 'Diagnostics & Troubleshooting',
    task: 'Trace route hops to remote destination',
    cisco: 'traceroute 8.8.8.8',
    juniper: 'traceroute 8.8.8.8',
    arista: 'traceroute 8.8.8.8',
    linux: 'traceroute -n 8.8.8.8  (or: mtr 8.8.8.8)',
    mikrotik: '/tool traceroute 8.8.8.8',
    note: 'Uses incrementing TTL headers to identify each transit router along the packet path.',
  },
  {
    category: 'System & Identity',
    task: 'Configure system hostname',
    cisco: 'hostname R1-HQ',
    juniper: 'set system host-name R1-HQ',
    arista: 'hostname R1-HQ',
    linux: 'hostnamectl set-hostname R1-HQ',
    mikrotik: '/system identity set name=R1-HQ',
    note: 'Sets the administrative identifier displayed in CLI prompt and telemetry logs.',
  },
];

// -------------------------------------------------------------------------
// PROMPT FORMATTERS PER OS
// -------------------------------------------------------------------------
export function getMultiVendorPrompt(device: Device, session: CliSession): string {
  const os: NetworkOsType = device.config.networkOs || 'cisco-ios';
  const host = device.config.hostname || device.name;

  switch (os) {
    case 'juniper-junos': {
      if (session.mode === 'config' || session.mode === 'config-if') {
        const path = session.currentInterface ? ` interfaces ${session.currentInterface}` : '';
        return `[edit${path}]\nroot@${host}#`;
      }
      return `root@${host}>`;
    }

    case 'arista-eos': {
      if ((session as any).bashActive) {
        return `[admin@${host} ~]$`;
      }
      if (session.mode === 'user') return `${host}>`;
      if (session.mode === 'priv') return `${host}#`;
      if (session.mode === 'config') return `${host}(config)#`;
      if (session.mode === 'config-if') {
        const ifName = session.currentInterface || 'Et1';
        return `${host}(config-if-${ifName})#`;
      }
      return `${host}#`;
    }

    case 'linux-vyos': {
      if ((session as any).vyosConfigMode) {
        return `vyos@${host}#`;
      }
      return `root@${host}:~#`;
    }

    case 'mikrotik-routeros': {
      const sub = (session as any).mikrotikMenu || '';
      return sub ? `[admin@${host}] ${sub}>` : `[admin@${host}] >`;
    }

    case 'cisco-ios':
    default: {
      switch (session.mode) {
        case 'user':
          return `${host}>`;
        case 'priv':
          return `${host}#`;
        case 'config':
          return `${host}(config)#`;
        case 'config-if':
          return session.currentInterfaceRange && session.currentInterfaceRange.length > 1
            ? `${host}(config-if-range)#`
            : `${host}(config-if)#`;
        case 'config-subif':
          return `${host}(config-subif)#`;
        case 'config-router':
          return `${host}(config-router)#`;
        case 'config-dhcp':
          return `${host}(config-dhcp-config)#`;
        case 'config-vlan':
          return `${host}(config-vlan)#`;
        case 'config-line':
          return `${host}(config-line)#`;
        default:
          return `${host}>`;
      }
    }
  }
}

export { executeJunosCommand } from "./vendors/junos";
export { executeAristaCommand } from "./vendors/arista";
export { executeLinuxCommand } from "./vendors/linuxVyos";
export { executeMikrotikCommand } from "./vendors/mikrotik";
