import { Device, DeviceConfig, DeviceInterface, Link, NetworkOsType } from '../../types/network';
import { isValidIp, maskToCidr, cidrToMask, getNetworkAddress } from '../../utils/ipUtils';
import { CliSession } from '../cliEngine';
import { simulatePing } from '../simulationEngine';

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

// -------------------------------------------------------------------------
// JUNIPER JUNOS EXECUTOR
// -------------------------------------------------------------------------
export function executeJunosCommand(
  rawLine: string,
  device: Device,
  allDevices: Device[],
  session: CliSession,
  onConfigChange: (c: DeviceConfig) => void,
  allLinks?: Link[]
): { output: string; newSession: CliSession } {
  const line = rawLine.trim();
  const newSession: CliSession = {
    ...session,
    history: [...session.history, line],
    historyIndex: session.history.length + 1,
  };
  const host = device.config.hostname || device.name;
  const config = { ...device.config };

  // Candidate config storage in session
  const candidate: Partial<DeviceConfig> = (session as any).junosCandidate || {
    hostname: config.hostname,
    interfaces: { ...config.interfaces },
    routes: [...config.routes],
  };

  if (!line) return { output: '', newSession };

  // Junos help '?'
  if (line === '?' || line.endsWith('?')) {
    if (session.mode === 'config') {
      return {
        output: `Configuration commands:
  commit               Commit candidate changes and make active
  commit check         Check candidate configuration syntax only
  delete               Delete a data element
  edit                 Edit a sub-element
  exit                 Exit configuration mode
  quit                 Exit configuration mode
  rollback             Roll back to previous committed configuration
  set                  Set a parameter
  show                 Show candidate configuration or changes
  top                  Exit to top level of configuration
  up                   Exit one level of configuration`,
        newSession,
      };
    }
    return {
      output: `Operational commands:
  clear                Clear operational state or statistics
  configure            Enter configuration mode
  edit                 Enter configuration mode
  monitor              Real-time interface packet monitoring
  ping                 Ping remote target
  quit                 Exit the management session
  request              Make system requests (reboot, license)
  restart              Restart software process
  set                  Set CLI operational parameters
  show                 Show device status and tables
  traceroute           Trace route to remote destination`,
      newSession,
    };
  }

  const tokens = line.split(/\s+/);
  const cmd = tokens[0].toLowerCase();

  // Mode transitions
  if (cmd === 'configure' || cmd === 'edit') {
    if (session.mode !== 'config') {
      newSession.mode = 'config';
      (newSession as any).junosCandidate = JSON.parse(JSON.stringify(config));
      return { output: 'Entering configuration mode\nThe configuration has been borrowed', newSession };
    }
  }

  if (cmd === 'exit' || cmd === 'quit') {
    if (session.mode === 'config') {
      newSession.mode = 'priv';
      newSession.currentInterface = undefined;
      return { output: 'Exiting configuration mode', newSession };
    }
    return { output: '\n[Connection to device closed]', newSession };
  }

  if (cmd === 'top') {
    newSession.currentInterface = undefined;
    return { output: '', newSession };
  }

  // Ping
  if (cmd === 'ping') {
    const target = tokens[1];
    if (!target) return { output: 'syntax error: ping <host>', newSession };
    return {
      output: `PING ${target} (56 bytes of data):\n64 bytes from ${target}: icmp_seq=0 ttl=64 time=1.23 ms\n64 bytes from ${target}: icmp_seq=1 ttl=64 time=1.05 ms\n64 bytes from ${target}: icmp_seq=2 ttl=64 time=1.12 ms\n64 bytes from ${target}: icmp_seq=3 ttl=64 time=1.08 ms\n\n--- ${target} ping statistics ---\n4 packets transmitted, 4 packets received, 0% packet loss`,
      newSession,
    };
  }

  // SHOW COMMANDS (both operational & config)
  if (cmd === 'show') {
    const sub = tokens.slice(1).join(' ').toLowerCase();

    if (session.mode === 'config') {
      if (sub === '| compare' || sub === 'compare') {
        const changes: string[] = [];
        if (candidate.hostname && candidate.hostname !== config.hostname) {
          changes.push(`[edit system]\n-  host-name ${config.hostname};\n+  host-name ${candidate.hostname};`);
        }
        for (const [k, iface] of Object.entries(candidate.interfaces || {})) {
          const orig = config.interfaces[k];
          if (orig && (orig.ip !== iface.ip || orig.mask !== iface.mask)) {
            changes.push(`[edit interfaces ${k} unit 0 family inet]\n-     address ${orig.ip || 'none'}/${maskToCidr(orig.mask || '255.255.255.0')};\n+     address ${iface.ip}/${maskToCidr(iface.mask || '255.255.255.0')};`);
          }
        }
        return {
          output: changes.length > 0 ? changes.join('\n\n') : '[No changes between candidate and running configuration]',
          newSession,
        };
      }
      return {
        output: `## Last changed: 2024-01-15 04:30 UTC
version 22.4R1.10;
system {
    host-name ${candidate.hostname || config.hostname};
}
interfaces {
${Object.entries(candidate.interfaces || config.interfaces)
  .map(
    ([k, iface]) => `    ${k} {
        unit 0 {
            family inet {
                address ${iface.ip || '0.0.0.0'}/${maskToCidr(iface.mask || '255.255.255.0')};
            }
        }
    }`
  )
  .join('\n')}
}`,
        newSession,
      };
    }

    // Operational show commands
    if (sub.startsWith('interfaces terse') || sub === 'int terse' || sub === 'interfaces' || sub === 'int') {
      const rows = Object.values(config.interfaces).map((iface) => {
        const portName = iface.name.padEnd(16, ' ');
        const admin = (iface.status === 'up' ? 'up' : 'down').padEnd(6, ' ');
        const link = (iface.status === 'up' ? 'up' : 'down').padEnd(6, ' ');
        const proto = 'inet'.padEnd(8, ' ');
        const addr = iface.ip ? `${iface.ip}/${maskToCidr(iface.mask || '255.255.255.0')}` : '';
        return `${portName} ${admin} ${link} ${proto} ${addr}`;
      });
      return {
        output: `Interface        Admin  Link  Proto    Local          Remote\n${rows.join('\n')}`,
        newSession,
      };
    }

    if (sub.startsWith('route')) {
      const activeRoutes = Object.values(config.interfaces)
        .filter((i) => i.ip && i.status === 'up')
        .map((i) => {
          const cidr = maskToCidr(i.mask || '255.255.255.0');
          const net = getNetworkAddress(i.ip!, i.mask || '255.255.255.0');
          return `${net}/${cidr}      *[Direct/0] 00:15:20\n                    > via ${i.name}`;
        });
      config.routes.forEach((r) => {
        const cidr = maskToCidr(r.mask);
        activeRoutes.push(`${r.network}/${cidr}      *[Static/5] 00:10:00\n                    > to ${r.nextHop}`);
      });
      return {
        output: `inet.0: ${activeRoutes.length} destinations, ${activeRoutes.length} routes (active, 0 holddown, 0 hidden)\n+ = Active Route, - = Last Active, * = Both\n\n${activeRoutes.join('\n')}`,
        newSession,
      };
    }

    if (sub.startsWith('arp')) {
      const arpEntries = (config.arpTable || []).map((e) => {
        const ifName = e.interface || e.port || 'ge-0/0/0.0';
        return `${e.mac.padEnd(18, ' ')} ${e.ip.padEnd(16, ' ')} ${ifName.padEnd(12, ' ')} none`;
      });
      return {
        output: `MAC Address        Address          Interface    Flags\n${
          arpEntries.length > 0 ? arpEntries.join('\n') : '00:1c:b1:22:33:44  192.168.1.100    ge-0/0/0.0   none'
        }`,
        newSession,
      };
    }

    if (sub.startsWith('ospf neighbor')) {
      return {
        output: `Address          Interface               State     ID               Pri  Dead
10.0.0.2         ge-0/0/0.0              Full      192.168.1.254    128    36`,
        newSession,
      };
    }

    if (sub.startsWith('configuration')) {
      return {
        output: `system {\n    host-name ${config.hostname};\n}\ninterfaces {\n${Object.entries(config.interfaces)
          .map(([k, iface]) => `    ${k} {\n        unit 0 {\n            family inet {\n                address ${iface.ip || '0.0.0.0'}/${maskToCidr(iface.mask || '255.255.255.0')};\n            }\n        }\n    }`)
          .join('\n')}\n}`,
        newSession,
      };
    }

    return { output: `unknown command: show ${sub}`, newSession };
  }

  // CONFIGURATION STATEMENTS: set, commit, rollback
  if (session.mode === 'config') {
    if (cmd === 'commit') {
      if (tokens[1] === 'check') {
        return { output: 'configuration check succeeds', newSession };
      }
      // Apply candidate to live config!
      Object.assign(config, candidate);
      onConfigChange(config);
      (newSession as any).junosCandidate = JSON.parse(JSON.stringify(config));
      return { output: 'commit complete', newSession };
    }

    if (cmd === 'rollback') {
      (newSession as any).junosCandidate = JSON.parse(JSON.stringify(config));
      return { output: 'load complete', newSession };
    }

    if (cmd === 'set') {
      // e.g.: set system host-name R1
      if (tokens[1] === 'system' && (tokens[2] === 'host-name' || tokens[2] === 'hostname')) {
        const newHost = tokens[3];
        if (newHost) {
          candidate.hostname = newHost;
          (newSession as any).junosCandidate = candidate;
          return { output: '', newSession };
        }
      }

      // e.g.: set interfaces ge-0/0/0 unit 0 family inet address 192.168.1.1/24
      if (tokens[1] === 'interfaces') {
        const ifName = tokens[2];
        const addrIdx = tokens.indexOf('address');
        if (addrIdx !== -1 && tokens[addrIdx + 1]) {
          const cidrStr = tokens[addrIdx + 1];
          const [ipPart, prefixPart] = cidrStr.split('/');
          const prefix = parseInt(prefixPart || '24', 10);
          const mask = cidrToMask(prefix);

          // Find or create interface in candidate
          const targetIf = Object.keys(config.interfaces).find(
            (k) => k.toLowerCase() === ifName.toLowerCase() || k.toLowerCase().replace(/[-_/]/g, '') === ifName.toLowerCase().replace(/[-_/]/g, '')
          ) || ifName;

          if (!candidate.interfaces) candidate.interfaces = { ...config.interfaces };
          if (!candidate.interfaces[targetIf]) {
            candidate.interfaces[targetIf] = {
              name: targetIf,
              mac: '00:1c:73:' + Math.random().toString(16).substring(2, 6) + ':01',
              status: 'up',
              speed: 1000,
              ip: ipPart,
              mask,
            };
          } else {
            candidate.interfaces[targetIf] = {
              ...candidate.interfaces[targetIf],
              ip: ipPart,
              mask,
              status: 'up',
            };
          }
          (newSession as any).junosCandidate = candidate;
          return { output: '', newSession };
        }
      }

      // e.g.: set routing-options static route 0.0.0.0/0 next-hop 192.168.1.254
      if (tokens[1] === 'routing-options' && tokens[2] === 'static' && tokens[3] === 'route') {
        const cidrStr = tokens[4];
        const nextHop = tokens[tokens.indexOf('next-hop') + 1];
        if (cidrStr && nextHop) {
          const [net, pref] = cidrStr.split('/');
          if (!candidate.routes) candidate.routes = [...config.routes];
          candidate.routes.push({
            network: net,
            mask: cidrToMask(parseInt(pref || '24', 10)),
            nextHop,
          });
          (newSession as any).junosCandidate = candidate;
          return { output: '', newSession };
        }
      }

      return { output: '', newSession };
    }
  }

  return { output: `syntax error: "${line}"`, newSession };
}

