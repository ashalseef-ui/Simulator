import { Device, Link } from '../../types/network';
import { isValidIp } from '../../utils/ipUtils';
import { simulatePing } from '../simulationEngine';

export function resolveHostOrDomain(
  target: string,
  device: Device,
  allDevices: Device[]
): { ip: string; resolvedVia?: string } {
  if (isValidIp(target)) {
    return { ip: target };
  }

  // 1. Check local static hosts table
  const staticMatch = device.config.staticHosts?.find(
    (h) => h.hostname.toLowerCase() === target.toLowerCase()
  );
  if (staticMatch) {
    return { ip: staticMatch.ip, resolvedVia: 'static host table' };
  }

  // 2. Check if hostname matches any device hostname/name in the network topology
  for (const d of allDevices) {
    if ((d.config.hostname || d.name).toLowerCase() === target.toLowerCase()) {
      const primaryIface = Object.values(d.config.interfaces).find((i) => i.ip);
      if (primaryIface?.ip) {
        return { ip: primaryIface.ip, resolvedVia: 'local network lookup' };
      }
    }
  }

  // 3. Query DNS Servers in topology
  for (const d of allDevices) {
    if (d.type === 'server' && d.config.services?.dns?.enabled) {
      const record = d.config.services.dns.records?.find(
        (r) => r.domain.toLowerCase() === target.toLowerCase()
      );
      if (record?.ip) {
        const dnsServerIp =
          device.config.dnsServer ||
          Object.values(d.config.interfaces)[0]?.ip ||
          '192.168.1.10';
        return { ip: record.ip, resolvedVia: `domain server (${dnsServerIp})` };
      }
    }
  }

  return { ip: target };
}

export function resolveTarget(
  target: string,
  device: Device,
  allDevices: Device[]
): { ip?: string; log: string; error?: string } {
  if (isValidIp(target)) return { ip: target, log: '' };
  if (device.config.domainLookupEnabled === false) {
    return { log: '', error: '% Unrecognized host or address, or protocol not running.' };
  }
  const res = resolveHostOrDomain(target, device, allDevices);
  if (res.resolvedVia) {
    return { ip: res.ip, log: `Translating "${target}"...${res.resolvedVia} [OK]\n\n` };
  }
  return {
    log: '',
    error: `Translating "${target}"...domain server (${
      device.config.dnsServer || '255.255.255.255'
    })\n% Unrecognized host or address, or protocol not running.`,
  };
}

export function simulateCliPing(
  target: string,
  device: Device,
  allDevices: Device[],
  allLinks: Link[],
  debugIcmp?: boolean,
  repeat: number = 5
): string {
  const resolved = resolveTarget(target, device, allDevices);
  if (!resolved.ip) return resolved.error!;
  const resolvedIp = resolved.ip;

  const result = simulatePing(device.id, resolvedIp, allDevices, allLinks);
  const found = result.success;
  const srcIp =
    Object.values(device.config.interfaces).find((i) => i.ip && i.status === 'up')?.ip ||
    '0.0.0.0';

  let out = `${resolved.log}Type escape sequence to abort.\nSending ${repeat}, 100-byte ICMP Echos to ${resolvedIp}, timeout is 2 seconds:\n`;
  if (debugIcmp) {
    for (let i = 1; i <= Math.min(repeat, 3); i++) {
      out += found
        ? `*Mar 1 00:04:12.${100 + i * 15}: ICMP: echo reply rcvd, src=${resolvedIp}, dst=${srcIp}, seq=${i}\n`
        : `*Mar 1 00:04:12.${100 + i * 15}: ICMP: echo request sent to ${resolvedIp}, timeout expired (${
            result.error || 'unreachable'
          })\n`;
    }
  }

  if (found) {
    out += `${'!'.repeat(repeat)}\nSuccess rate is 100 percent (${repeat}/${repeat}), round-trip min/avg/max = 1/2/4 ms`;
  } else {
    const unreachable = /no route/i.test(result.error || '');
    out += `${(unreachable ? 'U' : '.').repeat(repeat)}\nSuccess rate is 0 percent (0/${repeat})`;
  }
  return out;
}

export function simulateCliTraceroute(
  target: string,
  device: Device,
  allDevices: Device[],
  allLinks: Link[]
): string {
  const resolved = resolveTarget(target, device, allDevices);
  if (!resolved.ip) return resolved.error!;
  const resolvedIp = resolved.ip;

  let out = `${resolved.log}Type escape sequence to abort.\nTracing the route to ${target} (${resolvedIp})\n\n`;
  const result = simulatePing(device.id, resolvedIp, allDevices, allLinks);
  const byId = new Map(allDevices.map((d) => [d.id, d]));

  const hops: string[] = [];
  for (const st of result.steps) {
    if (!st.stage.startsWith('ICMP Echo Request')) continue;
    const to = byId.get(st.toDeviceId);
    const ip = to?.config.interfaces[st.toPort]?.ip;
    const routed =
      to &&
      (to.type.startsWith('router') ||
        to.type === 'firewall' ||
        (to.type === 'l3switch' && to.config.ipRoutingEnabled));
    if (ip && (routed || ip === resolvedIp)) hops.push(ip);
  }
  const unique = hops.filter((ip, i) => hops.indexOf(ip) === i);
  if (!unique.includes(resolvedIp)) unique.push(resolvedIp);

  if (!result.success) {
    const reached = unique.filter((ip) => ip !== resolvedIp);
    reached.forEach((ip, i) => (out += `  ${i + 1} ${ip} ${i + 1} msec ${i + 1} msec ${i + 1} msec\n`));
    out += `  ${reached.length + 1} * * *\n  ${reached.length + 2} * * *`;
    return out;
  }
  unique.forEach((ip, i) => (out += `  ${i + 1} ${ip} ${i + 1} msec ${i + 1} msec ${i + 2} msec\n`));
  return out.trimEnd();
}
