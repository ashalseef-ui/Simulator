import { Device, DeviceConfig, Link } from "../../../types/network";
import { isValidIp, cidrToMask, maskToCidr, getNetworkAddress } from "../../../utils/ipUtils";
import { deepClone } from "../../../utils/deepClone";
import { CliSession } from "../cliTypes";

export function executeJunosCommand(
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
      (newSession as any).junosCandidate = deepClone(config);
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
      (newSession as any).junosCandidate = deepClone(config);
      return { output: 'commit complete', newSession };
    }

    if (cmd === 'rollback') {
      (newSession as any).junosCandidate = deepClone(config);
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