// -------------------------------------------------------------------------
// ARISTA EOS EXECUTOR
// -------------------------------------------------------------------------
export function executeAristaCommand(
  rawLine: string,
  device: Device,
  allDevices: Device[],
  session: CliSession,
  onConfigChange: (c: DeviceConfig) => void,
  allLinks?: Link[]
): { output: string; newSession: CliSession } {
  const line = rawLine.trim();
  const newSession: CliSession = {
    ...session,
    history: [...session.history, line],
    historyIndex: session.history.length + 1,
  };
  const host = device.config.hostname || device.name;
  const config = { ...device.config };

  if (!line) return { output: '', newSession };

  // Handle bash subshell
  if ((session as any).bashActive) {
    if (line === 'exit') {
      (newSession as any).bashActive = false;
      return { output: `logout\nSwitch back to EOS CLI.`, newSession };
    }
    if (line === 'ls' || line === 'ls -la') {
      return {
        output: `total 36\ndrwxr-xr-x  5 admin admin 4096 Jan 15 04:30 .\ndrwxr-xr-x  3 root  root  4096 Jan 15 04:28 ..\n-rw-r--r--  1 admin admin  220 Jan 15 04:28 .bash_logout\n-rw-r--r--  1 admin admin 3526 Jan 15 04:28 .bashrc\ndrwxr-xr-x  2 admin admin 4096 Jan 15 04:30 flash\n-rw-r--r--  1 admin admin  807 Jan 15 04:28 .profile`,
        newSession,
      };
    }
    if (line.startsWith('ip a') || line.startsWith('ip addr')) {
      return {
        output: Object.values(config.interfaces)
          .map(
            (iface, idx) =>
              `${idx + 1}: ${iface.name}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP\n    link/ether ${iface.mac} brd ff:ff:ff:ff:ff:ff\n    inet ${iface.ip || '0.0.0.0'}/${maskToCidr(iface.mask || '255.255.255.0')} scope global ${iface.name}`
          )
          .join('\n'),
        newSession,
      };
    }
    if (line === 'uptime') {
      return { output: ' 04:35:12 up 2 days,  1:14,  1 user,  load average: 0.12, 0.08, 0.05', newSession };
    }
    return { output: `bash: ${line}: command executed in simulated Linux environment`, newSession };
  }

  const tokens = line.split(/\s+/);
  const cmd = tokens[0].toLowerCase();

  // Arista bash launcher
  if (cmd === 'bash') {
    (newSession as any).bashActive = true;
    return {
      output: `Arista Networks EOS Linux bash shell\nType 'exit' to return to EOS CLI.`,
      newSession,
    };
  }

  // Version
  if (line === 'show version' || line === 'sh ver') {
    return {
      output: `Arista Networks vEOS-lab
Software image version: 4.28.1F-27221375.4281F
Architecture:           x86_64
Internal build version: 4.28.1F-27221375
System MAC address:     00:1c:73:99:88:01
Hardware version:       vEOS-lab
Serial number:          JPE18090001
Total memory:           4096 MB
Uptime:                 2 days, 1 hours, 14 minutes`,
      newSession,
    };
  }

  // Arista interfaces status
  if (line === 'show interfaces status' || line === 'sh int status') {
    const rows = Object.values(config.interfaces).map((iface) => {
      const port = iface.name.padEnd(12, ' ');
      const desc = (iface.description || 'connected').padEnd(16, ' ');
      const status = (iface.status === 'up' ? 'connected' : 'notconnect').padEnd(14, ' ');
      const vlan = (iface.mode === 'trunk' ? 'trunk' : `${iface.accessVlan || 1}`).padEnd(8, ' ');
      const duplex = 'a-full'.padEnd(8, ' ');
      const speed = '1000'.padEnd(6, ' ');
      const type = '1000BASE-T';
      return `${port} ${desc} ${status} ${vlan} ${duplex} ${speed} ${type}`;
    });
    return {
      output: `Port         Name             Status         Vlan     Duplex   Speed  Type\n${rows.join('\n')}`,
      newSession,
    };
  }

  // Arista LLDP neighbors
  if (line === 'show lldp neighbors' || line === 'sh lldp nei') {
    return {
      output: `Port          Neighbor Device ID                 Neighbor Port ID           TTL
Et1           Arista-Spine1.local                Ethernet1                  120
Et2           Arista-Spine2.local                Ethernet1                  120`,
      newSession,
    };
  }

  // Arista sanitized running config
  if (line.startsWith('show running-config sanitized') || line.startsWith('sh run')) {
    return {
      output: `! Command: show running-config
! device: ${host} (vEOS-lab, EOS-4.28.1F)
!
transceiver qsfp default-mode 4x10G
!
hostname ${host}
!
spanning-tree mode mstp
!
${Object.values(config.interfaces)
  .map((i) => `interface ${i.name}\n   no shutdown\n   ip address ${i.ip || '0.0.0.0'}/${maskToCidr(i.mask || '255.255.255.0')}`)
  .join('\n!\n')}
!
end`,
      newSession,
    };
  }

  // Navigation & basic config
  if (cmd === 'enable' || cmd === 'en') {
    newSession.mode = 'priv';
    return { output: '', newSession };
  }
  if (cmd === 'configure' && (tokens[1] === 'terminal' || tokens[1] === 't')) {
    newSession.mode = 'config';
    return { output: '', newSession };
  }
  if (cmd === 'exit' || cmd === 'end') {
    if (session.mode === 'config-if') {
      newSession.mode = 'config';
      newSession.currentInterface = undefined;
      return { output: '', newSession };
    }
    if (session.mode === 'config') {
      newSession.mode = 'priv';
      return { output: '', newSession };
    }
    if (session.mode === 'priv') {
      newSession.mode = 'user';
      return { output: '', newSession };
    }
    return { output: '\n[Connection closed]', newSession };
  }

  // Fallback to standard command logic with Arista prompt
  return { output: `% Invalid input (Arista EOS command parser)`, newSession };
}

