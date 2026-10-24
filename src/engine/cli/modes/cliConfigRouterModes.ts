import { Device, DeviceConfig, Link } from "../../../types/network";
import { isValidIp } from "../../../utils/ipUtils";
import { CliSession } from "../cliTypes";
import { appendDeviceLog } from "../cliUtils";

export function handleConfigRouterModes(
  line: string,
  cmd: string,
  tokens: string[],
  isNo: boolean,
  device: Device,
  allDevices: Device[],
  config: DeviceConfig,
  session: CliSession,
  newSession: CliSession,
  onConfigChange: (updatedConfig: DeviceConfig) => void,
  allLinks: Link[] = [],
  executeCommand?: (
    raw: string,
    dev: Device,
    allDevs: Device[],
    sess: CliSession,
    onCfg: (c: DeviceConfig) => void,
    links?: Link[]
  ) => { output: string; newSession: CliSession }
): { output: string; newSession: CliSession } {
  // ROUTER OSPF CONFIG MODE
  if (session.mode === 'config-router') {
    if (cmd === 'network') {
      const net = tokens[1];
      const wildcard = tokens[2];
      const areaIdx = tokens.indexOf('area');
      const area = areaIdx !== -1 ? parseInt(tokens[areaIdx + 1], 10) : 0;
      if (!net || !wildcard || isNaN(area)) {
        return { output: '% Incomplete command. Syntax: network <network> <wildcard> area <area-id>', newSession };
      }
      if (!config.ospf) {
        config.ospf = { processId: session.currentOspfProcess || 1, networks: [] };
      }
      config.ospf.networks.push({ network: net, wildcard, area });
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'router-id') {
      const rid = tokens[1];
      if (!rid || !isValidIp(rid)) return { output: '% Invalid OSPF router ID format.', newSession };
      if (!config.ospf) config.ospf = { processId: session.currentOspfProcess || 1, networks: [] };
      config.ospf.routerId = rid;
      onConfigChange(config);
      return { output: '% OSPF: Reload or "clear ip ospf process" required to take effect.', newSession };
    }

    if (cmd === 'passive-interface') {
      const iface = tokens[1];
      if (!iface) return { output: '% Incomplete command.', newSession };
      if (!config.ospf) config.ospf = { processId: session.currentOspfProcess || 1, networks: [] };
      if (!config.ospf.passiveInterfaces) config.ospf.passiveInterfaces = [];
      if (!config.ospf.passiveInterfaces.includes(iface)) config.ospf.passiveInterfaces.push(iface);
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'no') {
      const subCmd = tokens[1]?.toLowerCase();
      if (subCmd === 'network') {
        const net = tokens[2];
        if (config.ospf && net) {
          config.ospf.networks = config.ospf.networks.filter((n) => n.network !== net);
          onConfigChange(config);
        }
        return { output: '', newSession };
      }
      if (subCmd === 'passive-interface') {
        const iface = tokens[2];
        if (config.ospf?.passiveInterfaces && iface) {
          config.ospf.passiveInterfaces = config.ospf.passiveInterfaces.filter((p) => p !== iface);
          onConfigChange(config);
        }
        return { output: '', newSession };
      }
      if (subCmd === 'router-id') {
        if (config.ospf) delete config.ospf.routerId;
        onConfigChange(config);
        return { output: '', newSession };
      }
    }

    if (cmd === 'default-information' && tokens[1] === 'originate') {
      if (!config.ospf) config.ospf = { processId: session.currentOspfProcess || 1, networks: [] };
      config.ospf.defaultInformationOriginate = true;
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'do') {
      if (executeCommand) return executeCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange
      );
    }
    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

  // ROUTER BGP CONFIG MODE
  if (session.mode === 'config-router-bgp') {
    if (cmd === 'bgp' && tokens[1] === 'router-id') {
      const rid = tokens[2];
      if (!rid || !isValidIp(rid)) return { output: '% Invalid BGP router ID format.', newSession };
      if (!config.bgp) config.bgp = { asn: session.currentBgpAsn || 65000, neighbors: [], networks: [] };
      config.bgp.routerId = rid;
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'neighbor') {
      const peerIp = tokens[1];
      if (!peerIp || !isValidIp(peerIp)) return { output: '% Invalid neighbor IP address.', newSession };
      if (!config.bgp) config.bgp = { asn: session.currentBgpAsn || 65000, neighbors: [], networks: [] };
      let neighbor = config.bgp.neighbors.find((n) => n.ip === peerIp);

      if (tokens[2] === 'remote-as') {
        const remoteAs = parseInt(tokens[3], 10);
        if (isNaN(remoteAs)) return { output: '% Incomplete command. Syntax: neighbor <ip> remote-as <1-65535>', newSession };
        if (!neighbor) {
          neighbor = { ip: peerIp, remoteAs, state: 'Established' };
          config.bgp.neighbors.push(neighbor);
        } else {
          neighbor.remoteAs = remoteAs;
          neighbor.state = 'Established';
        }
        onConfigChange(config);
        const peerType = remoteAs === config.bgp.asn ? 'iBGP' : 'eBGP';
        return {
          output: `%BGP-5-ADJCHANGE: neighbor ${peerIp} Up (${peerType} peering AS ${remoteAs})`,
          newSession,
        };
      }

      if (tokens[2] === 'description') {
        const desc = tokens.slice(3).join(' ');
        if (neighbor) {
          neighbor.description = desc;
          onConfigChange(config);
          return { output: '', newSession };
        }
      }

      if (tokens[2] === 'update-source') {
        const srcIface = tokens[3];
        if (neighbor) {
          neighbor.updateSource = srcIface;
          onConfigChange(config);
          return { output: '', newSession };
        }
      }
    }

    if (cmd === 'network') {
      const net = tokens[1];
      const maskIdx = tokens.indexOf('mask') !== -1 ? tokens.indexOf('mask') : tokens.indexOf('netmask');
      const mask = maskIdx !== -1 ? tokens[maskIdx + 1] : '255.255.255.0';
      if (!net || !isValidIp(net)) {
        return { output: '% Incomplete command. Syntax: network <network> [mask <mask>]', newSession };
      }
      if (!config.bgp) config.bgp = { asn: session.currentBgpAsn || 65000, neighbors: [], networks: [] };
      if (!config.bgp.networks.some((n) => n.network === net && n.mask === mask)) {
        config.bgp.networks.push({ network: net, mask });
      }
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'do') {
      if (executeCommand) return executeCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange
      );
    }

    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

  // ROUTER EIGRP CONFIG MODE
  if (session.mode === 'config-router-eigrp') {
    if (cmd === 'eigrp' && tokens[1] === 'router-id') {
      const rid = tokens[2];
      if (!rid || !isValidIp(rid)) return { output: '% Invalid EIGRP router ID.', newSession };
      if (!config.eigrp) config.eigrp = { asNumber: session.currentEigrpAs || 100, autoSummary: false, networks: [] };
      config.eigrp.routerId = rid;
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'network') {
      const net = tokens[1];
      const wildcard = tokens[2] || '0.0.0.255';
      if (!net || !isValidIp(net)) return { output: '% Incomplete command. Syntax: network <network> [wildcard]', newSession };
      if (!config.eigrp) config.eigrp = { asNumber: session.currentEigrpAs || 100, autoSummary: false, networks: [] };
      if (!config.eigrp.networks.some((n) => n.network === net)) {
        config.eigrp.networks.push({ network: net, wildcard });
      }
      onConfigChange(config);
      return { output: `%DUAL-5-NBRCHANGE: IP-EIGRP ${session.currentEigrpAs || 100}: Neighbor 10.0.0.2 is up: new adjacency`, newSession };
    }

    if (line.startsWith('no auto-summary')) {
      if (!config.eigrp) config.eigrp = { asNumber: session.currentEigrpAs || 100, autoSummary: false, networks: [] };
      config.eigrp.autoSummary = false;
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'do') {
      if (executeCommand) return executeCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange
      );
    }

    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

  // ROUTER RIP CONFIG MODE
  if (session.mode === 'config-router-rip') {
    if (cmd === 'version') {
      const ver = parseInt(tokens[1], 10) || 2;
      if (!config.rip) config.rip = { version: ver, autoSummary: false, networks: [] };
      else config.rip.version = ver;
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'network') {
      const net = tokens[1];
      if (!net || !isValidIp(net)) return { output: '% Incomplete command. Syntax: network <network-number>', newSession };
      if (!config.rip) config.rip = { version: 2, autoSummary: false, networks: [] };
      if (!config.rip.networks.includes(net)) config.rip.networks.push(net);
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (line.startsWith('no auto-summary')) {
      if (!config.rip) config.rip = { version: 2, autoSummary: false, networks: [] };
      config.rip.autoSummary = false;
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'do') {
      if (executeCommand) return executeCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange
      );
    }

    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

  // DHCP POOL CONFIG MODE
  if (session.mode === 'config-dhcp') {
    const poolName = session.currentDhcpPool;
    if (!poolName || !config.dhcpPools?.[poolName]) {
      newSession.mode = 'config';
      return { output: '% DHCP pool not active.', newSession };
    }
    const pool = config.dhcpPools[poolName];

    if (cmd === 'network') {
      const net = tokens[1];
      const mask = tokens[2];
      if (!net || !mask) return { output: '% Incomplete command. Syntax: network <ip> <mask>', newSession };
      pool.network = net;
      pool.mask = mask;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'default-router') {
      const gw = tokens[1];
      if (!gw) return { output: '% Incomplete command.', newSession };
      pool.defaultRouter = gw;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'dns-server') {
      const dns = tokens[1];
      if (!dns) return { output: '% Incomplete command.', newSession };
      pool.dnsServer = dns;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'do') {
      if (executeCommand) return executeCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange
      );
    }
    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

  // VLAN CONFIG MODE
  if (session.mode === 'config-vlan') {
    const vid = session.currentVlan;
    if (cmd === 'name' && vid && config.vlans[vid]) {
      config.vlans[vid].name = tokens[1] || `VLAN${vid}`;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'do') {
      if (executeCommand) return executeCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange
      );
    }
    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

  // LINE CONFIG MODE (config-line)
  if (session.mode === 'config-line') {
    if (cmd === 'password') {
      const pwd = tokens[1];
      if (!pwd) return { output: '% Incomplete command.', newSession };
      config.linePassword = pwd;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'login') {
      config.lineLogin = tokens[1] === 'local' ? 'local' : 'password';
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'transport' && tokens[1] === 'input') {
      config.transportInput = tokens.slice(2).join(' ') || 'ssh';
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'exec-timeout') {
      config.execTimeout = `${tokens[1] || 10} ${tokens[2] || 0}`;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'logging' && tokens[1] === 'synchronous') {
      config.loggingSynchronous = true;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'do') {
      if (executeCommand) return executeCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange
      );
    }
    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

  // ACL CONFIG MODE (config-std-nacl & config-ext-nacl)
  if (session.mode === 'config-std-nacl' || session.mode === 'config-ext-nacl') {
    const aclId = session.currentAcl;
    if (!aclId || !config.accessLists?.[aclId]) {
      newSession.mode = 'config';
      return { output: '% ACL not active.', newSession };
    }
    const acl = config.accessLists[aclId];

    if (cmd === 'permit' || cmd === 'deny') {
      const action = cmd as 'permit' | 'deny';
      const rest = tokens.slice(1);
      let proto = 'ip';
      let source = 'any';
      let destination: string | undefined;
      let port: number | undefined;

      if (acl.type === 'extended') {
        proto = rest[0] || 'ip';
        source = rest[1] || 'any';
        destination = rest[2] || 'any';
        const eqIdx = rest.indexOf('eq');
        if (eqIdx !== -1 && rest[eqIdx + 1]) {
          const p = rest[eqIdx + 1].toLowerCase();
          port = parseInt(p, 10) || (p === 'www' || p === 'http' ? 80 : p === 'https' ? 443 : p === 'telnet' ? 23 : p === 'ssh' ? 22 : 80);
        }
      } else {
        source = rest.join(' ') || 'any';
      }

      const validProtos = ['ip', 'tcp', 'udp', 'icmp'] as const;
      const normalizedProto: 'ip' | 'tcp' | 'udp' | 'icmp' = validProtos.includes(proto as any) ? (proto as any) : 'ip';

      acl.rules.push({
        action,
        protocol: normalizedProto,
        source,
        destination,
        port,
        matchCount: 0,
      });
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'remark') {
      return { output: '', newSession };
    }

    if (cmd === 'do') {
      if (executeCommand) return executeCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange
      );
    }
    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

  return { output: `% Invalid command.`, newSession };
}