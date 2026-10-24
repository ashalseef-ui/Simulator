import { Device, DeviceConfig, Link } from "../../../types/network";
import { isValidIp, maskToCidr } from "../../../utils/ipUtils";
import { CliSession } from "../cliTypes";
import { appendDeviceLog, normalizeInterfaceName, parseInterfaceRange, formatInvalidInputCaret } from "../cliUtils";

export function handleConfigGlobalCommand(
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
    // default interface <name>
    if (cmd === 'default' && (tokens[1] === 'interface' || tokens[1] === 'int')) {
      const ifTarget = tokens.slice(2).join('');
      if (!ifTarget) return { output: '% Incomplete command. Syntax: default interface <interface-name>', newSession };
      const resolved = normalizeInterfaceName(ifTarget, config.interfaces);
      if (!resolved || !config.interfaces[resolved]) {
        return { output: `% Interface "${ifTarget}" not found.`, newSession };
      }
      const existing = config.interfaces[resolved];
      config.interfaces[resolved] = {
        name: resolved,
        mac: existing.mac,
        status: 'up',
        speed: 1000,
        mode: 'access',
        accessVlan: 1,
      };
      onConfigChange(config);
      appendDeviceLog(config, `%SYS-5-CONFIG_I: Interface ${resolved} set to default configuration`);
      return { output: `Interface ${resolved} set to default configuration`, newSession };
    }

    if (cmd === 'hostname' || cmd === 'host') {
      const newHost = tokens[1];
      if (!newHost) return { output: '% Incomplete command.', newSession };
      config.hostname = newHost;
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'interface' || cmd === 'int') {
      // Interface range handling
      if (tokens[1] === 'range' || tokens[1] === 'ran') {
        const rangeStr = tokens.slice(2).join(' ');
        if (!rangeStr) {
          return { output: '% Incomplete command. Syntax: interface range <port_list_or_range>', newSession };
        }
        const resolvedRange = parseInterfaceRange(rangeStr, config.interfaces);
        if (resolvedRange.length === 0) {
          return { output: formatInvalidInputCaret(line, line.indexOf(tokens[2] || 'range')), newSession };
        }
        newSession.currentInterface = resolvedRange[0];
        newSession.currentInterfaceRange = resolvedRange;
        newSession.mode = 'config-if';
        return { output: '', newSession };
      }

      const ifNameRaw = tokens.slice(1).join('');
      if (!ifNameRaw) return { output: '% Incomplete command.', newSession };

      const lowerRaw = ifNameRaw.toLowerCase();

      // Loopback interface creation e.g. Loopback0 or lo0
      if (lowerRaw.startsWith('loopback') || lowerRaw.startsWith('lo')) {
        const loNum = lowerRaw.replace(/^lo(opback)?/, '') || '0';
        const loName = `Loopback${loNum}`;
        if (!config.interfaces[loName]) {
          config.interfaces[loName] = {
            name: loName,
            mac: `00:1c:b1:lo:00:${loNum.padStart(2, '0')}`,
            status: 'up',
            speed: 1000,
            mode: 'routed',
          };
          onConfigChange(config);
        }
        newSession.mode = 'config-if';
        newSession.currentInterface = loName;
        return {
          output: `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${loName}, changed state to up`,
          newSession,
        };
      }

      const resolved = normalizeInterfaceName(ifNameRaw, config.interfaces);
      if (!resolved) {
        // If it's a subinterface like Gi0/0.10, create it if parent exists
        if (ifNameRaw.includes('.')) {
          config.interfaces[ifNameRaw] = {
            name: ifNameRaw,
            mac: config.interfaces[ifNameRaw.split('.')[0]]?.mac || '00:1c:b1:00:00:01',
            status: 'up',
            speed: 1000,
            mode: 'routed',
          };
          onConfigChange(config);
          newSession.mode = 'config-subif';
          newSession.currentInterface = ifNameRaw;
          return { output: '', newSession };
        }
        // If SVI like Vlan10
        if (ifNameRaw.toLowerCase().startsWith('vlan')) {
          config.interfaces[ifNameRaw] = {
            name: ifNameRaw,
            mac: '00:1c:b1:sv:00:01',
            status: 'up',
            speed: 1000,
            mode: 'routed',
          };
          onConfigChange(config);
          newSession.mode = 'config-if';
          newSession.currentInterface = ifNameRaw;
          return { output: '', newSession };
        }
        // If GRE Tunnel like Tunnel0 or Tu0
        if (ifNameRaw.toLowerCase().startsWith('tu') || ifNameRaw.toLowerCase().startsWith('tunnel')) {
          const tuNum = ifNameRaw.toLowerCase().replace(/^(tunnel|tu)/, '');
          const tuName = `Tunnel${tuNum || '0'}`;
          if (!config.interfaces[tuName]) {
            config.interfaces[tuName] = {
              name: tuName,
              mac: '00:1c:b1:tu:00:01',
              status: 'up',
              speed: 1000,
              mode: 'routed',
            };
            onConfigChange(config);
          }
          newSession.mode = 'config-if';
          newSession.currentInterface = tuName;
          return {
            output: `%LINK-5-CHANGED: Interface ${tuName}, changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol on Interface ${tuName}, changed state to up`,
            newSession,
          };
        }
        return { output: `% Invalid interface type or number.`, newSession };
      }

      newSession.currentInterface = resolved;
      newSession.mode = resolved.includes('.') ? 'config-subif' : 'config-if';
      return { output: '', newSession };
    }

    if (cmd === 'no' && tokens[1] === 'vlan') {
      const vlanId = parseInt(tokens[2], 10);
      if (vlanId === 1) {
        return { output: '% Default VLAN 1 cannot be deleted.', newSession };
      }
      if (!isNaN(vlanId) && config.vlans[vlanId]) {
        delete config.vlans[vlanId];
        onConfigChange(config);
        return { output: '', newSession };
      }
      return { output: `% VLAN ${vlanId} not found.`, newSession };
    }

    if (cmd === 'vlan') {
      const vlanId = parseInt(tokens[1], 10);
      if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
        return { output: '% Invalid VLAN ID (1-4094).', newSession };
      }
      if (!config.vlans[vlanId]) {
        config.vlans[vlanId] = { id: vlanId, name: `VLAN${vlanId.toString().padStart(4, '0')}` };
        onConfigChange(config);
      }
      newSession.mode = 'config-vlan';
      newSession.currentVlan = vlanId;
      return { output: '', newSession };
    }

    if (line.startsWith('ip routing')) {
      config.ipRoutingEnabled = true;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (line.startsWith('no ip routing')) {
      config.ipRoutingEnabled = false;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ipv6 unicast-routing
    if (line.startsWith('ipv6 unicast-routing')) {
      config.ipv6RoutingEnabled = true;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (line.startsWith('no ipv6 unicast-routing')) {
      config.ipv6RoutingEnabled = false;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ipv6 route <prefix> <next-hop>
    if (cmd === 'ipv6' && tokens[1] === 'route') {
      const pfx = tokens[2];
      const nh = tokens[3];
      if (!pfx || !nh) return { output: '% Incomplete command. Syntax: ipv6 route <prefix/length> <next-hop>', newSession };
      if (!config.ipv6Routes) config.ipv6Routes = [];
      config.ipv6Routes.push({ prefix: pfx, nextHop: nh });
      onConfigChange(config);
      return { output: '', newSession };
    }

    // no ip domain-lookup / ip domain-lookup
    if (line.startsWith('no ip domain-lookup') || line.startsWith('no ip domain lookup')) {
      config.domainLookupEnabled = false;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (line.startsWith('ip domain-lookup') || line.startsWith('ip domain lookup')) {
      config.domainLookupEnabled = true;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip domain-name / ip domain name
    if (cmd === 'ip' && (tokens[1] === 'domain-name' || (tokens[1] === 'domain' && tokens[2] === 'name'))) {
      const dname = tokens[1] === 'domain-name' ? tokens[2] : tokens[3];
      config.domainName = dname;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip name-server <ip1> [ip2]
    if (cmd === 'ip' && (tokens[1] === 'name-server' || (tokens[1] === 'name' && tokens[2] === 'server'))) {
      const nsIp = tokens[1] === 'name-server' ? tokens[2] : tokens[3];
      if (!nsIp || !isValidIp(nsIp)) return { output: '% Invalid DNS server IP address.', newSession };
      config.dnsServer = nsIp;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'no' && tokens[1] === 'ip' && (tokens[2] === 'name-server' || tokens[2] === 'name')) {
      delete config.dnsServer;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip host <hostname> <ip>
    if (cmd === 'ip' && tokens[1] === 'host') {
      const hostname = tokens[2];
      const hostIp = tokens[3];
      if (!hostname || !hostIp || !isValidIp(hostIp)) {
        return { output: '% Incomplete command. Syntax: ip host <name> <ip>', newSession };
      }
      if (!config.staticHosts) config.staticHosts = [];
      config.staticHosts = config.staticHosts.filter((h) => h.hostname.toLowerCase() !== hostname.toLowerCase());
      config.staticHosts.push({ hostname, ip: hostIp });
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (cmd === 'no' && tokens[1] === 'ip' && tokens[2] === 'host') {
      const hostname = tokens[3];
      if (!hostname) return { output: '% Incomplete command.', newSession };
      if (config.staticHosts) {
        config.staticHosts = config.staticHosts.filter((h) => h.hostname.toLowerCase() !== hostname.toLowerCase());
        onConfigChange(config);
      }
      return { output: '', newSession };
    }

    // ip ssh version 2
    if (line.startsWith('ip ssh version')) {
      const ver = parseInt(tokens[3], 10) || 2;
      config.sshVersion = ver;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // vtp mode / domain / password
    if (cmd === 'vtp') {
      if (!config.vtp) config.vtp = { mode: 'server' };
      if (tokens[1] === 'mode') {
        const mode = tokens[2] as any;
        if (['server', 'client', 'transparent', 'off'].includes(mode)) {
          config.vtp.mode = mode;
          onConfigChange(config);
          return { output: `Setting device to VTP ${mode.toUpperCase()} mode.`, newSession };
        }
      }
      if (tokens[1] === 'domain') {
        config.vtp.domain = tokens[2];
        onConfigChange(config);
        return { output: `Changing VTP domain name from NULL to ${tokens[2]}`, newSession };
      }
      if (tokens[1] === 'password') {
        config.vtp.password = tokens[2];
        onConfigChange(config);
        return { output: `Setting device VTP password to ${tokens[2]}`, newSession };
      }
    }

    // ntp server <ip>
    if (cmd === 'ntp' && tokens[1] === 'server') {
      config.ntpServer = tokens[2];
      onConfigChange(config);
      return { output: '', newSession };
    }

    // cdp run / lldp run
    if (line === 'cdp run') {
      config.cdpGlobalEnabled = true;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (line === 'no cdp run') {
      config.cdpGlobalEnabled = false;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (line === 'lldp run') {
      config.lldpGlobalEnabled = true;
      onConfigChange(config);
      return { output: '', newSession };
    }
    if (line === 'no lldp run') {
      config.lldpGlobalEnabled = false;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip route <network> <mask> <next-hop>
    if (cmd === 'ip' && tokens[1] === 'route') {
      const net = tokens[2];
      const mask = tokens[3];
      const nextHop = tokens[4];
      if (!net || !mask || !nextHop) {
        return { output: '% Incomplete command. Syntax: ip route <network> <mask> <next-hop>', newSession };
      }
      if (!isValidIp(net) || !isValidIp(mask)) {
        return { output: '% Invalid IP address or subnet mask.', newSession };
      }
      config.routes = config.routes.filter((r) => !(r.network === net && r.mask === mask));
      config.routes.push({ network: net, mask, nextHop });
      onConfigChange(config);
      return { output: '', newSession };
    }

    if (cmd === 'no' && tokens[1] === 'ip' && tokens[2] === 'route') {
      const net = tokens[3];
      const mask = tokens[4];
      if (!net || !mask) return { output: '% Incomplete command.', newSession };
      config.routes = config.routes.filter((r) => !(r.network === net && r.mask === mask));
      onConfigChange(config);
      return { output: '', newSession };
    }

    // router ospf <process-id>
    if (cmd === 'router' && tokens[1] === 'ospf') {
      const pid = parseInt(tokens[2], 10);
      if (isNaN(pid)) return { output: '% Incomplete command. Syntax: router ospf <1-65535>', newSession };
      if (!config.ospf) {
        config.ospf = { processId: pid, networks: [] };
      }
      newSession.mode = 'config-router';
      newSession.currentOspfProcess = pid;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // router bgp <asn>
    if (cmd === 'router' && tokens[1] === 'bgp') {
      const asn = parseInt(tokens[2], 10);
      if (isNaN(asn) || asn < 1 || asn > 65535) {
        return { output: '% Incomplete command. Syntax: router bgp <1-65535>', newSession };
      }
      if (!config.bgp) {
        config.bgp = { asn, neighbors: [], networks: [] };
      } else {
        config.bgp.asn = asn;
      }
      newSession.mode = 'config-router-bgp';
      newSession.currentBgpAsn = asn;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // router eigrp <as-number>
    if (cmd === 'router' && tokens[1] === 'eigrp') {
      const asNum = parseInt(tokens[2], 10);
      if (isNaN(asNum) || asNum < 1 || asNum > 65535) {
        return { output: '% Incomplete command. Syntax: router eigrp <1-65535>', newSession };
      }
      if (!config.eigrp) {
        config.eigrp = { asNumber: asNum, autoSummary: false, networks: [] };
      } else {
        config.eigrp.asNumber = asNum;
      }
      newSession.mode = 'config-router-eigrp';
      newSession.currentEigrpAs = asNum;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // router rip
    if (cmd === 'router' && tokens[1] === 'rip') {
      if (!config.rip) {
        config.rip = { version: 2, autoSummary: false, networks: [] };
      }
      newSession.mode = 'config-router-rip';
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip sla <id> / icmp-echo <ip> / ip sla schedule <id>
    if (cmd === 'ip' && tokens[1] === 'sla') {
      const slaId = parseInt(tokens[2], 10) || 1;
      if (!config.ipSla) config.ipSla = {};
      if (tokens[3] === 'schedule' || tokens[1] === 'sla' && tokens[2] === 'schedule') {
        const schedId = parseInt(tokens[3] === 'schedule' ? tokens[4] : tokens[3], 10) || slaId;
        if (config.ipSla[schedId]) config.ipSla[schedId].state = 'Active';
        onConfigChange(config);
        return { output: `% TRACK-6-STATE: IP SLA ${schedId} schedule started (state Active)`, newSession };
      }
      if (!config.ipSla[slaId]) {
        config.ipSla[slaId] = { id: slaId, targetIp: tokens[3] || '8.8.8.8', frequency: 10, state: 'Active' };
        onConfigChange(config);
      }
      return { output: '', newSession };
    }

    // track <object-id> ip sla <sla-id> reachability
    if (cmd === 'track') {
      const trackId = parseInt(tokens[1], 10) || 1;
      const slaId = parseInt(tokens[4] || tokens[3], 10) || 1;
      if (!config.trackObjects) config.trackObjects = {};
      config.trackObjects[trackId] = { id: trackId, type: 'ip sla', targetId: slaId, status: 'Up' };
      onConfigChange(config);
      return { output: `% TRACK-6-STATE: State of object ${trackId} changed to Up`, newSession };
    }

    // class-map match-any <name>
    if (cmd === 'class-map') {
      const name = tokens[2] || tokens[1] || 'VOICE-CLASS';
      if (!config.classMaps) config.classMaps = {};
      config.classMaps[name] = { name, matchType: 'dscp', matchValue: 'ef' };
      onConfigChange(config);
      return { output: '', newSession };
    }

    // policy-map <name>
    if (cmd === 'policy-map') {
      const pname = tokens[1] || 'QOS-POLICY';
      if (!config.policyMaps) config.policyMaps = {};
      if (!config.policyMaps[pname]) {
        config.policyMaps[pname] = {
          name: pname,
          classes: [{ className: 'class-default', bandwidthPercent: 50 }],
        };
      }
      onConfigChange(config);
      return { output: '', newSession };
    }

    // monitor session <id> source|destination interface <iface> (SPAN Port Mirroring)
    if (cmd === 'monitor' && tokens[1] === 'session') {
      const sessId = parseInt(tokens[2], 10) || 1;
      const type = tokens[3]; // source or destination
      const iface = tokens[5] || tokens[4];
      if (type === 'source' && iface) {
        if (!config.monitorSession) config.monitorSession = { session: sessId, sourcePort: iface, destinationPort: '' };
        else config.monitorSession.sourcePort = iface;
        onConfigChange(config);
        return { output: `SPAN Session ${sessId}: Mirroring ingress/egress traffic on ${iface}`, newSession };
      }
      if (type === 'destination' && iface) {
        if (!config.monitorSession) config.monitorSession = { session: sessId, sourcePort: '', destinationPort: iface };
        else config.monitorSession.destinationPort = iface;
        onConfigChange(config);
        return { output: `SPAN Session ${sessId}: Feeding mirrored traffic to Packet Inspector on ${iface}`, newSession };
      }
    }

    // ip dhcp pool <name>
    if (cmd === 'ip' && tokens[1] === 'dhcp' && tokens[2] === 'pool') {
      const poolName = tokens[3];
      if (!poolName) return { output: '% Incomplete command.', newSession };
      if (!config.dhcpPools) config.dhcpPools = {};
      if (!config.dhcpPools[poolName]) {
        config.dhcpPools[poolName] = {
          name: poolName,
          network: '',
          mask: '',
          defaultRouter: '',
        };
      }
      newSession.mode = 'config-dhcp';
      newSession.currentDhcpPool = poolName;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // banner motd
    if (cmd === 'banner' && tokens[1] === 'motd') {
      const msg = tokens.slice(2).join(' ').replace(/^[#^C]| [#^C]$/g, '');
      config.bannerMotd = msg || 'Authorized Access Only.';
      onConfigChange(config);
      return { output: '', newSession };
    }

    // enable secret / password
    if (cmd === 'enable' && (tokens[1] === 'secret' || tokens[1] === 'password')) {
      const pwd = tokens[2];
      if (!pwd) return { output: '% Incomplete command.', newSession };
      config.enableSecret = pwd;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // service password-encryption
    if (line.startsWith('service password-encryption')) {
      config.servicePasswordEncryption = true;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip default-gateway <ip>
    if (cmd === 'ip' && tokens[1] === 'default-gateway') {
      const gw = tokens[2];
      if (!gw || !isValidIp(gw)) return { output: '% Invalid default gateway IP.', newSession };
      config.defaultGateway = gw;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip dhcp excluded-address <low> [high]
    if (cmd === 'ip' && tokens[1] === 'dhcp' && tokens[2] === 'excluded-address') {
      const low = tokens[3];
      const high = tokens[4] || low;
      if (!low || !isValidIp(low)) return { output: '% Invalid IP address.', newSession };
      if (!config.dhcpExcludedAddresses) config.dhcpExcludedAddresses = [];
      config.dhcpExcludedAddresses.push(`${low} - ${high}`);
      onConfigChange(config);
      return { output: '', newSession };
    }

    // spanning-tree mode pvst / rapid-pvst
    if (cmd === 'spanning-tree' && tokens[1] === 'mode') {
      const mode = tokens[2];
      config.spanningTreeMode = mode;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // spanning-tree portfast default / bpduguard enable
    if (cmd === 'spanning-tree' && tokens[1] === 'portfast' && tokens[2] === 'default') {
      config.portfastDefault = true;
      onConfigChange(config);
      return { output: '% Warning: this will enable portfast on all non-trunking interfaces.', newSession };
    }
    if (cmd === 'spanning-tree' && tokens[1] === 'portfast' && tokens[2] === 'bpduguard' && tokens[3] === 'default') {
      config.bpduguardDefault = true;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // crypto key generate rsa [modulus <bits>]
    if (line.startsWith('crypto key generate rsa')) {
      const modulusIdx = tokens.indexOf('modulus');
      let bits = 2048;
      if (modulusIdx !== -1 && tokens[modulusIdx + 1]) {
        const parsedBits = parseInt(tokens[modulusIdx + 1], 10);
        if ([512, 768, 1024, 2048, 4096].includes(parsedBits)) {
          bits = parsedBits;
        }
      }
      return {
        output: 'The name for the keys will be: ' + (config.hostname || 'Router') + `\n% The key-pair has been generated. Key size: ${bits} bits.\n% SSH 2.0 has been enabled`,
        newSession,
      };
    }

    // username <name> privilege <n> secret <pwd>
    if (cmd === 'username') {
      const uname = tokens[1];
      const secIdx = tokens.indexOf('secret') !== -1 ? tokens.indexOf('secret') : tokens.indexOf('password');
      const pwd = secIdx !== -1 ? tokens[secIdx + 1] : 'cisco';
      if (!config.localUsers) config.localUsers = {};
      config.localUsers[uname] = { username: uname, password: pwd };
      onConfigChange(config);
      return { output: '', newSession };
    }

    // spanning-tree vlan <id> priority <val> / root primary / root secondary
    if (cmd === 'spanning-tree' && tokens[1] === 'vlan') {
      const vlanId = parseInt(tokens[2], 10) || 1;
      const prioIdx = tokens.indexOf('priority');
      const rootIdx = tokens.indexOf('root');

      if (!config.spanningTreeVlanPriority) config.spanningTreeVlanPriority = {};

      if (prioIdx !== -1 && tokens[prioIdx + 1]) {
        const prio = parseInt(tokens[prioIdx + 1], 10);
        if (!isNaN(prio) && prio % 4096 === 0) {
          config.spanningTreeVlanPriority[vlanId] = prio;
          if (vlanId === 1) config.spanningTreePriority = prio;
          onConfigChange(config);
          return { output: '', newSession };
        } else {
          return {
            output: '% Bridge priority must be in increments of 4096 (e.g. 0, 4096, 8192, 16384, 32768).',
            newSession,
          };
        }
      }

      if (rootIdx !== -1 && tokens[rootIdx + 1]) {
        const rootType = tokens[rootIdx + 1].toLowerCase();
        const prio = rootType === 'primary' ? 24576 : rootType === 'secondary' ? 28672 : 32768;
        config.spanningTreeVlanPriority[vlanId] = prio;
        if (vlanId === 1) config.spanningTreePriority = prio;
        onConfigChange(config);
        return { output: '', newSession };
      }
    }

    // ip access-list standard|extended <name|num>
    if (cmd === 'ip' && tokens[1] === 'access-list') {
      const aclType = tokens[2]?.toLowerCase();
      const aclId = tokens[3];
      if (!aclId) {
        return { output: '% Incomplete command. Syntax: ip access-list <standard|extended> <name|number>', newSession };
      }
      if (!config.accessLists) config.accessLists = {};
      if (!config.accessLists[aclId]) {
        config.accessLists[aclId] = {
          idOrName: aclId,
          type: aclType === 'standard' ? 'standard' : 'extended',
          rules: [],
        };
      }
      newSession.mode = aclType === 'standard' ? 'config-std-nacl' : 'config-ext-nacl';
      newSession.currentAcl = aclId;
      onConfigChange(config);
      return { output: '', newSession };
    }

    // access-list <id> permit|deny <source>
    if (cmd === 'access-list') {
      const aclId = tokens[1];
      const action = tokens[2]?.toLowerCase() === 'permit' ? 'permit' : 'deny';
      const source = tokens.slice(3).join(' ') || 'any';
      if (!config.accessLists) config.accessLists = {};
      if (!config.accessLists[aclId]) {
        config.accessLists[aclId] = {
          idOrName: aclId,
          type: parseInt(aclId, 10) > 99 ? 'extended' : 'standard',
          rules: [],
        };
      }
      config.accessLists[aclId].rules.push({
        action,
        source,
        protocol: 'ip',
        matchCount: 0,
      });
      onConfigChange(config);
      return { output: '', newSession };
    }

    // ip nat inside source ...
    if (cmd === 'ip' && tokens[1] === 'nat' && tokens[2] === 'inside' && tokens[3] === 'source') {
      if (!config.nat) config.nat = { enabled: true, insideInterfaces: [], outsideInterfaces: [], translations: [] };
      config.nat.enabled = true;
      if (tokens[4] === 'list' && tokens.includes('overload')) {
        config.nat.overloadAcl = tokens[5];
        const ifIdx = tokens.indexOf('interface');
        if (ifIdx !== -1) config.nat.overloadInterface = tokens[ifIdx + 1];
        onConfigChange(config);
        return { output: '', newSession };
      }
      if (tokens[4] === 'static') {
        const inIp = tokens[5];
        const outIp = tokens[6];
        if (inIp && outIp) {
          if (!config.nat.staticMappings) config.nat.staticMappings = [];
          config.nat.staticMappings.push({ insideIp: inIp, outsideIp: outIp });
          onConfigChange(config);
          return { output: '', newSession };
        }
      }
    }

    // ip dhcp snooping
    if (cmd === 'ip' && tokens[1] === 'dhcp' && tokens[2] === 'snooping') {
      if (!config.dhcpSnooping) config.dhcpSnooping = { enabled: true, vlans: [1], bindings: [] };
      if (tokens[3] === 'vlan') {
        const vlanId = parseInt(tokens[4], 10);
        if (!isNaN(vlanId) && !config.dhcpSnooping.vlans.includes(vlanId)) {
          config.dhcpSnooping.vlans.push(vlanId);
        }
      } else {
        config.dhcpSnooping.enabled = true;
      }
      onConfigChange(config);
      return { output: '', newSession };
    }

    // Nexus NX-OS: feature <ospf|vpc|lldp|lacp|bgp|interface-vlan>
    if (cmd === 'feature') {
      const feat = tokens[1] || 'ospf';
      return { output: `NX-OS: Feature "${feat}" has been successfully enabled.`, newSession };
    }

    // WLC Controller: wlan create / enable
    if (cmd === 'wlan') {
      if (tokens[1] === 'create') {
        const id = tokens[2] || '1';
        const ssid = tokens[3] || 'Corp-WiFi';
        return { output: `WLAN ${id} with SSID "${ssid}" created.`, newSession };
      }
      if (tokens[1] === 'enable') {
        return { output: `WLAN ${tokens[2] || '1'} enabled.`, newSession };
      }
    }

    // ASA Firewall: access-group <name> in interface <iface>
    if (cmd === 'access-group') {
      return { output: '', newSession };
    }

    // ASA Firewall: nat (inside,outside) ...
    if (line.startsWith('nat (')) {
      return { output: '', newSession };
    }

    // Switch Stacking Commands
    if (cmd === 'switch') {
      const memberId = parseInt(tokens[1], 10);
      const subAction = tokens[2]?.toLowerCase();
      if (!isNaN(memberId)) {
        if (!config.stack) {
          config.stack = {
            enabled: true,
            ringSpeed: '480 Gbps',
            ringState: 'Full',
            members: [
              {
                memberId: 1,
                role: 'Active',
                priority: 15,
                mac: Object.values(config.interfaces)[0]?.mac || '001c.b100.0001',
                model: 'WS-C3650-24TS',
                state: 'Ready',
                stackPorts: { port1: 'Ok', port2: 'Ok' },
              },
              {
                memberId: 2,
                role: 'Standby',
                priority: 14,
                mac: '001c.b100.0002',
                model: 'WS-C3650-24TS',
                state: 'Ready',
                stackPorts: { port1: 'Ok', port2: 'Ok' },
              },
            ],
          };
        }

        if (subAction === 'priority') {
          const prio = parseInt(tokens[3], 10);
          if (isNaN(prio) || prio < 1 || prio > 15) {
            return { output: '% Invalid priority. Value must be between 1 and 15.', newSession };
          }
          const mem = config.stack.members.find((m) => m.memberId === memberId);
          if (mem) {
            mem.priority = prio;
            onConfigChange(config);
            return { output: `Switch ${memberId} priority set to ${prio}. Takes effect on next election.`, newSession };
          }
          return { output: `% Stack member ${memberId} not found.`, newSession };
        }

        if (subAction === 'renumber') {
          const newId = parseInt(tokens[3], 10);
          if (isNaN(newId) || newId < 1 || newId > 9) {
            return { output: '% Invalid member number (1-9).', newSession };
          }
          const mem = config.stack.members.find((m) => m.memberId === memberId);
          if (mem) {
            mem.memberId = newId;
            onConfigChange(config);
            return { output: `Switch ${memberId} renumbered to ${newId}. Reload member to apply.`, newSession };
          }
        }

        if (subAction === 'provision') {
          const model = tokens.slice(3).join(' ') || 'WS-C3650-24TS';
          if (!config.stack.members.some((m) => m.memberId === memberId)) {
            config.stack.members.push({
              memberId,
              role: 'Member',
              priority: 1,
              mac: `001c.b100.000${memberId}`,
              model: model.toUpperCase(),
              state: 'Ready',
              stackPorts: { port1: 'Ok', port2: 'Ok' },
            });
            onConfigChange(config);
            return { output: `Provisioned switch ${memberId} (${model.toUpperCase()}) into stack.`, newSession };
          }
        }
      }
    }

    if (line.startsWith('stack-mac persistent timer')) {
      return { output: '% Stack MAC timer set to 0 (persistent indefinitely).', newSession };
    }

    if (cmd === 'line' && (tokens[1]?.startsWith('vty') || tokens[1]?.startsWith('con') || tokens[1]?.startsWith('aux'))) {
      newSession.mode = 'config-line';
      return { output: '', newSession };
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
