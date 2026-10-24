import { Device, DeviceConfig, Link } from "../../../types/network";
import { isValidIp, maskToCidr, cidrToMask, getNetworkAddress } from "../../../utils/ipUtils";
import { CliSession } from "../cliTypes";

export function executeMikrotikCommand(
  rawLine: string,
  device: Device,
  _allDevices: Device[],
  session: CliSession,
  onConfigChange: (c: DeviceConfig) => void,
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
      .forEach((i) => {
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

