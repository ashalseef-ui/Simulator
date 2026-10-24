import { Device, DeviceConfig, Link } from "../../../types/network";
import { maskToCidr } from "../../../utils/ipUtils";
import { CliSession } from "../cliTypes";

export function executeAristaCommand(
  rawLine: string,
  device: Device,
  _allDevices: Device[],
  session: CliSession,
  _onConfigChange: (c: DeviceConfig) => void,
  _allLinks?: Link[]
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