// -------------------------------------------------------------------------
// LINUX / VYOS EXECUTOR
// -------------------------------------------------------------------------
export function executeLinuxCommand(
  rawLine: string,
  device: Device,
  allDevices: Device[],
  session: CliSession,
  onConfigChange: (c: DeviceConfig) => void,
  allLinks?: Link[]
): { output: string; newSession: CliSession } {
  const line = rawLine.trim();
  const newSession: CliSession = {
    ...session,
    history: [...session.history, line],
    historyIndex: session.history.length + 1,
  };
  const host = device.config.hostname || device.name;
  const config = { ...device.config };

  if (!line) return { output: '', newSession };

  const tokens = line.split(/\s+/);
  const cmd = tokens[0].toLowerCase();

  // Linux ip addr / ip a
  if (cmd === 'ip' && (tokens[1] === 'addr' || tokens[1] === 'a' || tokens[1] === 'address')) {
    if (tokens[2] === 'add') {
      // ip addr add 192.168.1.1/24 dev eth0
      const cidrStr = tokens[3];
      const devIdx = tokens.indexOf('dev');
      const devName = devIdx !== -1 ? tokens[devIdx + 1] : Object.keys(config.interfaces)[0];
      if (cidrStr && devName) {
        const [ip, pref] = cidrStr.split('/');
        const mask = cidrToMask(parseInt(pref || '24', 10));
        const matched = Object.keys(config.interfaces).find((k) => k.toLowerCase() === devName.toLowerCase()) || devName;
        config.interfaces[matched] = {
          ...(config.interfaces[matched] || { name: matched, speed: 1000 }),
          ip,
          mask,
          status: 'up',
        };
        onConfigChange(config);
        return { output: `[OK] Address ${cidrStr} assigned to ${matched}.`, newSession };
      }
    }

    const rows = Object.values(config.interfaces).map((iface, i) => {
      const idx = i + 1;
      const state = iface.status === 'up' ? 'UP' : 'DOWN';
      const cidr = iface.ip ? `${iface.ip}/${maskToCidr(iface.mask || '255.255.255.0')}` : 'none';
      return `${idx}: ${iface.name}: <BROADCAST,MULTICAST,${state}> mtu 1500 qdisc fq_codel state ${state} group default qlen 1000\n    link/ether ${iface.mac} brd ff:ff:ff:ff:ff:ff\n    inet ${cidr} brd + scope global ${iface.name}\n       valid_lft forever preferred_lft forever`;
    });
    return { output: rows.join('\n'), newSession };
  }

  // Linux ip link
  if (cmd === 'ip' && tokens[1] === 'link') {
    if (tokens[2] === 'set') {
      const devIdx = tokens.indexOf('dev');
      const devName = devIdx !== -1 ? tokens[devIdx + 1] : tokens[3];
      const isUp = tokens.includes('up');
      const isDown = tokens.includes('down');
      const matched = Object.keys(config.interfaces).find((k) => k.toLowerCase() === devName?.toLowerCase());
      if (matched && (isUp || isDown)) {
        config.interfaces[matched].status = isUp ? 'up' : 'down';
        onConfigChange(config);
        return { output: '', newSession };
      }
    }
  }

  // Linux ip route / route -n
  if ((cmd === 'ip' && (tokens[1] === 'route' || tokens[1] === 'r')) || cmd === 'route') {
    if (tokens[2] === 'add') {
      // ip route add default via 192.168.1.254
      const dst = tokens[3];
      const viaIdx = tokens.indexOf('via');
      const gw = viaIdx !== -1 ? tokens[viaIdx + 1] : tokens[4];
      if (dst && gw) {
        config.routes.push({
          network: dst === 'default' ? '0.0.0.0' : dst.split('/')[0],
          mask: dst === 'default' ? '0.0.0.0' : cidrToMask(parseInt(dst.split('/')[1] || '24', 10)),
          nextHop: gw,
        });
        onConfigChange(config);
        return { output: `[OK] Route added: ${dst} via ${gw}`, newSession };
      }
    }

    const rows: string[] = [];
    if (config.defaultGateway) {
      rows.push(`default via ${config.defaultGateway} dev eth0 proto static metric 100`);
    }
    Object.values(config.interfaces)
      .filter((i) => i.ip && i.status === 'up')
      .forEach((i) => {
        const net = getNetworkAddress(i.ip!, i.mask || '255.255.255.0');
        const cidr = maskToCidr(i.mask || '255.255.255.0');
        rows.push(`${net}/${cidr} dev ${i.name} proto kernel scope link src ${i.ip}`);
      });
    config.routes.forEach((r) => {
      rows.push(`${r.network}/${maskToCidr(r.mask)} via ${r.nextHop} proto static`);
    });
    return { output: rows.join('\n'), newSession };
  }

  // Linux ip neigh / arp -n
  if ((cmd === 'ip' && (tokens[1] === 'neigh' || tokens[1] === 'neighbor')) || cmd === 'arp') {
    const rows = (config.arpTable || []).map((e) => `${e.ip} dev ${e.interface || e.port || 'eth0'} lladdr ${e.mac} REACHABLE`);
    return {
      output: rows.length > 0 ? rows.join('\n') : '192.168.1.254 dev eth0 lladdr 00:1c:73:22:33:44 REACHABLE',
      newSession,
    };
  }

  // Linux ping
  if (cmd === 'ping') {
    const target = tokens.find((t) => isValidIp(t) || (!t.startsWith('-') && t !== 'ping'));
    if (!target) return { output: 'Usage: ping [-c count] <destination>', newSession };
    return {
      output: `PING ${target} (${target}) 56(84) bytes of data.\n64 bytes from ${target}: icmp_seq=1 ttl=64 time=0.982 ms\n64 bytes from ${target}: icmp_seq=2 ttl=64 time=1.04 ms\n64 bytes from ${target}: icmp_seq=3 ttl=64 time=0.995 ms\n64 bytes from ${target}: icmp_seq=4 ttl=64 time=1.01 ms\n\n--- ${target} ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss, time 3004ms\nrtt min/avg/max/mdev = 0.982/1.006/1.040/0.021 ms`,
      newSession,
    };
  }

  // Linux traceroute
  if (cmd === 'traceroute') {
    const target = tokens[1] || '8.8.8.8';
    return {
      output: `traceroute to ${target} (${target}), 30 hops max, 60 byte packets\n 1  192.168.1.1  1.214 ms  1.189 ms  1.176 ms\n 2  10.0.0.1  2.412 ms  2.398 ms  2.385 ms\n 3  ${target}  12.450 ms  12.421 ms  12.408 ms`,
      newSession,
    };
  }

  // Linux cat files
  if (cmd === 'cat') {
    const file = tokens[1];
    if (file === '/etc/network/interfaces') {
      return {
        output: `auto lo\niface lo inet loopback\n\n${Object.values(config.interfaces)
          .map((i) => `auto ${i.name}\niface ${i.name} inet static\n    address ${i.ip || '0.0.0.0'}\n    netmask ${i.mask || '255.255.255.0'}`)
          .join('\n\n')}`,
        newSession,
      };
    }
    if (file === '/etc/resolv.conf') {
      return { output: `nameserver ${config.dnsServer || '8.8.8.8'}\nnameserver 1.1.1.1`, newSession };
    }
    return { output: `cat: ${file}: No such file or directory`, newSession };
  }

  // Linux uname / uptime / hostname
  if (cmd === 'uname' || line === 'uname -a') {
    return { output: 'Linux gateway 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 x86_64 GNU/Linux', newSession };
  }
  if (cmd === 'uptime') {
    return { output: ' 04:38:22 up 14 days,  3:20,  1 user,  load average: 0.04, 0.02, 0.00', newSession };
  }
  if (cmd === 'hostname') {
    if (tokens[1]) {
      config.hostname = tokens[1];
      onConfigChange(config);
      return { output: '', newSession };
    }
    return { output: host, newSession };
  }

  return { output: `bash: ${cmd}: command not found`, newSession };
}

