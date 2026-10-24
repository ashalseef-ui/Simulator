import { Device, DeviceConfig, Link } from "../../../types/network";
import { isValidIp, maskToCidr, cidrToMask, getNetworkAddress } from "../../../utils/ipUtils";
import { CliSession } from "../cliTypes";

export function executeLinuxCommand(
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

