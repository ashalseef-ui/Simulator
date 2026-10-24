import { Device } from '../../types/network';
import { maskToCidr, getNetworkAddress } from '../../utils/ipUtils';
import { formatOspfRoute, OspfRoute } from '../ospfEngine';

export function generateRunningConfig(device: Device, showSecrets = false): string {
  const c = device.config;
  let lines: string[] = [
    'Building configuration...',
    '',
    'Current configuration : 1842 bytes',
    '!',
    'version 15.4',
    'no service timestamps log datetime msec',
    'service password-encryption',
    '!',
    `hostname ${c.hostname || 'Router'}`,
    '!',
  ];

  if (c.enableSecret) {
    const secretValue = showSecrets ? c.enableSecret : '5 $1$mERr$hx5rVt7rPNoS4wqbXKX7m0';
    lines.push(`enable secret ${secretValue}`);
    lines.push('!');
  }

  if (c.ipRoutingEnabled) {
    lines.push('ip routing');
    lines.push('!');
  }

  if (c.spanningTreePriority !== undefined && c.spanningTreePriority !== 32768) {
    lines.push(`spanning-tree vlan 1 priority ${c.spanningTreePriority}`);
    lines.push('!');
  }

  // DHCP Pools
  if (c.dhcpPools) {
    for (const [_, pool] of Object.entries(c.dhcpPools)) {
      lines.push(`ip dhcp pool ${pool.name}`);
      if (pool.network && pool.mask) lines.push(` network ${pool.network} ${pool.mask}`);
      if (pool.defaultRouter) lines.push(` default-router ${pool.defaultRouter}`);
      if (pool.dnsServer) lines.push(` dns-server ${pool.dnsServer}`);
      lines.push('!');
    }
  }

  // Interfaces
  for (const [name, iface] of Object.entries(c.interfaces)) {
    lines.push(`interface ${name}`);
    if (iface.encapsulationDot1Q) {
      lines.push(` encapsulation dot1Q ${iface.encapsulationDot1Q}`);
    }
    if (iface.ip && iface.mask) {
      lines.push(` ip address ${iface.ip} ${iface.mask}`);
    } else {
      lines.push(' no ip address');
    }
    if (iface.mode === 'trunk') {
      lines.push(' switchport mode trunk');
    } else if (iface.mode === 'access') {
      lines.push(' switchport mode access');
      if (iface.accessVlan && iface.accessVlan !== 1) {
        lines.push(` switchport access vlan ${iface.accessVlan}`);
      }
    }
    if (iface.ipHelperAddress) {
      lines.push(` ip helper-address ${iface.ipHelperAddress}`);
    }
    if (iface.status === 'down') {
      lines.push(' shutdown');
    } else {
      lines.push(' no shutdown');
    }
    lines.push('!');
  }

  // Static Routes
  if (c.routes && c.routes.length > 0) {
    c.routes.forEach((r) => {
      lines.push(`ip route ${r.network} ${r.mask} ${r.nextHop}`);
    });
    lines.push('!');
  }

  // OSPF
  if (c.ospf) {
    lines.push(`router ospf ${c.ospf.processId}`);
    c.ospf.networks.forEach((n) => {
      lines.push(` network ${n.network} ${n.wildcard} area ${n.area}`);
    });
    lines.push('!');
  }

  // EIGRP
  if (c.eigrp) {
    lines.push(`router eigrp ${c.eigrp.asNumber}`);
    c.eigrp.networks.forEach((n) => {
      lines.push(` network ${n.network} ${n.wildcard}`);
    });
    if (c.eigrp.autoSummary === false) lines.push(' no auto-summary');
    lines.push('!');
  }

  // RIP
  if (c.rip) {
    lines.push('router rip');
    lines.push(` version ${c.rip.version || 2}`);
    c.rip.networks.forEach((net) => {
      lines.push(` network ${net}`);
    });
    if (c.rip.autoSummary === false) lines.push(' no auto-summary');
    lines.push('!');
  }

  // BGP
  if (c.bgp) {
    lines.push(`router bgp ${c.bgp.asn}`);
    c.bgp.neighbors.forEach((n) => {
      lines.push(` neighbor ${n.ip} remote-as ${n.remoteAs}`);
    });
    c.bgp.networks.forEach((b) => {
      lines.push(` network ${b.network} mask ${b.mask}`);
    });
    lines.push('!');
  }

  // SPAN Port Mirroring
  if (c.monitorSession) {
    if (c.monitorSession.sourcePort) lines.push(`monitor session ${c.monitorSession.session} source interface ${c.monitorSession.sourcePort}`);
    if (c.monitorSession.destinationPort) lines.push(`monitor session ${c.monitorSession.session} destination interface ${c.monitorSession.destinationPort}`);
    lines.push('!');
  }

  lines.push('line con 0', 'line vty 0 4', ' login', '!', 'end');
  return lines.join('\n');
}

export function generateRoutingTableOutput(device: Device, ospfRoutes: OspfRoute[] = []): string {
  let out = 'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP\n';
  out += '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area\n';
  out += '       i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2\n\n';

  const defaultRoute = (device.config.routes || []).find((r) => r.network === '0.0.0.0' && (r.mask === '0.0.0.0' || r.mask === '0'));
  out += defaultRoute
    ? `Gateway of last resort is ${defaultRoute.nextHop} to network 0.0.0.0\n\n`
    : 'Gateway of last resort is not set\n\n';

  for (const [name, iface] of Object.entries(device.config.interfaces)) {
    if (iface.ip && iface.mask && iface.status === 'up') {
      const cidr = maskToCidr(iface.mask);
      out += `C        ${getNetworkAddress(iface.ip, iface.mask)}/${cidr} is directly connected, ${name}\n`;
      out += `L        ${iface.ip}/32 is directly connected, ${name}\n`;
    }
  }

  for (const r of device.config.routes || []) {
    const cidr = r.mask === '0' ? 0 : maskToCidr(r.mask);
    const star = r === defaultRoute ? '*' : ' ';
    out += `S${star}       ${r.network}/${cidr} [${r.distance ?? 1}/0] via ${r.nextHop}\n`;
  }

  for (const r of ospfRoutes) out += formatOspfRoute(r) + '\n';

  if (device.config.eigrp?.networks) {
    for (const net of device.config.eigrp.networks) {
      out += `D        ${net.network}/24 [90/307200] via 10.0.0.2, 00:04:12, GigabitEthernet0/0\n`;
    }
  }

  if (device.config.bgp?.networks) {
    for (const b of device.config.bgp.networks) {
      const cidr = maskToCidr(b.mask);
      out += `B        ${b.network}/${cidr} [20/0] via 192.168.100.1, 00:15:32\n`;
    }
  }

  if (device.config.isis?.net) {
    out += `i L2     172.16.1.0/24 [115/20] via 10.1.1.2, 00:03:18, GigabitEthernet0/1\n`;
  }

  return out.trimEnd();
}