// -------------------------------------------------------------------------
// MIKROTIK ROUTEROS EXECUTOR
// -------------------------------------------------------------------------
export function executeMikrotikCommand(
  rawLine: string,
  device: Device,
  allDevices: Device[],
  session: CliSession,
  onConfigChange: (c: DeviceConfig) => void,
  allLinks?: Link[]
): { output: string; newSession: CliSession } {
  const line = rawLine.trim();
  const newSession: CliSession = {
    ...session,
    history: [...session.history, line],
    historyIndex: session.history.length + 1,
  };
  const host = device.config.hostname || device.name;
  const config = { ...device.config };

  if (!line) return { output: '', newSession };

  // MikroTik commands typically start with slash or menu words
  const normalized = line.startsWith('/') ? line : `/${line}`;

  // /ip address print
  if (normalized.startsWith('/ip address print') || normalized === '/ip address') {
    const rows = Object.values(config.interfaces).map((iface, idx) => {
      const num = `#`.padEnd(2, ' ') + idx.toString().padEnd(3, ' ');
      const addr = (iface.ip ? `${iface.ip}/${maskToCidr(iface.mask || '255.255.255.0')}` : 'none').padEnd(20, ' ');
      const net = (iface.ip ? getNetworkAddress(iface.ip, iface.mask || '255.255.255.0') : '0.0.0.0').padEnd(16, ' ');
      const dev = iface.name;
      return `${num} ${addr} ${net} ${dev}`;
    });
    return {
      output: `Flags: X - disabled, I - invalid, D - dynamic\n #   ADDRESS              NETWORK          INTERFACE\n${rows.join('\n')}`,
      newSession,
    };
  }

  // /ip address add address=192.168.1.1/24 interface=ether1
  if (normalized.startsWith('/ip address add')) {
    const addrMatch = line.match(/address=([^\s]+)/i);
    const ifMatch = line.match(/interface=([^\s]+)/i);
    if (addrMatch && ifMatch) {
      const [ip, pref] = addrMatch[1].split('/');
      const mask = cidrToMask(parseInt(pref || '24', 10));
      const ifName = ifMatch[1];
      const matched = Object.keys(config.interfaces).find((k) => k.toLowerCase() === ifName.toLowerCase()) || ifName;
      config.interfaces[matched] = {
        ...(config.interfaces[matched] || { name: matched, speed: 1000 }),
        ip,
        mask,
        status: 'up',
      };
      onConfigChange(config);
      return { output: `[OK] Address added to ${matched}.`, newSession };
    }
  }

  // /ip route print
  if (normalized.startsWith('/ip route print')) {
    const rows: string[] = [];
    Object.values(config.interfaces)
      .filter((i) => i.ip && i.status === 'up')
      .forEach((i, idx) => {
        const net = getNetworkAddress(i.ip!, i.mask || '255.255.255.0');
        const cidr = maskToCidr(i.mask || '255.255.255.0');
        rows.push(`DAc  ${net}/${cidr}      ${i.name}           1`);
      });
    config.routes.forEach((r) => {
      rows.push(`DAs  ${r.network}/${maskToCidr(r.mask)}    ${r.nextHop}         1`);
    });
    return {
      output: `Flags: D - DYNAMIC; A - ACTIVE; c - CONNECT, s - STATIC\nColumns: DST-ADDRESS, GATEWAY, DISTANCE\n#    DST-ADDRESS         GATEWAY          DISTANCE\n${rows.join('\n')}`,
      newSession,
    };
  }

  // /interface print
  if (normalized.startsWith('/interface print') || normalized.startsWith('/interface ethernet print')) {
    const rows = Object.values(config.interfaces).map((iface, idx) => {
      const flag = iface.status === 'up' ? 'R' : 'X';
      return ` ${idx}  ${flag}  name="${iface.name}" default-name="${iface.name}" mtu=1500 mac-address=${iface.mac}`;
    });
    return {
      output: `Flags: R - RUNNING; X - DISABLED\nColumns: NAME, DEFAULT-NAME, MTU, MAC-ADDRESS\n#     NAME              DEFAULT-NAME     MTU   MAC-ADDRESS\n${rows.join('\n')}`,
      newSession,
    };
  }

  // /ping 192.168.1.1
  if (normalized.startsWith('/ping') || normalized.startsWith('/tool ping')) {
    const target = line.split(/\s+/)[1]?.replace('address=', '');
    if (!target) return { output: 'syntax: /ping <address>', newSession };
    return {
      output: `  SEQ HOST                                     SIZE TTL TIME  STATUS
    0 ${target}                                   56  64 1ms   echo reply
    1 ${target}                                   56  64 1ms   echo reply
    2 ${target}                                   56  64 1ms   echo reply
    3 ${target}                                   56  64 1ms   echo reply
    sent=4 received=4 packet-loss=0% min-rtt=1ms avg-rtt=1ms max-rtt=1ms`,
      newSession,
    };
  }

  // /system identity
  if (normalized.startsWith('/system identity print')) {
    return { output: `name: "${host}"`, newSession };
  }
  if (normalized.startsWith('/system identity set')) {
    const nameMatch = line.match(/name="?([^"\s]+)"?/i);
    if (nameMatch) {
      config.hostname = nameMatch[1];
      onConfigChange(config);
      return { output: '', newSession };
    }
  }

  // /system resource print
  if (normalized.startsWith('/system resource print')) {
    return {
      output: `                   uptime: 3d14h22m
                  version: 7.14.3 (stable)
               build-time: Feb/28/2024 11:20:41
         factory-software: 7.10
              free-memory: 3840.4MiB
             total-memory: 4096.0MiB
                      cpu: tile
                cpu-count: 16
            cpu-frequency: 1200MHz
                 cpu-load: 1%
           free-hdd-space: 480.2MiB
          total-hdd-space: 512.0MiB
  write-sect-since-reboot: 1421
         write-sect-total: 32015
               bad-blocks: 0%
        architecture-name: tile
               board-name: CCR1016-12G
                 platform: MikroTik`,
      newSession,
    };
  }

  // /export
  if (normalized === '/export') {
    return {
      output: `# 2024-01-15 04:40:12 by RouterOS 7.14.3
# software id = Q83X-12NV
#
# model = CCR1016-12G
/interface ethernet
${Object.values(config.interfaces).map((i) => `set [ find default-name=${i.name} ] name=${i.name}`).join('\n')}
/ip address
${Object.values(config.interfaces).map((i) => `add address=${i.ip || '0.0.0.0'}/${maskToCidr(i.mask || '255.255.255.0')} interface=${i.name}`).join('\n')}
/system identity
set name="${host}"`,
      newSession,
    };
  }

  return { output: `bad command name ${line} (line 1 column 1)`, newSession };
}
