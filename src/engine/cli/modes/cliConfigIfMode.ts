import { Device, DeviceConfig, DeviceInterface, Link } from "../../../types/network";
import { isValidIp } from "../../../utils/ipUtils";
import { CliSession } from "../cliTypes";
import { appendDeviceLog, normalizeInterfaceName } from "../cliUtils";

export function handleConfigIfCommand(
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
    const targetIfNames = session.currentInterfaceRange && session.currentInterfaceRange.length > 0
      ? session.currentInterfaceRange.filter((n) => Boolean(config.interfaces[n]))
      : (session.currentInterface && config.interfaces[session.currentInterface] ? [session.currentInterface] : []);

    if (targetIfNames.length === 0) {
      newSession.mode = 'config';
      return { output: '% Interface not found.', newSession };
    }
    const ifName = targetIfNames[0];
    const iface = config.interfaces[ifName];
    const applyToAllTargets = (mutator: (targetIface: DeviceInterface, name: string) => void) => {
      for (const tName of targetIfNames) {
        const tIface = config.interfaces[tName];
        if (tIface) mutator(tIface, tName);
      }
      onConfigChange(config);
    };

    // shutdown / no shutdown
    if (line === 'shutdown' || line === 'shut') {
      applyToAllTargets((target, tName) => {
        target.status = 'down';
        appendDeviceLog(config, `%LINK-5-CHANGED: Interface ${tName}, changed state to administratively down`);
      });
      return {
        output: targetIfNames.length === 1
          ? `%LINK-5-CHANGED: Interface ${ifName}, changed state to administratively down\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${ifName}, changed state to down`
          : '',
        newSession,
      };
    }
    if (line === 'no shutdown' || line === 'no shut') {
      applyToAllTargets((target, tName) => {
        target.status = 'up';
        if (target.portSecurity) {
          target.portSecurity.state = 'secure-up';
        }
        appendDeviceLog(config, `%LINK-3-UPDOWN: Interface ${tName}, changed state to up`);
      });
      return {
        output: targetIfNames.length === 1
          ? `%LINK-3-UPDOWN: Interface ${ifName}, changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${ifName}, changed state to up`
          : '',
        newSession,
      };
    }

    // ip address <ip> <mask>
    if (cmd === 'ip' && tokens[1] === 'address') {
      const ip = tokens[2];
      const mask = tokens[3];
      if (!ip || !mask) return { output: '% Incomplete command. Syntax: ip address <ip> <mask>', newSession };
      if (!isValidIp(ip) || !isValidIp(mask)) return { output: '% Invalid IP address or mask.', newSession };
      applyToAllTargets((target) => {
        target.ip = ip;
        target.mask = mask;
      });
      return { output: '', newSession };
    }
    if (line.startsWith('no ip address')) {
      applyToAllTargets((target) => {
        delete target.ip;
        delete target.mask;
      });
      return { output: '', newSession };
    }

    // encapsulation dot1Q <vlan>
    if (cmd === 'encapsulation' && tokens[1]?.toLowerCase().startsWith('dot1q')) {
      const vlanId = parseInt(tokens[2], 10);
      if (isNaN(vlanId)) return { output: '% Incomplete command. Syntax: encapsulation dot1Q <vlan-id>', newSession };
      applyToAllTargets((target) => {
        target.encapsulationDot1Q = vlanId;
      });
      return { output: '', newSession };
    }

    // switchport mode access / trunk
    if (cmd === 'switchport' && tokens[1] === 'mode') {
      const mode = tokens[2];
      if (mode === 'access' || mode === 'trunk') {
        applyToAllTargets((target) => {
          target.mode = mode as any;
        });
        return { output: '', newSession };
      }
      return { output: '% Invalid switchport mode (access or trunk).', newSession };
    }

    // switchport access vlan <id>
    if (cmd === 'switchport' && tokens[1] === 'access' && tokens[2] === 'vlan') {
      const vid = parseInt(tokens[3], 10);
      if (isNaN(vid)) return { output: '% Incomplete command.', newSession };
      applyToAllTargets((target) => {
        target.accessVlan = vid;
      });
      if (!config.vlans[vid]) {
        config.vlans[vid] = { id: vid, name: `VLAN${vid.toString().padStart(4, '0')}` };
      }
      onConfigChange(config);
      return { output: '', newSession };
    }

    // switchport voice vlan <id>
    if (cmd === 'switchport' && tokens[1] === 'voice' && tokens[2] === 'vlan') {
      const vvid = parseInt(tokens[3], 10);
      if (!isNaN(vvid)) {
        applyToAllTargets((target) => {
          target.voiceVlan = vvid;
        });
        if (!config.vlans[vvid]) {
          config.vlans[vvid] = { id: vvid, name: `Voice_VLAN${vvid}` };
        }
        onConfigChange(config);
        return { output: '', newSession };
      } else if (tokens[3] === 'dot1p' || tokens[3] === 'untagged' || tokens[3] === 'none') {
        applyToAllTargets((target) => {
          target.voiceVlan = 0;
        });
        return { output: '', newSession };
      }
      return { output: '% Incomplete command. Syntax: switchport voice vlan <1-4094>', newSession };
    }

    // switchport trunk allowed vlan ...
    if (cmd === 'switchport' && tokens[1] === 'trunk' && tokens[2] === 'allowed' && tokens[3] === 'vlan') {
      const subAction = tokens[4]?.toLowerCase();
      if (subAction === 'all') {
        delete iface.trunkAllowedVlans;
        onConfigChange(config);
        return { output: '', newSession };
      }

      // Parse comma or dash separated list e.g. "10,20,30" or "10-20" or "add 10" or "remove 20"
      const parseVlanList = (raw: string): number[] => {
        const result: number[] = [];
        const parts = raw.split(',');
        for (const part of parts) {
          if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (!isNaN(start) && !isNaN(end)) {
              for (let v = Math.min(start, end); v <= Math.max(start, end); v++) {
                if (v >= 1 && v <= 4094 && !result.includes(v)) result.push(v);
              }
            }
          } else {
            const vid = parseInt(part.trim(), 10);
            if (!isNaN(vid) && vid >= 1 && vid <= 4094 && !result.includes(vid)) {
              result.push(vid);
            }
          }
        }
        return result;
      };

      if (subAction === 'add') {
        const toAdd = parseVlanList(tokens.slice(5).join(''));
        if (!iface.trunkAllowedVlans) iface.trunkAllowedVlans = [1];
        for (const v of toAdd) {
          if (!iface.trunkAllowedVlans.includes(v)) iface.trunkAllowedVlans.push(v);
        }
        onConfigChange(config);
        return { output: '', newSession };
      }

      if (subAction === 'remove') {
        const toRemove = parseVlanList(tokens.slice(5).join(''));
        if (iface.trunkAllowedVlans) {
          iface.trunkAllowedVlans = iface.trunkAllowedVlans.filter((v) => !toRemove.includes(v));
        }
        onConfigChange(config);
        return { output: '', newSession };
      }

      // Direct assignment: switchport trunk allowed vlan 10,20,30
      const assigned = parseVlanList(tokens.slice(4).join(''));
      if (assigned.length > 0) {
        iface.trunkAllowedVlans = assigned;
        onConfigChange(config);
        return { output: '', newSession };
      }
      return { output: '% Incomplete or invalid VLAN syntax. Examples: 10,20 or add 30 or all', newSession };
    }

    // ip helper-address <ip>
    if (cmd === 'ip' && tokens[1] === 'helper-address') {
      const helper = tokens[2];
      if (!helper || !isValidIp(helper)) return { output: '% Invalid IP address.', newSession };
      iface.ipHelperAddress = helper;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // no switchport (on L3 switches to turn port into routed port)
    if (line === 'no switchport') {
      iface.mode = 'routed';
      onConfigChange(config);
      return { output: '', newSession };
    }

    // no switchport port-security
    if (line.startsWith('no switchport port-security')) {
      delete iface.portSecurity;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // switchport port-security
    if (cmd === 'switchport' && tokens[1] === 'port-security') {
      if (!iface.portSecurity) {
        iface.portSecurity = { enabled: true, maxMacs: 1, violation: 'shutdown', stickyMacs: [] };
      } else {
        iface.portSecurity.enabled = true;
      }
      if (tokens[2] === 'maximum') {
        const max = parseInt(tokens[3], 10);
        if (!isNaN(max)) iface.portSecurity.maxMacs = max;
      }
      if (tokens[2] === 'violation') {
        const viol = tokens[3] as any;
        if (viol === 'shutdown' || viol === 'restrict' || viol === 'protect') {
          iface.portSecurity.violation = viol;
        }
      }
      if (tokens[2] === 'mac-address' && tokens[3] === 'sticky') {
        const customMac = tokens[4];
        if (customMac) iface.portSecurity.stickyMacs.push(customMac);
      }
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip access-group <name> in|out
    if (cmd === 'ip' && tokens[1] === 'access-group') {
      const aclName = tokens[2];
      const dir = tokens[3]?.toLowerCase() === 'out' ? 'out' : 'in';
      if (dir === 'in') iface.accessGroupIn = aclName;
      else iface.accessGroupOut = aclName;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // no ip access-group
    if (cmd === 'no' && tokens[1] === 'ip' && tokens[2] === 'access-group') {
      iface.accessGroupIn = undefined;
      iface.accessGroupOut = undefined;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip nat inside / ip nat outside
    if (cmd === 'ip' && tokens[1] === 'nat') {
      if (tokens[2] === 'inside' || tokens[2] === 'outside') {
        iface.natType = tokens[2] as 'inside' | 'outside';
        if (!config.nat) config.nat = { enabled: true, insideInterfaces: [], outsideInterfaces: [], translations: [] };
        if (tokens[2] === 'inside' && !config.nat.insideInterfaces.includes(iface.name)) {
          config.nat.insideInterfaces.push(iface.name);
        } else if (tokens[2] === 'outside' && !config.nat.outsideInterfaces.includes(iface.name)) {
          config.nat.outsideInterfaces.push(iface.name);
        }
        onConfigChange(config);
        return { output: '', newSession };
      }
    }

    // switchport trunk native vlan <id>
    if (cmd === 'switchport' && tokens[1] === 'trunk' && tokens[2] === 'native' && tokens[3] === 'vlan') {
      const nvid = parseInt(tokens[4], 10);
      if (!isNaN(nvid)) {
        iface.nativeVlan = nvid;
        onConfigChange(config);
        return { output: '', newSession };
      }
    }

    // ip dhcp snooping trust
    if (cmd === 'ip' && tokens[1] === 'dhcp' && tokens[2] === 'snooping' && tokens[3] === 'trust') {
      iface.dhcpSnoopingTrust = true;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // tunnel source <ip|iface>
    if (cmd === 'tunnel' && tokens[1] === 'source') {
      const src = tokens[2];
      if (!src) return { output: '% Incomplete command. Syntax: tunnel source <ip|interface>', newSession };
      iface.tunnelSource = src;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // tunnel destination <ip>
    if (cmd === 'tunnel' && tokens[1] === 'destination') {
      const dst = tokens[2];
      if (!dst) return { output: '% Incomplete command. Syntax: tunnel destination <ip>', newSession };
      iface.tunnelDestination = dst;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // tunnel mode gre ip
    if (cmd === 'tunnel' && tokens[1] === 'mode') {
      const modeStr = tokens.slice(2).join(' ') || 'gre ip';
      iface.tunnelMode = modeStr.toUpperCase();
      onConfigChange(config);
      return { output: '', newSession };
    }

    // standby <group> ip <virtualIp>
    if (cmd === 'standby') {
      const grp = parseInt(tokens[1], 10) || 1;
      if (!iface.hsrp) {
        iface.hsrp = { group: grp, virtualIp: '', priority: 100, preempt: false, state: 'Active' };
      }
      if (tokens[2] === 'ip') {
        iface.hsrp.virtualIp = tokens[3] || '';
      } else if (tokens[2] === 'priority') {
        iface.hsrp.priority = parseInt(tokens[3], 10) || 100;
      } else if (tokens[2] === 'preempt') {
        iface.hsrp.preempt = true;
      }
      onConfigChange(config);
      return { output: '', newSession };
    }

    // vrrp <group> ip <virtualIp> | priority <val> | preempt
    if (cmd === 'vrrp') {
      const grp = parseInt(tokens[1], 10) || 1;
      if (!iface.vrrp) {
        iface.vrrp = { group: grp, virtualIp: '', priority: 100, preempt: false, state: 'Master' };
      }
      if (tokens[2] === 'ip') {
        iface.vrrp.virtualIp = tokens[3] || '';
      } else if (tokens[2] === 'priority') {
        iface.vrrp.priority = parseInt(tokens[3], 10) || 100;
      } else if (tokens[2] === 'preempt') {
        iface.vrrp.preempt = true;
      }
      onConfigChange(config);
      return { output: '', newSession };
    }

    // glbp <group> ip <virtualIp> | priority <val> | load-balancing <mode>
    if (cmd === 'glbp') {
      const grp = parseInt(tokens[1], 10) || 1;
      if (!iface.glbp) {
        iface.glbp = { group: grp, virtualIp: '', priority: 100, loadBalancing: 'round-robin', state: 'Active' };
      }
      if (tokens[2] === 'ip') {
        iface.glbp.virtualIp = tokens[3] || '';
      } else if (tokens[2] === 'priority') {
        iface.glbp.priority = parseInt(tokens[3], 10) || 100;
      } else if (tokens[2] === 'load-balancing') {
        const mode = (tokens[3] || 'round-robin').toLowerCase();
        if (mode === 'round-robin' || mode === 'host-dependent' || mode === 'weighted') {
          iface.glbp.loadBalancing = mode as any;
        }
      }
      onConfigChange(config);
      return { output: '', newSession };
    }

    // service-policy input|output <policy-name>
    if (cmd === 'service-policy') {
      const dir = tokens[1]?.toLowerCase();
      const pname = tokens[2];
      if (!dir || !pname) return { output: '% Incomplete command. Syntax: service-policy input|output <policy-map-name>', newSession };
      if (dir === 'input') iface.servicePolicyInput = pname;
      if (dir === 'output') iface.servicePolicyOutput = pname;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // lldp med location / lldp transmit / lldp receive
    if (cmd === 'lldp') {
      iface.lldpMedEnabled = true;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // channel-group <num> mode <mode>
    if (cmd === 'channel-group') {
      const cg = parseInt(tokens[1], 10);
      const mode = tokens[3] || 'active';
      if (!isNaN(cg)) {
        iface.channelGroup = cg;
        if (!config.portChannels) config.portChannels = {};
        if (!config.portChannels[cg]) {
          config.portChannels[cg] = { id: cg, protocol: 'LACP', mode, members: [] };
        }
        if (!config.portChannels[cg].members.includes(iface.name)) {
          config.portChannels[cg].members.push(iface.name);
        }
        onConfigChange(config);
        return { output: '', newSession };
      }
    }

    // nameif (ASA Firewall)
    if (cmd === 'nameif') {
      const zone = tokens[1] || 'inside';
      iface.description = `Zone: ${zone}`;
      const secLevel = zone.toLowerCase() === 'inside' ? '100' : zone.toLowerCase() === 'outside' ? '0' : '50';
      onConfigChange(config);
      return { output: `INFO: Security level for "${zone}" set to ${secLevel} by default.`, newSession };
    }

    // security-level (ASA Firewall)
    if (cmd === 'security-level') {
      const level = parseInt(tokens[1], 10) || 0;
      iface.description = `${iface.description || 'Zone'} (sec-level: ${level})`;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // description <text>
    if (cmd === 'description' || cmd === 'desc') {
      iface.description = tokens.slice(1).join(' ');
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'no' && (tokens[1] === 'description' || tokens[1] === 'desc')) {
      delete iface.description;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // speed / duplex
    if (cmd === 'speed') {
      const spd = parseInt(tokens[1], 10);
      iface.speed = isNaN(spd) ? 1000 : spd;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'duplex') {
      iface.duplex = tokens[1] as any || 'auto';
      onConfigChange(config);
      return { output: '', newSession };
    }

    // switchport voice vlan <id>
    if (cmd === 'switchport' && tokens[1] === 'voice' && tokens[2] === 'vlan') {
      const vvid = parseInt(tokens[3], 10);
      if (!isNaN(vvid)) {
        iface.voiceVlan = vvid;
        onConfigChange(config);
        return { output: '', newSession };
      }
    }

    // spanning-tree portfast / bpduguard / cost / port-priority
    if (cmd === 'spanning-tree' && tokens[1] === 'portfast') {
      iface.portfast = true;
      onConfigChange(config);
      return { output: '% Warning: portfast should only be enabled on ports connected to a single host.', newSession };
    }
    if (cmd === 'spanning-tree' && tokens[1] === 'bpduguard' && tokens[2] === 'enable') {
      iface.bpduguard = true;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'spanning-tree' && tokens[1] === 'cost') {
      const c = parseInt(tokens[2], 10);
      if (isNaN(c) || c < 1) return { output: '% Incomplete command. Syntax: spanning-tree cost <1-200000000>', newSession };
      iface.stpCost = c;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'spanning-tree' && (tokens[1] === 'port-priority' || tokens[1] === 'priority')) {
      const p = parseInt(tokens[2], 10);
      if (isNaN(p) || p < 0 || p > 240) return { output: '% Incomplete command. Syntax: spanning-tree port-priority <0-240>', newSession };
      iface.stpPortPriority = p;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'no' && tokens[1] === 'spanning-tree' && tokens[2] === 'cost') {
      delete iface.stpCost;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ipv6 address <addr> / autoconfig / link-local
    if (cmd === 'ipv6' && tokens[1] === 'address') {
      const addr = tokens[2];
      if (!addr) return { output: '% Incomplete command.', newSession };
      if (addr === 'autoconfig') {
        iface.ipv6Address = '2001:db8:acad:1::' + iface.mac.replace(/:/g, '').slice(0, 4) + '/64';
      } else if (tokens.includes('link-local')) {
        iface.ipv6LinkLocal = addr;
      } else {
        iface.ipv6Address = addr;
      }
      onConfigChange(config);
      return { output: '', newSession };
    }

    // cdp enable / no cdp enable
    if (line === 'cdp enable') {
      iface.cdpEnabled = true;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (line === 'no cdp enable') {
      iface.cdpEnabled = false;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip ospf priority / cost / area
    if (cmd === 'ip' && tokens[1] === 'ospf') {
      if (tokens[2] === 'priority') {
        iface.ospfPriority = parseInt(tokens[3], 10) || 1;
        onConfigChange(config);
        return { output: '', newSession };
      }
      if (tokens[2] === 'cost') {
        iface.ospfCost = parseInt(tokens[3], 10) || 1;
        onConfigChange(config);
        return { output: '', newSession };
      }
      if (!isNaN(parseInt(tokens[2], 10)) && tokens[3] === 'area') {
        const pid = parseInt(tokens[2], 10);
        const area = parseInt(tokens[4], 10) || 0;
        if (!config.ospf) config.ospf = { processId: pid, networks: [] };
        iface.ospfArea = area;
        onConfigChange(config);
        return { output: '', newSession };
      }
      if (tokens[2] === 'hello-interval') {
        iface.ospfHelloInterval = parseInt(tokens[3], 10) || 10;
        onConfigChange(config);
        return { output: '', newSession };
      }
      if (tokens[2] === 'dead-interval') {
        iface.ospfDeadInterval = parseInt(tokens[3], 10) || 40;
        onConfigChange(config);
        return { output: '', newSession };
      }
    }

    if (cmd === 'do' && executeCommand) {
      return executeCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange,
        allLinks
      );
    }

    return { output: `% Invalid input detected at '^' marker.`, newSession };
}
