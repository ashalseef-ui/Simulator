import { Device, Link } from "../../types/network";
import { CliSession } from "./cliTypes";
import { generateRunningConfig, generateRoutingTableOutput } from "./cliRunningConfig";
import { getLiveMacTable, getLiveArpTable, normalizeInterfaceName } from "./cliUtils";
import { maskToCidr, getNetworkAddress } from "../../utils/ipUtils";
import { calculateStp, calculatePvst } from "../stpEngine";
import { computeOspf, formatNeighborTable } from "../ospfEngine";

export function handleShowCommands(
  tokens: string[],
  device: Device,
  allDevices: Device[],
  session: CliSession,
  allLinks: Link[] = []
): { output: string; newSession: CliSession } {
  const sub = tokens.join(' ').toLowerCase();

  // show ip interface brief
  if (sub.startsWith('ip int') || sub === 'ip interface brief') {
    let out = 'Interface              IP-Address      OK? Method Status                Protocol\n';
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      const ip = iface.ip || 'unassigned';
      const status = iface.status === 'up' ? 'up' : 'administratively down';
      const proto = iface.status === 'up' ? 'up' : 'down';
      out += `${name.padEnd(23)} ${ip.padEnd(15)} YES manual ${status.padEnd(21)} ${proto}\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show running-config
  if (sub.startsWith('run') || sub.startsWith('running-config')) {
    return { output: generateRunningConfig(device), newSession: session };
  }

  // show ip route
  if (sub.startsWith('ip ro') || sub === 'ip route') {
    const ospfRoutes = computeOspf(allDevices, allLinks, calculateStp(allDevices, allLinks, 1)).routes[device.id] || [];
    return { output: generateRoutingTableOutput(device, ospfRoutes), newSession: session };
  }

  // show vlan brief / show vlan id / show vlan summary / show vlan
  if (sub.startsWith('vlan') || sub.startsWith('vl')) {
    const vlans = device.config.vlans || { 1: { id: 1, name: 'default' } };

    if (sub.includes('id ')) {
      const vidStr = sub.split('id ')[1]?.trim();
      const vid = parseInt(vidStr, 10);
      const vlan = vlans[vid];
      if (!vlan) return { output: `% VLAN ${vid} not found in current VLAN database.`, newSession: session };
      const assignedPorts = Object.entries(device.config.interfaces)
        .filter(([_, iface]) => iface.mode === 'access' && (iface.accessVlan || 1) === vid)
        .map(([name]) => name)
        .join(', ');
      let out = `VLAN id: ${vid}    name: ${vlan.name}    status: active\n`;
      out += `Type: Ethernet    MTU: 1500    SAID: 10000${vid}\n`;
      out += `Interfaces: ${assignedPorts || 'none'}\n`;
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('summary') || sub.includes('sum')) {
      let out = `Existing VLANs: ${Object.keys(vlans).length}\n`;
      out += `Maximum VLANs supported locally: 4094\n`;
      out += `VTP domain: ${device.config.vtp?.domain || 'NULL'} (mode: ${device.config.vtp?.mode || 'server'})\n`;
      return { output: out.trimEnd(), newSession: session };
    }

    let out = 'VLAN Name                             Status    Ports\n';
    out += '---- -------------------------------- --------- -------------------------------\n';
    for (const [idStr, vlan] of Object.entries(vlans)) {
      const vid = Number(idStr);
      const assignedPorts = Object.entries(device.config.interfaces)
        .filter(([_, iface]) => iface.mode === 'access' && (iface.accessVlan || 1) === vid)
        .map(([name]) => name)
        .join(', ');
      out += `${String(vid).padEnd(4)} ${vlan.name.padEnd(32)} active    ${assignedPorts}\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip bgp / show ip bgp summary / show ip bgp neighbors
  if (sub.includes('bgp')) {
    if (!device.config.bgp) {
      return { output: '% BGP not configured on this device.', newSession: session };
    }
    const bgp = device.config.bgp;

    if (sub.includes('summary')) {
      let out = `BGP router identifier ${bgp.routerId || Object.values(device.config.interfaces)[0]?.ip || '10.0.0.1'}, local AS number ${bgp.asn}\n`;
      out += `BGP table version is 3, main routing table version 3\n`;
      out += `${bgp.networks.length} network entries using ${bgp.networks.length * 144} bytes of memory\n`;
      out += `${bgp.neighbors.length} neighbor entries using ${bgp.neighbors.length * 820} bytes of memory\n\n`;
      out += `Neighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd\n`;
      for (const n of bgp.neighbors) {
        out += `${n.ip.padEnd(15)} 4 ${String(n.remoteAs).padEnd(5)}     42      45        3    0    0 00:18:24 ${bgp.networks.length}\n`;
      }
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('neighbor') || sub.includes('neighbours')) {
      let out = '';
      for (const n of bgp.neighbors) {
        const peerType = n.remoteAs === bgp.asn ? 'internal' : 'external';
        out += `BGP neighbor is ${n.ip},  remote AS ${n.remoteAs}, ${peerType} link\n`;
        out += `  BGP version 4, remote router ID ${n.ip}\n`;
        out += `  BGP state = ${n.state || 'Established'}, up for 00:18:24\n`;
        out += `  Last read 00:00:18, hold time is 180, keepalive interval is 60 seconds\n`;
        out += `  Neighbor capabilities:\n`;
        out += `    Route refresh: advertised and received(new)\n`;
        out += `    Address family IPv4 Unicast: advertised and received\n`;
        out += `  Message statistics:\n`;
        out += `    Inq depth: 0, Outq depth: 0\n`;
        out += `    Opens: rcvd 1, sent 1\n`;
        out += `    Notifications: rcvd 0, sent 0\n`;
        out += `    Updates: rcvd 4, sent 4\n`;
        out += `    Keepalives: rcvd 40, sent 42\n\n`;
      }
      return { output: out.trimEnd(), newSession: session };
    }

    // Default show ip bgp table
    let out = `BGP table version is 3, local router ID is ${bgp.routerId || Object.values(device.config.interfaces)[0]?.ip || '10.0.0.1'}\n`;
    out += `Status codes: s suppressed, d damped, h history, * valid, > best, i - internal,\n`;
    out += `              r RIB-failure, S Stale, m multipath, b backup-path, f RT-Filter,\n`;
    out += `              x best-external, a additional-path, c RIB-compressed,\n`;
    out += `Origin codes: i - IGP, e - EGP, ? - incomplete\n\n`;
    out += `   Network          Next Hop            Metric LocPrf Weight Path\n`;
    for (const net of bgp.networks) {
      out += `*> ${net.network.padEnd(16)} 0.0.0.0                  0         32768 i\n`;
    }
    for (const n of bgp.neighbors) {
      out += `*>i10.100.0.0/24    ${n.ip.padEnd(16)}        0    100      0 ${n.remoteAs} i\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show mac address-table
  if (sub.startsWith('mac') || sub.startsWith('mac address-table')) {
    let out = '          Mac Address Table\n-------------------------------------------\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n';
    const table = getLiveMacTable(device, allDevices, allLinks);
    if (table.length === 0) {
      out += '   1    001c.b123.4567    DYNAMIC     Fa0/1\n';
    } else {
      table.forEach((entry) => {
        out += `${String(entry.vlan).padStart(4)}    ${entry.mac}    ${entry.type.padEnd(8)}    ${entry.port}\n`;
      });
    }
    out += `Total Mac Addresses for this criterion: ${table.length || 1}`;
    return { output: out.trimEnd(), newSession: session };
  }

  // show spanning-tree (PVST+ Per-VLAN Spanning Tree)
  if (sub.startsWith('span') || sub.startsWith('spanning-tree')) {
    const pvst = calculatePvst(allDevices, allLinks);
    const vlanTokens = sub.split(/\s+/);
    const vlanIdx = vlanTokens.indexOf('vlan');
    const targetVlans: number[] = [];

    if (vlanIdx !== -1 && vlanTokens[vlanIdx + 1]) {
      const v = parseInt(vlanTokens[vlanIdx + 1], 10);
      if (!isNaN(v)) targetVlans.push(v);
    }

    if (targetVlans.length === 0) {
      const vlSet = new Set<number>([1]);
      if (device.config.spanningTreeVlanPriority) {
        Object.keys(device.config.spanningTreeVlanPriority).forEach((k) => vlSet.add(parseInt(k, 10)));
      }
      if (device.config.vlans) {
        Object.values(device.config.vlans).forEach((vl) => vlSet.add(vl.id));
      }
      Object.values(device.config.interfaces).forEach((i) => {
        if (i.accessVlan) vlSet.add(i.accessVlan);
        if (i.trunkAllowedVlans) i.trunkAllowedVlans.forEach((v) => vlSet.add(v));
      });
      targetVlans.push(...Array.from(vlSet).sort((a, b) => a - b));
    }

    let out = '';
    for (const vlanId of targetVlans) {
      const stp = pvst.vlans?.[vlanId] || calculateStp(allDevices, allLinks, vlanId);
      const basePrio = device.config.spanningTreeVlanPriority?.[vlanId] ?? device.config.spanningTreePriority ?? 32768;
      const isRoot = stp.rootBridgeId === device.id;
      const vlanPad = String(vlanId).padStart(4, '0');

      out += `VLAN${vlanPad}\n  Spanning tree enabled protocol ieee\n`;
      out += `  Root ID    Priority    ${stp.rootBridgePriority}\n             Address     ${stp.rootBridgeMac}\n`;
      if (isRoot) {
        out += `             This bridge is the root\n`;
      }
      out += `  Bridge ID  Priority    ${basePrio + vlanId}  (priority ${basePrio} sys-id-ext ${vlanId})\n             Address     ${Object.values(device.config.interfaces)[0]?.mac || '001c.b100.0001'}\n\n`;
      out += `Interface           Role Sts Cost      Prio.Nbr Type\n------------------- ---- --- --------- -------- --------------------------------\n`;

      for (const [name, iface] of Object.entries(device.config.interfaces)) {
        if (iface.status === 'up') {
          if (iface.mode === 'trunk' && iface.trunkAllowedVlans && iface.trunkAllowedVlans.length > 0 && !iface.trunkAllowedVlans.includes(vlanId)) {
            continue;
          }
          if (iface.mode === 'access' && (iface.accessVlan || 1) !== vlanId) {
            continue;
          }

          const key = `${device.id}:${name}`;
          const pInfo = stp.ports[key];
          const role = pInfo?.role || (isRoot ? 'DESG' : 'DESG');
          const state = pInfo?.state || 'FWD';
          const cost = pInfo?.cost || (iface.speed === 1000 ? 4 : 19);
          const typeStr = pInfo?.edge ? 'P2p Edge' : 'P2p';
          out += `${name.padEnd(19)} ${role.padEnd(4)} ${state.padEnd(3)} ${String(cost).padEnd(9)} 128.1    ${typeStr}\n`;
        }
      }
      out += '\n';
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show interfaces tunnel
  if (sub.includes('tunnel') || sub.startsWith('int tu')) {
    let out = '';
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      if (name.toLowerCase().startsWith('tu') || name.toLowerCase().startsWith('tunnel')) {
        out += `${name} is up, line protocol is up\n`;
        out += `  Hardware is Tunnel\n`;
        out += `  Internet address is ${iface.ip || 'unassigned'}/${iface.mask || '24'}\n`;
        out += `  MTU 1792 bytes, BW 9 Kbit/sec, DLY 500000 usec,\n`;
        out += `  Tunnel source ${iface.tunnelSource || 'unassigned'}, destination ${iface.tunnelDestination || 'unassigned'}\n`;
        out += `  Tunnel protocol/transport ${iface.tunnelMode || 'GRE/IP'}\n`;
        out += `    Key disabled, sequencing disabled\n`;
        out += `    Checksum processing disabled\n`;
        out += `  Tunnel TTL 255, Fast tunneling enabled\n\n`;
      }
    }
    if (!out) out = '% No Tunnel interfaces configured.\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show arp / show ip arp
  if (sub === 'arp' || sub === 'ip arp') {
    let out = 'Protocol  Address          Age (min)  Hardware Addr   Type   Interface\n';
    const entries = getLiveArpTable(device, allDevices, allLinks);
    if (entries.length === 0) {
      out += 'Internet  10.0.0.1                -   001c.b100.0001  ARPA   GigabitEthernet0/0\n';
    } else {
      for (const entry of entries) {
        out += `Internet  ${entry.ip.padEnd(16)} -          ${entry.mac}   ARPA   ${entry.port}\n`;
      }
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show hosts / show ip hosts / show ip dns
  if (sub === 'hosts' || sub === 'show hosts' || sub.includes('hosts') || sub.includes('ip dns')) {
    const domainName = device.config.domainName || 'localdomain';
    const dnsServer = device.config.dnsServer || 'none';
    const isLookup = device.config.domainLookupEnabled !== false ? 'enabled' : 'disabled';
    
    let out = `Default domain is ${domainName}\n`;
    out += `Domain name lookup is ${isLookup}\n`;
    out += `Global Name Servers: ${dnsServer}\n\n`;
    out += `Host               Port  Flags      Age Type   Address(es)\n`;
    out += `------------------ ----- ---------- --- ------ --------------------\n`;
    
    if (device.config.staticHosts && device.config.staticHosts.length > 0) {
      for (const h of device.config.staticHosts) {
        out += `${h.hostname.padEnd(18)} none  (perm, OK)  0   IP     ${h.ip}\n`;
      }
    } else {
      out += `(no static host entries configured)\n`;
    }
    
    // Also display DNS Server records if any active Server device exists in topology
    for (const d of allDevices) {
      if (d.type === 'server' && d.config.services?.dns?.enabled && d.config.services.dns.records.length > 0) {
        out += `\nDNS Server (${d.config.hostname || d.name}) Records:\n`;
        for (const rec of d.config.services.dns.records) {
          out += `  ${rec.domain.padEnd(20)} A       ${rec.ip}\n`;
        }
      }
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show cdp neighbors & detail
  if (sub.startsWith('cdp nei') || sub === 'cdp neighbors') {
    const isDetail = sub.includes('detail');
    const neighbors = allDevices.filter((d) => d.id !== device.id);
    if (isDetail) {
      let out = '-------------------------\n';
      neighbors.slice(0, 3).forEach((n) => {
        const nIface = Object.values(n.config.interfaces)[0];
        out += `Device ID: ${n.config.hostname || n.name}\n`;
        out += `Entry address(es): \n  IP address: ${nIface?.ip || '10.0.0.1'}\n`;
        out += `Platform: Emulated ${n.type === 'switch' ? 'WS-C2960-24TT' : '2911-ISR'},  Capabilities: ${n.type === 'switch' ? 'Switch IGMP' : 'Router'}\n`;
        out += `Interface: Gig0/1,  Port ID (outgoing port): FastEthernet0/1\n`;
        out += `Holdtime : 142 sec\n\nVersion :\nWireCraft IOS-Compatible Engine, Version 15.4(3)M2, RELEASE SIMULATION (fc2)\n-------------------------\n`;
      });
      return { output: out.trimEnd(), newSession: session };
    }
    let out = 'Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge\n';
    out += '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone\n\n';
    out += 'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\n';
    neighbors.slice(0, 4).forEach((n, idx) => {
      const devName = (n.config.hostname || n.name).padEnd(16);
      const locInt = `Gig 0/${idx}`.padEnd(17);
      const hold = '154'.padEnd(10);
      const cap = (n.type === 'switch' ? 'S' : 'R').padEnd(11);
      const plat = (n.type === 'switch' ? '2960' : '2911').padEnd(10);
      const portId = `Gig 0/${idx}`;
      out += `${devName} ${locInt} ${hold} ${cap} ${plat} ${portId}\n`;
    });
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip protocols
  if (sub.startsWith('ip proto') || sub === 'ip protocols') {
    if (!device.config.ospf) {
      return { output: '*** IP Routing is enabled, but no dynamic routing protocol configured ***', newSession: session };
    }
    const pid = device.config.ospf.processId;
    let out = `*** IP Routing is enabled ***\n\nRouting Protocol is "ospf ${pid}"\n`;
    out += `  Outgoing update filter list for all interfaces is not set\n`;
    out += `  Incoming update filter list for all interfaces is not set\n`;
    out += `  Router ID 192.168.1.1\n`;
    out += `  Number of areas in this router is ${device.config.ospf.networks.length}. 1 normal\n`;
    out += `  Maximum path: 4\n  Routing for Networks:\n`;
    device.config.ospf.networks.forEach((n) => {
      out += `    ${n.network} ${n.wildcard} area ${n.area}\n`;
    });
    out += `  Routing Information Sources:\n    Gateway         Distance      Last Update\n    10.0.0.2             110      00:03:42\n`;
    out += `  Distance: (default is 110)\n`;
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip ospf neighbor / interface (computed from real adjacency state)
  if (sub.startsWith('ip ospf nei') || sub.startsWith('ip ospf int')) {
    if (!device.config.ospf) return { output: '', newSession: session };
    const ospf = computeOspf(allDevices, allLinks, calculateStp(allDevices, allLinks, 1));
    if (sub.startsWith('ip ospf nei')) {
      const list = ospf.neighbors[device.id] || [];
      return { output: list.length ? formatNeighborTable(list) : '', newSession: session };
    }
    const infos = ospf.interfaces[device.id] || [];
    let out = '';
    for (const i of infos) {
      const cidr = maskToCidr(i.mask);
      out += `${i.name} is ${i.state === 'DOWN' ? 'down' : 'up'}, line protocol is ${i.state === 'DOWN' ? 'down' : 'up'}\n`;
      out += `  Internet Address ${i.ip}/${cidr}, Area ${i.area}\n`;
      out += `  Process ID ${device.config.ospf.processId}, Router ID ${ospf.routerIds[device.id]}, Network Type ${i.state === 'LOOPBACK' ? 'LOOPBACK' : 'BROADCAST'}, Cost: ${i.cost}\n`;
      if (i.passive) {
        out += `  No Hellos (Passive interface)\n`;
      } else if (i.state !== 'LOOPBACK') {
        out += `  Transmit Delay is 1 sec, State ${i.state}, Priority ${i.priority}\n`;
        if (i.drId) out += `  Designated Router (ID) ${i.drId}\n`;
        if (i.bdrId) out += `  Backup Designated Router (ID) ${i.bdrId}\n`;
        out += `  Timer intervals configured, Hello ${i.hello}, Dead ${i.dead}, Wait ${i.dead}, Retransmit 5\n`;
        out += `  Neighbor Count is ${i.neighborCount}, Adjacent neighbor count is ${i.neighborCount}\n`;
      }
      out += '\n';
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip eigrp neighbors
  if (sub.startsWith('ip eigrp nei') || sub === 'ip eigrp neighbors') {
    const asNum = device.config.eigrp?.asNumber || 100;
    let out = `EIGRP-IPv4 Neighbors for AS(${asNum})\n`;
    out += `H   Address                 Interface              Hold Uptime   SRTT   RTO  Q   Seq\n`;
    out += `                                                   (sec)         (ms)       Cnt  Num\n`;
    const eigrpPeers = allDevices.filter((d) => d.id !== device.id && d.config.eigrp?.asNumber === asNum);
    eigrpPeers.forEach((p, idx) => {
      const peerIface = Object.values(p.config.interfaces)[0];
      const localIface = Object.keys(device.config.interfaces)[0] || 'Gi0/0';
      if (peerIface?.ip) {
        out += `${idx}   ${peerIface.ip.padEnd(23)} ${localIface.padEnd(22)} 14   00:08:42   12   200  0   ${idx + 1}\n`;
      }
    });
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip eigrp topology
  if (sub.startsWith('ip eigrp top') || sub === 'ip eigrp topology') {
    const asNum = device.config.eigrp?.asNumber || 100;
    const rId = device.config.eigrp?.routerId || Object.values(device.config.interfaces)[0]?.ip || '10.0.0.1';
    let out = `IP-EIGRP Topology Table for AS(${asNum})/ID(${rId})\n`;
    out += `Codes: P - Passive, A - Active, U - Update, Q - Query, R - Reply, r - reply Status, s - sia Status\n\n`;
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      if (iface.ip && iface.mask && iface.status === 'up') {
        out += `P ${getNetworkAddress(iface.ip, iface.mask)}/${maskToCidr(iface.mask)}, 1 successors, FD is 281600\n`;
        out += `        via Connected, ${name}\n`;
      }
    }
    for (const net of device.config.eigrp?.networks || []) {
      out += `P ${net.network}/24, 1 successors, FD is 307200\n`;
      out += `        via 10.0.0.2 (307200/28160), GigabitEthernet0/1\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show bgp l2vpn evpn
  if (sub.includes('evpn') || sub.startsWith('bgp l2vpn evpn')) {
    const asn = device.config.bgp?.asn || 65001;
    const rid = device.config.bgp?.routerId || Object.values(device.config.interfaces)[0]?.ip || '10.255.255.1';
    let out = `BGP table version is 8, local router ID is ${rid}\n`;
    out += `Status codes: s suppressed, d damped, h history, * valid, > best, i - internal\n`;
    out += `Origin codes: i - IGP, e - EGP, ? - incomplete\n`;
    out += `EVPN Route Types: [2] MAC/IP Advertisement, [3] Inclusive Multicast Ethernet Tag\n\n`;
    out += `   Route Distinguisher: ${asn}:10010 (default-vni 10010)\n`;
    out += `*> [2]:[0]:[48]:[0050.56aa.0001]:[32]:[192.168.10.15]/216\n`;
    out += `                    10.255.255.2             100      0 65002 i\n`;
    out += `*> [3]:[0]:[32]:[10.255.255.2]/80\n`;
    out += `                    10.255.255.2             100      0 65002 i\n`;
    return { output: out.trimEnd(), newSession: session };
  }

  // show mpls interfaces / show mpls ldp neighbor / show mpls forwarding-table
  if (sub.startsWith('mpls')) {
    if (sub.includes('int')) {
      let out = 'Interface              IP            Tunnel   Operational\n';
      for (const [name, iface] of Object.entries(device.config.interfaces)) {
        if (iface.mplsEnabled || device.config.mpls?.enabled) {
          out += `${name.padEnd(22)} Yes (LDP)     No       Yes\n`;
        }
      }
      if (!out.includes('Yes')) out += '(no MPLS enabled interfaces configured)';
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('neighbor') || sub.includes('ldp nei')) {
      let out = `    Peer LDP Ident: 10.255.0.2:0; Local LDP Ident ${device.config.mpls?.routerId || '10.255.0.1'}:0\n`;
      out += `        TCP connection: 10.0.0.2.646 - 10.0.0.1.34112\n`;
      out += `        State: Oper; Msgs sent/rcvd: 48/48; Downstream-on-demand\n`;
      out += `        Up time: 01:24:18\n`;
      out += `        LDP Discovery Sources:\n`;
      out += `          GigabitEthernet0/0, Src IP addr: 10.0.0.2\n`;
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('forward') || sub.includes('forw') || sub.includes('lfib')) {
      let out = 'Local  Outgoing    Prefix            Bytes Label   Outgoing   Next Hop\n';
      out += 'Tag    Tag or VC   or Tunnel Id      Switched      interface\n';
      out += '-----------------------------------------------------------------------\n';
      if (device.config.mpls?.lfib && device.config.mpls.lfib.length > 0) {
        for (const entry of device.config.mpls.lfib) {
          out += `${String(entry.inLabel).padEnd(6)} ${String(entry.outLabel).padEnd(11)} ${entry.prefix.padEnd(17)} 12400         ${entry.outInterface.padEnd(10)} ${entry.nextHop}\n`;
        }
      } else {
        out += '1000   Pop Tag     192.168.10.0/24   12400         Gi0/0      10.0.0.2\n';
        out += '1001   1004        192.168.20.0/24   85200         Gi0/1      10.0.1.2\n';
      }
      return { output: out.trimEnd(), newSession: session };
    }
  }

  // show crypto isakmp sa / show crypto ipsec sa / show crypto session
  if (sub.startsWith('crypto')) {
    if (sub.includes('isakmp')) {
      let out = 'IPv4 Crypto ISAKMP SA\n';
      out += 'dst             src             state          conn-id status\n';
      out += '198.51.100.2    198.51.100.1    QM_IDLE           1001 ACTIVE\n';
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('ipsec') || sub.includes('session')) {
      let out = 'Crypto session current status\n';
      out += 'Interface: GigabitEthernet0/0\n';
      out += 'Session status: UP-ACTIVE\n';
      out += 'Peer: 198.51.100.2 port 500\n';
      out += '  IKEv1 SA: local 198.51.100.1/500 remote 198.51.100.2/500 Active\n';
      out += '  IPSEC FLOW: permit ip 192.168.10.0/255.255.255.0 192.168.20.0/255.255.255.0\n';
      out += '    Active SAs: 2, origin: crypto map (SPI Inbound: 0x3bf7a01c, Outbound: 0x7c91e02f)\n';
      out += '    Encrypted: 48 packets, Decrypted: 48 packets, Digest errors: 0\n';
      return { output: out.trimEnd(), newSession: session };
    }
  }

  // show vxlan / show nve interface / show nve peers
  if (sub.startsWith('vxlan') || sub.startsWith('nve') || sub.startsWith('show vxlan')) {
    const srcIf = device.config.vxlan?.sourceInterface || 'Loopback0';
    const vtepIp = device.config.interfaces?.[srcIf]?.ip || '10.255.255.1';
    let out = `Interface: nve1, State: Admin-Up, Oper-Up\n`;
    out += `  Encapsulation: VXLAN (UDP port 4789)\n`;
    out += `  BGP EVPN control plane: Enabled\n`;
    out += `  Source Interface: ${srcIf} (VTEP IP: ${vtepIp})\n\n`;
    out += `VNI        VLAN  Multicast-Group  State\n`;
    out += `---------------------------------------\n`;
    for (const [vniStr, info] of Object.entries(device.config.vxlan?.vniMembers || { 10010: { vni: 10010, vlan: 10 } })) {
      out += `${String(vniStr).padEnd(10)} ${String(info.vlan).padEnd(5)} Unicast (BGP)    Up\n`;
    }
    out += `\nRemote VTEPs:\n`;
    out += `Peer VTEP IP    VNI     State\n`;
    out += `-----------------------------\n`;
    for (const p of device.config.vxlan?.vtepPeers || [{ ip: '10.255.255.2', vni: 10010, state: 'Up' }]) {
      out += `${p.ip.padEnd(15)} ${String(p.vni).padEnd(7)} ${p.state}\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show segment-routing srv6 locator / sid
  if (sub.includes('srv6') || sub.startsWith('segment-routing')) {
    let out = 'SRv6 Locators:\n';
    out += 'Name          Prefix                    Length  Status\n';
    out += '----------------------------------------------------------\n';
    const loc = device.config.srv6?.locator || { name: 'MAIN-LOC', prefix: '2001:db8:c001::', length: 48 };
    out += `${loc.name.padEnd(13)} ${loc.prefix.padEnd(25)} ${String(loc.length).padEnd(7)} Operational\n\n`;
    out += 'SRv6 Active SIDs:\n';
    out += 'SID                                     Behavior    Context\n';
    out += '------------------------------------------------------------------------\n';
    out += '2001:db8:c001:1::                       End         Local Transit\n';
    out += '2001:db8:c001:2::                       End.X       GigabitEthernet0/1\n';
    out += '2001:db8:c001:100::                     End.DT4     VRF default IPv4 table\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show isis neighbors / show isis database / show ip route isis
  if (sub.startsWith('isis')) {
    if (sub.includes('nei')) {
      let out = 'IS-IS Neighbor Table\n';
      out += 'System Id       Type Interface   IP Address      State Holdtime Circuit Id\n';
      out += '---------------------------------------------------------------------------\n';
      if (device.config.isis?.neighbors && device.config.isis.neighbors.length > 0) {
        for (const n of device.config.isis.neighbors) {
          out += `${n.systemId.padEnd(15)} ${n.level.padEnd(4)} ${(n.localInterface || n.interface || 'Gi0/1').padEnd(11)} 10.1.1.2        ${n.state.padEnd(5)} ${String(n.holdtime).padEnd(8)} 01\n`;
        }
      } else {
        out += 'R2-CORE         L2   Gi0/1       10.1.1.2        Up    27       01\n';
        out += 'R3-AGG          L1   Gi0/2       10.1.2.2        Up    28       02\n';
      }
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('database') || sub.includes('db')) {
      let out = 'IS-IS Level-1 Link State Database:\n';
      out += 'LSPID                 LSP Seq Num  LSP Checksum  LSP Holdtime  ATT/P/OL\n';
      out += 'R1.00-00            * 0x00000004   0x7A2B        1198          0/0/0\n';
      out += 'R2.00-00              0x00000003   0x8B3C        1195          0/0/0\n\n';
      out += 'IS-IS Level-2 Link State Database:\n';
      out += 'LSPID                 LSP Seq Num  LSP Checksum  LSP Holdtime  ATT/P/OL\n';
      out += 'R1.00-00            * 0x00000005   0x1F4A        1199          0/0/0\n';
      out += 'R2.00-00              0x00000004   0x9C1D        1196          0/0/0\n';
      return { output: out.trimEnd(), newSession: session };
    }
  }

  // show wlan summary / show ap summary / show client summary
  if (sub.startsWith('wlan') || sub.startsWith('ap') || sub.startsWith('client')) {
    if (sub.includes('wlan')) {
      let out = 'Number of WLANs: 2\n';
      out += 'WLAN ID  WLAN Profile Name              SSID                             Status\n';
      out += '-------  ------------------------------ -------------------------------- --------\n';
      out += '1        Corp-Secure                    Enterprise-Secure-WiFi           Enabled\n';
      out += '2        IoT-Campus                     Campus-IoT-Telemetry             Enabled\n';
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('ap')) {
      let out = 'AP Name             Slots  AP Model             Ethernet MAC      Status\n';
      out += '------------------  -----  -------------------  ----------------  -----------\n';
      out += 'AP-3702-Bldg1-Fl1   2      AIR-AP3702I-A-K9     0050.7966.6800    Registered (RUN)\n';
      out += 'AP-3702-Bldg1-Fl2   2      AIR-AP3702I-A-K9     0050.7966.6820    Registered (RUN)\n';
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('client')) {
      let out = 'Client Summary:\n';
      out += 'MAC Address       AP Name               WLAN  Protocol   RSSI    State\n';
      out += '----------------  --------------------  ----  ---------  ------  -----------\n';
      out += '0050.7966.6801    AP-3702-Bldg1-Fl1     1     802.11ax   -54dBm  Associated\n';
      out += '0050.7966.6802    AP-3702-Bldg1-Fl1     2     802.11ac   -62dBm  Associated\n';
      return { output: out.trimEnd(), newSession: session };
    }
  }

  // show iot telemetry / show iot devices
  if (sub.startsWith('iot') || sub.includes('telemetry')) {
    let out = 'IoT Subsystem Status: Online\n';
    out += 'MQTT Broker: 192.168.1.50 (Port 1883)\n';
    out += 'Active Sensor Endpoints: 3\n\n';
    out += 'Device Name         Type            Status      Last Telemetry Value\n';
    out += '------------------  --------------  ----------  ---------------------------------------------\n';
    out += 'IoT-Sensor-Lab1     Environmental   Publishing  Temp: 23.4°C, Humidity: 46%, Motion: False\n';
    out += 'IoT-Sensor-HVAC     Thermostat      Publishing  Temp: 21.8°C, Humidity: 50%, Alert: Normal\n';
    out += 'IoT-Smart-Gateway   Edge Gateway    Online      Broker Active, 48 messages/min, 0 packet loss\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show access-lists
  if (sub.startsWith('access-list') || sub.startsWith('ip access-list')) {
    if (!device.config.accessLists || Object.keys(device.config.accessLists).length === 0) {
      return { output: '% No access-lists configured.', newSession: session };
    }
    let out = '';
    for (const [id, acl] of Object.entries(device.config.accessLists)) {
      const typeLabel = acl.type === 'extended' ? 'Extended IP access list' : 'Standard IP access list';
      out += `${typeLabel} ${id}\n`;
      acl.rules.forEach((r, idx) => {
        const lineNum = (idx + 1) * 10;
        const hits = r.matchCount || 0;
        const hitStr = hits === 1 ? '1 match' : `${hits} matches`;
        if (acl.type === 'extended') {
          const proto = r.protocol || 'ip';
          const dst = r.destination ? ` ${r.destination}` : '';
          const port = r.port ? ` eq ${r.port}` : '';
          out += `    ${lineNum} ${r.action} ${proto} ${r.source}${dst}${port} (${hitStr})\n`;
        } else {
          out += `    ${lineNum} ${r.action} ${r.source} (${hitStr})\n`;
        }
      });
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip nat translations / statistics
  if (sub.startsWith('ip nat trans') || sub === 'ip nat translations') {
    if (!device.config.nat?.enabled && !device.config.nat?.translations?.length && !device.config.nat?.staticMappings?.length) {
      return { output: '% NAT is not enabled or no active translations.', newSession: session };
    }
    let out = 'Pro Inside global      Inside local       Outside local      Outside global\n';
    let count = 0;
    if (device.config.nat.staticMappings) {
      for (const m of device.config.nat.staticMappings) {
        out += `--- ${m.outsideIp.padEnd(18)} ${m.insideIp.padEnd(18)} ---                ---\n`;
        count++;
      }
    }
    if (device.config.nat.translations && device.config.nat.translations.length > 0) {
      for (const t of device.config.nat.translations) {
        out += `${t.protocol.padEnd(3)} ${t.insideGlobal.padEnd(18)} ${t.insideLocal.padEnd(18)} ${t.outsideLocal.padEnd(18)} ${t.outsideGlobal}\n`;
        count++;
      }
    } else {
      // If PAT configured with overload, show active NAT session
      const outsideIface = Object.values(device.config.interfaces).find((i) => i.natType === 'outside' && i.ip) || Object.values(device.config.interfaces)[0];
      const pubIp = outsideIface?.ip || '203.0.113.1';
      out += `icmp ${pubIp}:1        192.168.1.10:1     8.8.8.8:1          8.8.8.8:1\n`;
      out += `tcp  ${pubIp}:49152    192.168.1.10:49152 1.1.1.1:443       1.1.1.1:443\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }

  if (sub.startsWith('ip nat stat') || sub === 'ip nat statistics') {
    const nat = device.config.nat;
    let out = 'Total active translations: 2 (0 static, 2 dynamic; 2 extended)\n';
    out += `Outside interfaces:\n  ${nat?.outsideInterfaces?.join(', ') || 'GigabitEthernet0/0'}\n`;
    out += `Inside interfaces:\n  ${nat?.insideInterfaces?.join(', ') || 'GigabitEthernet0/1'}\n`;
    out += 'Hits: 124  Misses: 2\n';
    out += 'CEF Translated packets: 124, CEF Punted packets: 0\n';
    out += 'Expired translations: 14\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip dhcp binding
  if (sub.startsWith('ip dhcp bind') || sub === 'ip dhcp binding') {
    let out = 'Bindings from all pools :\nIP address          Client-ID/              Lease expiration        Type\n                    Hardware address/User name\n';
    let hasLeases = false;
    if (device.config.dhcpPools) {
      for (const pool of Object.values(device.config.dhcpPools)) {
        if (pool.leasedIps && Object.keys(pool.leasedIps).length > 0) {
          for (const [ip, mac] of Object.entries(pool.leasedIps)) {
            hasLeases = true;
            const formattedMac = mac.replace(/[:-]/g, '').match(/.{1,4}/g)?.join('.') || mac;
            out += `${ip.padEnd(19)} 01${formattedMac.padEnd(20)} Oct 15 2026 12:00 AM    Automatic\n`;
          }
        }
      }
    }
    // Also discover clients that received DHCP in network topology
    if (!hasLeases) {
      for (const d of allDevices) {
        if (d.id !== device.id && (d.type === 'pc' || d.type === 'laptop')) {
          const clientIface = Object.values(d.config.interfaces)[0];
          if (clientIface && clientIface.ip && (d.config.isDhcpClient || clientIface.ip.startsWith('192.168.'))) {
            hasLeases = true;
            const cMac = clientIface.mac.replace(/[:-]/g, '').match(/.{1,4}/g)?.join('.') || clientIface.mac;
            out += `${clientIface.ip.padEnd(19)} 01${cMac.padEnd(20)} Oct 15 2026 12:00 AM    Automatic\n`;
          }
        }
      }
    }
    if (!hasLeases) {
      out += '192.168.1.101       0100.1cb1.4402.1a       Oct 15 2026 12:00 AM    Automatic\n';
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip dhcp snooping
  if (sub.startsWith('ip dhcp snoop') || sub === 'ip dhcp snooping') {
    let out = `Switch DHCP snooping is ${device.config.dhcpSnooping?.enabled ? 'enabled' : 'disabled'}\n`;
    out += `DHCP snooping is configured on following VLANs:\n${device.config.dhcpSnooping?.vlans?.join(', ') || '1'}\n`;
    out += `Interface                  Trusted    Rate limit (pps)\n-----------------------    -------    ----------------\n`;
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      out += `${name.padEnd(26)} ${(iface.dhcpSnoopingTrust ? 'yes' : 'no').padEnd(10)} untrusted\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show interfaces switchport
  if (sub.includes('switchport')) {
    let out = '';
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      out += `Name: ${name}\n`;
      out += `Switchport: Enabled\n`;
      out += `Administrative Mode: ${iface.mode || 'static access'}\n`;
      out += `Operational Mode: ${iface.mode || 'static access'}\n`;
      out += `Administrative Trunking Encapsulation: dot1q\n`;
      out += `Access Mode VLAN: ${iface.accessVlan || 1} (default)\n`;
      out += `Trunking Native Mode VLAN: ${iface.nativeVlan || 1} (default)\n`;
      out += `Voice VLAN: ${iface.voiceVlan ? iface.voiceVlan : 'none'}\n`;
      out += `Administrative Private VLAN Port Settings: none\n\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show interfaces status / show interfaces description / show interfaces trunk / show interfaces
  if (sub.startsWith('int') || sub.startsWith('interfaces') || sub.startsWith('interface')) {
    if (sub.includes('status')) {
      let out = 'Port      Name               Status       Vlan       Duplex  Speed Type\n';
      for (const [name, iface] of Object.entries(device.config.interfaces)) {
        const status = iface.status === 'up' ? 'connected' : 'disabled';
        const vlan = iface.mode === 'trunk' ? 'trunk' : iface.accessVlan?.toString() || '1';
        const spd = iface.speed === 1000 ? '1000' : '100';
        out += `${name.padEnd(9)} ${(iface.description || '--').padEnd(18)} ${status.padEnd(12)} ${vlan.padEnd(10)} full    ${spd.padEnd(5)} 1000BaseTX\n`;
      }
      return { output: out.trimEnd(), newSession: session };
    }
    if (sub.includes('desc') || sub.includes('description')) {
      let out = 'Interface                      Status         Protocol Description\n';
      for (const [name, iface] of Object.entries(device.config.interfaces)) {
        const status = iface.status === 'up' ? 'up' : 'admin down';
        const proto = iface.status === 'up' ? 'up' : 'down';
        out += `${name.padEnd(30)} ${status.padEnd(14)} ${proto.padEnd(8)} ${iface.description || '--'}\n`;
      }
      return { output: out.trimEnd(), newSession: session };
    }
    if (sub.includes('trunk')) {
      let out = 'Port        Mode         Encapsulation  Status        Native vlan\n';
      let hasTrunk = false;
      for (const [name, iface] of Object.entries(device.config.interfaces)) {
        if (iface.mode === 'trunk') {
          hasTrunk = true;
          out += `${name.padEnd(11)} on           802.1q         trunking      ${iface.nativeVlan || 1}\n`;
        }
      }
      if (!hasTrunk) return { output: '% No interface is currently configured in trunk mode.', newSession: session };

      out += '\nPort        Vlans allowed on trunk\n';
      for (const [name, iface] of Object.entries(device.config.interfaces)) {
        if (iface.mode === 'trunk') {
          const allowedStr = iface.trunkAllowedVlans && iface.trunkAllowedVlans.length > 0
            ? iface.trunkAllowedVlans.join(',')
            : '1-4094';
          out += `${name.padEnd(11)} ${allowedStr}\n`;
        }
      }

      out += '\nPort        Vlans allowed and active in management domain\n';
      for (const [name, iface] of Object.entries(device.config.interfaces)) {
        if (iface.mode === 'trunk') {
          const activeVlans = Object.keys(device.config.vlans || { 1: 1 }).map(Number);
          const allowed = iface.trunkAllowedVlans && iface.trunkAllowedVlans.length > 0
            ? iface.trunkAllowedVlans.filter((v) => activeVlans.includes(v))
            : activeVlans;
          out += `${name.padEnd(11)} ${allowed.join(',') || '1'}\n`;
        }
      }
      return { output: out.trimEnd(), newSession: session };
    }
    // Specific interface or generic show interfaces
    const ifToken = sub.replace(/^(interfaces|interface|int)\s*/, '').trim();
    if (ifToken) {
      const resolved = normalizeInterfaceName(ifToken, device.config.interfaces);
      if (resolved && device.config.interfaces[resolved]) {
        const iface = device.config.interfaces[resolved];
        let out = `${resolved} is ${iface.status === 'up' ? 'up' : 'administratively down'}, line protocol is ${iface.status === 'up' ? 'up' : 'down'}\n`;
        out += `  Hardware is Gigabit Ethernet, address is ${iface.mac}\n`;
        if (iface.description) out += `  Description: ${iface.description}\n`;
        if (iface.ip) out += `  Internet address is ${iface.ip}/${maskToCidr(iface.mask || '255.255.255.0')}\n`;
        out += `  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec\n`;
        out += `  Full-duplex, 1000Mb/s, media type is RJ45`;
        return { output: out, newSession: session };
      }
    }

    // Generic show interfaces
    let out = '';
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      out += `${name} is ${iface.status === 'up' ? 'up' : 'administratively down'}, line protocol is ${iface.status === 'up' ? 'up' : 'down'}\n`;
      out += `  Hardware is Gigabit Ethernet, address is ${iface.mac}\n`;
      if (iface.description) out += `  Description: ${iface.description}\n`;
      if (iface.ip) out += `  Internet address is ${iface.ip}/${maskToCidr(iface.mask || '255.255.255.0')}\n`;
      out += `  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec\n`;
      out += `  Full-duplex, 1000Mb/s, media type is RJ45\n\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show port-security / show port-security interface / show port-security address
  if (sub.startsWith('port-security') || sub.startsWith('port-sec')) {
    if (sub.includes('interface ') || sub.includes('int ')) {
      const ifaceToken = sub.replace(/^.*(interface|int)\s+/, '').trim();
      const resolved = normalizeInterfaceName(ifaceToken, device.config.interfaces);
      const iface = resolved ? device.config.interfaces[resolved] : null;
      if (!iface) return { output: `% Interface "${ifaceToken}" not found.`, newSession: session };
      const ps = iface.portSecurity;
      let out = `Port Security              : ${ps?.enabled ? 'Enabled' : 'Disabled'}\n`;
      out += `Port Status                : ${iface.status === 'up' ? 'Secure-up' : 'Secure-down'}\n`;
      out += `Violation Mode             : ${ps?.violation || 'Shutdown'}\n`;
      out += `Aging Time                 : 0 mins\n`;
      out += `Aging Type                 : Absolute\n`;
      out += `SecureStatic Address Aging : Disabled\n`;
      out += `Maximum MAC Addresses      : ${ps?.maxMacs || 1}\n`;
      out += `Total MAC Addresses        : ${ps?.stickyMacs?.length ? ps.stickyMacs.length : ps?.enabled ? 1 : 0}\n`;
      out += `Configured MAC Addresses   : ${ps?.stickyMacs?.length || 0}\n`;
      out += `Sticky MAC Addresses       : ${ps?.stickyMacs?.length || 0}\n`;
      out += `Last Source Address:Vlan   : ${ps?.stickyMacs?.[0] || '0000.0000.0000'}:1\n`;
      out += `Security Violation Count   : 0\n`;
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('address')) {
      let out = '               Secure Mac Address Table\n-------------------------------------------------------------------\nVlan    Mac Address       Type                          Ports   Remaining Age\n                                                                   (mins)\n----    -----------       ----                          -----   -------------\n';
      let hasEntries = false;
      for (const [name, iface] of Object.entries(device.config.interfaces)) {
        if (iface.portSecurity?.enabled) {
          const macList = iface.portSecurity.stickyMacs?.length ? iface.portSecurity.stickyMacs : ['001c.b123.4567'];
          for (const m of macList) {
            hasEntries = true;
            out += `   1    ${m.padEnd(17)} SecureSticky                 ${name.padEnd(7)}       -\n`;
          }
        }
      }
      return { output: hasEntries ? out.trimEnd() : '% No secure MAC addresses configured.', newSession: session };
    }

    let out = 'Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action\n';
    out += '                (Count)       (Count)          (Count)\n';
    out += '-----------  -------------  -----------  -----------------  ---------------\n';
    let count = 0;
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      if (iface.portSecurity?.enabled) {
        count++;
        const curAddr = iface.portSecurity.stickyMacs?.length || 1;
        out += `${name.padEnd(11)}  ${String(iface.portSecurity.maxMacs).padEnd(13)}  ${String(curAddr).padEnd(11)}  0                  ${iface.portSecurity.violation.padEnd(15)}\n`;
      }
    }
    if (count === 0) {
      out += '(no secure ports configured)\n';
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show etherchannel summary
  if (sub.startsWith('etherchannel') || sub.startsWith('ether')) {
    let out = 'Flags:  D - down        P - bundled in port-channel\n';
    out += '        I - stand-alone s - suspended\n';
    out += '        H - Hot-standby (LACP only)\n\n';
    out += 'Group  Port-channel  Protocol    Ports\n';
    out += '------+-------------+-----------+-----------------------------------------------\n';
    if (device.config.portChannels) {
      for (const [id, pc] of Object.entries(device.config.portChannels)) {
        const ports = pc.members.map((m) => `${m}(P)`).join(' ');
        out += `${id.padEnd(6)} Po${id}(SU)       ${pc.protocol.padEnd(11)} ${ports}\n`;
      }
    } else {
      out += '1      Po1(SU)       LACP        Gi0/1(P) Gi0/2(P)\n';
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show standby brief (HSRP)
  if (sub.startsWith('standby') || sub.startsWith('hsrp')) {
    let out = '                     P indicates configured to preempt.\n';
    out += '                     |\n';
    out += 'Interface   Grp  Pri P State   Active          Standby         Virtual IP\n';
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      if (iface.hsrp) {
        out += `${name.padEnd(11)} ${String(iface.hsrp.group).padEnd(4)} ${String(iface.hsrp.priority).padEnd(3)} ${iface.hsrp.preempt ? 'P' : ' '} ${iface.hsrp.state.padEnd(7)} local           10.0.0.2        ${iface.hsrp.virtualIp}\n`;
      }
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show vrrp / show vrrp brief
  if (sub.startsWith('vrrp')) {
    let out = 'Interface   Grp  Pri Time Own Pre State   Master addr     Group addr\n';
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      if (iface.vrrp) {
        out += `${name.padEnd(11)} ${String(iface.vrrp.group).padEnd(4)} ${String(iface.vrrp.priority).padEnd(3)} 3609 N   ${iface.vrrp.preempt ? 'Y' : 'N'}   ${iface.vrrp.state.padEnd(7)} local           ${iface.vrrp.virtualIp}\n`;
      }
    }
    if (!out.includes('local')) out += '(no VRRP groups configured)';
    return { output: out.trimEnd(), newSession: session };
  }

  // show glbp / show glbp brief
  if (sub.startsWith('glbp')) {
    let out = 'Interface   Grp  Fwd Pri State   Address         Active router   Standby router\n';
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      if (iface.glbp) {
        out += `${name.padEnd(11)} ${String(iface.glbp.group).padEnd(4)} -   ${String(iface.glbp.priority).padEnd(3)} ${iface.glbp.state.padEnd(7)} ${iface.glbp.virtualIp.padEnd(15)} local           10.0.0.2\n`;
      }
    }
    if (!out.includes('local')) out += '(no GLBP groups configured)';
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip sla summary / show ip sla statistics
  if (sub.includes('sla')) {
    let out = 'IP SLA Operational Summary\n';
    out += 'ID    Type        Target          Status    Latest RTT   Frequency\n';
    out += '------------------------------------------------------------------\n';
    if (device.config.ipSla) {
      for (const sla of Object.values(device.config.ipSla)) {
        out += `${String(sla.id).padEnd(5)} icmp-echo   ${sla.targetIp.padEnd(15)} OK        2 ms         ${sla.frequency}s\n`;
      }
    } else {
      out += '1     icmp-echo   8.8.8.8         OK        1 ms         10s\n';
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show track
  if (sub.startsWith('track')) {
    let out = '';
    if (device.config.trackObjects) {
      for (const tr of Object.values(device.config.trackObjects)) {
        out += `Track ${tr.id}\n  IP SLA ${tr.targetId} reachability\n  Reachability is ${tr.status}\n  1 change, last change 00:02:14\n  Latest operation return code is OK\n\n`;
      }
    } else {
      out = 'Track 1\n  IP SLA 1 reachability\n  Reachability is Up\n  1 change, last change 00:02:14\n  Latest operation return code is OK';
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show class-map / show policy-map
  if (sub.includes('class-map') || sub.includes('policy-map') || sub.includes('qos')) {
    let out = ' Class Map match-any VOICE-CLASS (id 1)\n   Match dscp ef (46)\n   Match ip precedence 5\n\n';
    out += ' Policy Map QOS-POLICY\n   Class VOICE-CLASS\n     Priority 30 (percent)\n     set dscp ef\n   Class class-default\n     Bandwidth 50 (percent)\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show clock, history, users
  if (sub === 'clock') {
    return { output: `*${new Date().toUTCString()}`, newSession: session };
  }
  if (sub === 'history') {
    return { output: session.history.map((h, i) => `  ${i + 1}  ${h}`).join('\n'), newSession: session };
  }
  if (sub === 'users') {
    return { output: '    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00   ', newSession: session };
  }

  // show ipv6 interface brief / show ipv6 route
  if (sub.startsWith('ipv6 int') || sub === 'ipv6 interface brief') {
    let out = 'Interface              IPv6-Address                              Status\n';
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      const v6 = iface.ipv6Address || 'unassigned';
      const status = iface.status === 'up' ? 'up/up' : 'admin down/down';
      out += `${name.padEnd(23)} ${v6.padEnd(41)} ${status}\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }
  if (sub.startsWith('ipv6 ro') || sub === 'ipv6 route') {
    let out = 'IPv6 Routing Table - default - 3 entries\n';
    out += 'Codes: C - Connected, L - Local, S - Static, O - OSPF\n\n';
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      if (iface.ipv6Address && iface.status === 'up') {
        out += `C   ${iface.ipv6Address} [0/0]\n     via ${name}, directly connected\n`;
      }
    }
    if (device.config.ipv6Routes) {
      device.config.ipv6Routes.forEach((r) => {
        out += `S   ${r.prefix} [1/0]\n     via ${r.nextHop}\n`;
      });
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show lldp neighbors & detail
  if (sub.startsWith('lldp nei') || sub === 'lldp neighbors') {
    const isDetail = sub.includes('detail');
    const neighbors = allDevices.filter((d) => d.id !== device.id);
    if (isDetail) {
      let out = '------------------------------------------------\n';
      neighbors.slice(0, 3).forEach((n) => {
        out += `Chassis id: ${Object.values(n.config.interfaces)[0]?.mac || '001c.b100.0001'}\n`;
        out += `Port id: Gi0/1\n`;
        out += `System Name: ${n.config.hostname || n.name}\n`;
        out += `System Description: WireCraft IOS-Compatible Engine, Version 15.4(3)M2\n`;
        out += `Management Addresses: IP: 192.168.1.1\n------------------------------------------------\n`;
      });
      return { output: out.trimEnd(), newSession: session };
    }
    let out = 'Capability codes:\n    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device\n    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other\n\n';
    out += 'Device ID           Local Intf     Hold-time  Capability      Port ID\n';
    neighbors.slice(0, 4).forEach((n, idx) => {
      out += `${(n.config.hostname || n.name).padEnd(19)} ${`Gig 0/${idx}`.padEnd(14)} 120        ${n.type === 'switch' ? 'B' : 'R'}               ${`Gig 0/${idx}`}\n`;
    });
    return { output: out.trimEnd(), newSession: session };
  }

  // show vtp status
  if (sub.startsWith('vtp stat') || sub === 'vtp status') {
    const vtp = device.config.vtp || { mode: 'server', domain: 'NULL' };
    let out = 'VTP Version capable             : 1 to 3\n';
    out += `VTP Operating Mode                : ${vtp.mode.charAt(0).toUpperCase() + vtp.mode.slice(1)}\n`;
    out += `VTP Domain Name                   : ${vtp.domain || 'NULL'}\n`;
    out += 'VTP Pruning Mode                  : Disabled\n';
    out += 'VTP V2 Mode                       : Disabled\n';
    out += 'VTP Traps Generation              : Disabled\n';
    out += `Configuration Revision            : 0\n`;
    out += `Maximum VLANs supported locally   : 255\n`;
    out += `Number of existing VLANs          : ${Object.keys(device.config.vlans || { 1: 1 }).length}\n`;
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip ssh
  if (sub.startsWith('ip ssh') || sub === 'ssh') {
    let out = `SSH Enable - version ${device.config.sshVersion || 2}.0\n`;
    out += 'Authentication timeout: 120 secs; Authentication retries: 3\n';
    out += 'Minimum expected Diffie-Hellman key size : 1024 bits\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show ntp status / associations
  if (sub.startsWith('ntp')) {
    let out = `Clock is synchronized, stratum 2, reference is ${device.config.ntpServer || '192.168.1.100'}\n`;
    out += 'nominal freq is 250.0000 Hz, actual freq is 249.9998 Hz, precision is 2**18\n';
    out += 'reference time is E0A41201.C35B9210 (14:20:01.763 UTC Mon Oct 6 2026)\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show boot / show bootvar
  if (sub.startsWith('boot') || sub === 'bootvar') {
    let out = 'BOOT variable = flash:c2900-universalk9-mz.SPA.154-3.M2.bin,1;\n';
    out += 'CONFIG_FILE variable does not exist\n';
    out += 'BOOTLDR variable does not exist\n';
    out += 'Configuration register is 0x2102\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show startup-config
  if (sub.startsWith('start') || sub.startsWith('startup-config')) {
    return { output: generateRunningConfig(device), newSession: session };
  }

  // show processes cpu / show memory
  if (sub.includes('cpu')) {
    let out = 'CPU utilization for five seconds: 1%/0%; one minute: 2%; five minutes: 1%\n';
    out += ' PID Runtime(ms)   Invoked      uSecs   5Sec   1Min   5Min TTY Process\n';
    out += '   1           0         4          0  0.00%  0.00%  0.00%   0 Chunk Manager\n';
    out += '   2          40       120        333  0.00%  0.00%  0.00%   0 IP Input\n';
    out += '   3         100       850        117  0.08%  0.04%  0.02%   0 Spanning Tree\n';
    return { output: out.trimEnd(), newSession: session };
  }
  if (sub.includes('memory') || sub.includes('mem')) {
    let out = '                Head    Total(b)     Used(b)     Free(b)   Lowest(b)  Largest(b)\n';
    out += 'Processor   36066B20   429496728   114688000   314808728   300120448   310000000\n';
    out += '      I/O    1D80000    33554432     8388608    25165824    24000000    24800000\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show flash: / dir
  if (sub.startsWith('flash') || sub.startsWith('dir') || sub.includes('flash:')) {
    let out = 'Directory of flash:/\n\n';
    out += '  1  -rw-    33591768  Mar 1 2026 00:02:18 +00:00  c2900-universalk9-mz.SPA.154-3.M2.bin\n';
    out += '  2  -rw-        2828  Mar 1 2026 00:04:10 +00:00  running-config\n';
    out += '  3  -rw-        1842  Mar 1 2026 00:04:12 +00:00  vlan.dat\n\n';
    out += '255778816 bytes total (222184220 bytes free)';
    return { output: out, newSession: session };
  }

  // show inventory / show diag
  if (sub.startsWith('inv') || sub.startsWith('inventory') || sub.startsWith('diag')) {
    let out = `NAME: "${device.config.hostname || device.name}", DESCR: "2911 Integrated Services Router (Emulated)"\n`;
    out += `PID: CISCO2911/K9      , VID: V01 , SN: FGL184291A8\n\n`;
    out += `NAME: "High Density Voice/Fax Extension Module", DESCR: "High Density Voice/Fax Extension Module"\n`;
    out += `PID: HWIC-2T           , VID: V01 , SN: FOC184328X2\n`;
    return { output: out.trimEnd(), newSession: session };
  }

  // show logging / show log
  if (sub.startsWith('log') || sub.startsWith('logging')) {
    const buffer = device.config.loggingBuffer && device.config.loggingBuffer.length > 0
      ? device.config.loggingBuffer
      : [
          '*Mar 1 00:00:15.112: %LINK-3-UPDOWN: Interface GigabitEthernet0/0, changed state to up',
          '*Mar 1 00:00:16.114: %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/0, changed state to up',
          '*Mar 1 00:01:02.408: %SYS-5-CONFIG_I: Configured from console by console',
        ];

    let out = 'Syslog logging: enabled (0 messages dropped, 0 messages rate-limited, 0 flushes, 0 overruns, xml disabled, filtering disabled)\n\n';
    out += 'No Active Message Discriminator.\n\n';
    out += `    Console logging: level debugging, ${buffer.length} messages logged, xml disabled, filtering disabled\n`;
    out += `    Monitor logging: level debugging, 0 messages logged, xml disabled, filtering disabled\n`;
    out += `    Buffer logging:  level debugging, ${buffer.length} messages logged, xml disabled, filtering disabled\n`;
    out += '    Trap logging:    level informational, 32 message lines logged\n\n';
    out += `Log Buffer (4096 bytes):\n`;
    out += buffer.join('\n');
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip ospf database
  if (sub.startsWith('ip ospf data') || sub === 'ip ospf database') {
    let out = '            OSPF Router with ID (192.168.1.1) (Process ID 1)\n\n';
    out += '                Router Link States (Area 0)\n\n';
    out += 'Link ID         ADV Router      Age         Seq#       Checksum Link count\n';
    out += '192.168.1.1     192.168.1.1     412         0x80000004 0x00A821 2\n';
    out += '192.168.1.2     192.168.1.2     389         0x80000003 0x00B214 2\n\n';
    out += '                Net Link States (Area 0)\n\n';
    out += 'Link ID         ADV Router      Age         Seq#       Checksum\n';
    out += '192.168.1.2     192.168.1.2     389         0x80000002 0x004128\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show ip dhcp pool
  if (sub.startsWith('ip dhcp pool')) {
    const pools = device.config.dhcpPools || {};
    let out = '';
    for (const [name, pool] of Object.entries(pools)) {
      out += `Pool ${name} :\n`;
      out += ` Utilization mark (high/low)    : 100 / 0\n`;
      out += ` Subnet size (Total/Usable)     : 254 / 254\n`;
      out += ` Total addresses                : 254\n`;
      out += ` Leased addresses               : 2\n`;
      out += ` Pending event                  : none\n`;
      out += ` 1 subnet is currently in the pool :\n`;
      out += ` Current index        IP pool range                    Leased addresses\n`;
      out += ` ${pool.network}        ${pool.network} - 192.168.1.254  2\n\n`;
    }
    return { output: out ? out.trimEnd() : '% No DHCP pools configured.', newSession: session };
  }

  // show ip dhcp server statistics
  if (sub.startsWith('ip dhcp server stat') || sub === 'ip dhcp statistics') {
    let out = 'Memory bytes         : 18420\n';
    out += 'Address pools        : 1\n';
    out += 'Database agents      : 0\n';
    out += 'Automatic bindings   : 2\n';
    out += 'Manual bindings      : 0\n';
    out += 'Expired bindings     : 0\n';
    out += 'Malformed messages   : 0\n';
    out += 'Secure arp entries   : 0\n\n';
    out += 'Message              Received\n';
    out += 'BOOTREQUEST          0\n';
    out += 'DHCPDISCOVER         4\n';
    out += 'DHCPREQUEST          4\n';
    out += 'DHCPDECLINE          0\n';
    out += 'DHCPRELEASE          0\n';
    out += 'DHCPINFORM           0\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show switch / show switch detail / show switch stack-ports / show switch stack-ring detail / show switch neighbors
  if (sub.startsWith('switch')) {
    const stack = device.config.stack || {
      enabled: true,
      ringSpeed: '480 Gbps',
      ringState: 'Full',
      members: [
        {
          memberId: 1,
          role: 'Active',
          priority: 15,
          mac: '001c.b100.0001',
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

    if (sub.includes('stack-port') || sub.includes('ports')) {
      let out = 'Switch#  Port 1       Port 2\n----------------------------\n';
      stack.members.forEach((m) => {
        out += `${String(m.memberId).padEnd(8)} ${(m.stackPorts?.port1 || 'Ok').padEnd(12)} ${m.stackPorts?.port2 || 'Ok'}\n`;
      });
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('stack-ring') || sub.includes('ring')) {
      let out = 'Stack Ring Detail\n=================\n';
      out += `Stack Ring Speed        : ${stack.ringSpeed}\n`;
      out += `Stack Ring State        : ${stack.ringState}\n`;
      out += `Stack Ring Full Duplex  : Yes\n`;
      out += `Number of stack members : ${stack.members.length}\n`;
      out += `Stack Ring Redundancy   : SSO (Stateful Switchover)\n`;
      return { output: out.trimEnd(), newSession: session };
    }

    if (sub.includes('neighbor') || sub.includes('nei')) {
      let out = 'Switch#    Port 1 Neighbor    Port 2 Neighbor\n---------------------------------------------\n';
      stack.members.forEach((m, idx) => {
        const next = stack.members[(idx + 1) % stack.members.length]?.memberId || 1;
        const prev = stack.members[(idx - 1 + stack.members.length) % stack.members.length]?.memberId || 1;
        out += `${String(m.memberId).padEnd(10)} ${String(next).padEnd(18)} ${String(prev)}\n`;
      });
      return { output: out.trimEnd(), newSession: session };
    }

    let out = 'Switch/Stack Mac Address : ' + (stack.members[0]?.mac || '001c.b100.0001') + '\n';
    out += '                                           H/W   Current\n';
    out += 'Switch#   Role      Mac Address     Priority Version  State\n';
    out += '------------------------------------------------------------\n';
    stack.members.forEach((m) => {
      const isMaster = m.role === 'Active';
      const mark = isMaster ? '*' : ' ';
      out += `${mark}${String(m.memberId).padEnd(8)} ${m.role.padEnd(9)} ${m.mac.padEnd(15)} ${String(m.priority).padEnd(8)} V02     ${m.state}\n`;
    });
    return { output: out.trimEnd(), newSession: session };
  }

  // show redundancy
  if (sub.startsWith('redundancy') || sub.startsWith('red')) {
    let out = 'Redundant System Information :\n------------------------------\n';
    out += '       Available system uptime = 4 days, 16 hours\n';
    out += 'Switchovers system experienced = 0\n';
    out += '              Standby failures = 0\n';
    out += '        Last switchover reason = none\n\n';
    out += '                 Hardware Mode = Duplex\n';
    out += '    Configured Redundancy Mode = sso\n';
    out += '     Operating Redundancy Mode = sso\n';
    out += '              Maintenance Mode = Disabled\n';
    out += '                Communications = Up\n\n';
    out += 'Current Processor Information :\n------------------------------\n';
    out += '               Active Location = slot 1 (Switch 1)\n';
    out += '        Current Software state = ACTIVE\n\n';
    out += 'Peer Processor Information :\n---------------------------\n';
    out += '              Standby Location = slot 2 (Switch 2)\n';
    out += '        Current Software state = STANDBY HOT\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show nameif (ASA Firewall)
  if (sub === 'nameif' || sub === 'nameif brief') {
    let out = 'Interface                  Name                     Security\n';
    out += 'GigabitEthernet0/0         outside                  0\n';
    out += 'GigabitEthernet0/1         inside                   100\n';
    out += 'GigabitEthernet0/2         dmz                      50\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show conn (ASA Firewall)
  if (sub.startsWith('conn')) {
    let out = '2 in use, 18 most used\n';
    out += 'TCP outside 203.0.113.10:443 inside 192.168.1.50:49152, idle 0:00:04, bytes 8192, flags UIO\n';
    out += 'UDP outside 8.8.8.8:53 inside 192.168.1.50:54321, idle 0:00:01, bytes 128, flags -\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show xlate (ASA Firewall)
  if (sub.startsWith('xlate')) {
    let out = '2 in use, 12 most used\n';
    out += 'Flags: D - DNS, d - Dynamic, s - Static\n';
    out += 'PAT Global 203.0.113.10(49152) Local 192.168.1.50(49152)\n';
    out += 'NAT from inside:192.168.1.100 to outside:203.0.113.100 flags s\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show feature / show vpc / show vrf (Nexus NX-OS)
  if (sub === 'feature') {
    let out = 'Feature Name          Instance   State\n--------------------  ---------  --------\n';
    out += 'ospf                  1          enabled\n';
    out += 'vpc                   1          enabled\n';
    out += 'lldp                  1          enabled\n';
    out += 'lacp                  1          enabled\n';
    out += 'interface-vlan        1          enabled\n';
    return { output: out.trimEnd(), newSession: session };
  }
  if (sub === 'vpc' || sub === 'vpc brief') {
    let out = 'vPC domain id                     : 1\n';
    out += 'Peer status                       : peer adjacency formed ok\n';
    out += 'vPC keep-alive status             : Peer is alive\n';
    out += 'Configuration consistency status  : success\n';
    out += 'Number of vPCs configured         : 2\n';
    return { output: out.trimEnd(), newSession: session };
  }
  if (sub === 'vrf') {
    let out = 'VRF-Name                           VRF-ID State   Reason\ndefault                            1      Up      --\nmanagement                         2      Up      --\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show wlan / ap / client summary (WLC Controller)
  if (sub.startsWith('wlan sum') || sub === 'wlan summary') {
    let out = 'Number of WLANs.................................. 2\n\n';
    out += 'WLAN ID  WLAN Profile Name / SSID        Status    Interface Name        PMIPv6 Opt\n';
    out += '-------  ------------------------------  --------  --------------------  ----------\n';
    out += '1        Corp-WiFi / Corp-WiFi           Enabled   management            none\n';
    out += '2        Guest-WiFi / Guest-WiFi         Enabled   vlan20                none\n';
    return { output: out.trimEnd(), newSession: session };
  }
  if (sub.startsWith('ap sum') || sub === 'ap summary') {
    let out = 'Number of APs.................................... 2\n\n';
    out += 'AP Name             Slots  AP Model              Ethernet MAC       Location          Country  IP Address\n';
    out += '------------------  -----  --------------------  -----------------  ----------------  -------  -----------\n';
    out += 'AP-Floor1-North     2      AIR-AP3702I-A-K9      001c.b124.901a     Building A Fl 1   US       192.168.1.20\n';
    out += 'AP-Floor1-South     2      AIR-AP3702I-A-K9      001c.b124.902b     Building A Fl 1   US       192.168.1.21\n';
    return { output: out.trimEnd(), newSession: session };
  }
  if (sub.startsWith('client sum') || sub === 'client summary') {
    let out = 'Number of Clients................................ 3\n\n';
    out += 'MAC Address       AP Name           WLAN  State            Protocol  Method\n';
    out += '----------------  ----------------  ----  ---------------  --------  ----------------\n';
    out += '001c.b1fe.1102    AP-Floor1-North   1     Associated       802.11ac  WPA2-Enterprise\n';
    out += '001c.b1fe.1104    AP-Floor1-South   1     Associated       802.11ac  WPA2-Enterprise\n';
    return { output: out.trimEnd(), newSession: session };
  }
  if (sub === 'sysinfo') {
    let out = 'Manufacturer\'s Name.............................. WireCraft Systems (Educational Emulation)\n';
    out += 'Product Name..................................... Emulated 3504 Wireless LAN Controller\n';
    out += 'Product Version.................................. 8.5.151.0 (Simulation)\n';
    out += 'RTOS Version..................................... 8.5.151.0\n';
    out += 'System Name...................................... WLC-Core-01\n';
    out += 'System Up Time................................... 14 days 6 hours 22 minutes\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show crypto key mypubkey rsa
  if (sub.startsWith('crypto key') || sub.startsWith('crypto')) {
    let out = '% Key pair signature: (1024 bits)\n';
    out += 'Key name: ' + (device.config.hostname || 'Router') + '.example.local\n';
    out += 'Key type: RSA Key Pair\n';
    out += 'Storage: NVRAM private\n';
    out += 'Usage: General Purpose Key\n';
    out += 'Key Data:\n 30819F30 0D06092A 864886F7 0D010101 05000381 8D003081 89028181\n';
    out += ' 00C812A4 928198BA 2419208A FB291882 18290129 19828471 28371928\n';
    return { output: out.trimEnd(), newSession: session };
  }

  // show tech-support
  if (sub.startsWith('tech') || sub.startsWith('tech-support')) {
    let out = '------------------ show version ------------------\n';
    out += `WireCraft IOS-Compatible Engine (Emulated C2900), Software Version 15.4(3)M2\n`;
    out += `% Notice: Independent educational simulation. Not affiliated with Cisco Systems, Inc.\n`;
    out += `System image file is "flash:c2900-universalk9-mz.SPA.154-3.M2.bin"\n\n`;
    out += '------------------ show running-config ------------------\n';
    out += generateRunningConfig(device) + '\n\n';
    out += '------------------ show ip route ------------------\n';
    out += generateRoutingTableOutput(device) + '\n\n';
    out += '------------------ show interfaces ------------------\n';
    for (const [name, iface] of Object.entries(device.config.interfaces)) {
      out += `${name} is ${iface.status === 'up' ? 'up' : 'administratively down'}, IP ${iface.ip || 'unassigned'}\n`;
    }
    return { output: out.trimEnd(), newSession: session };
  }

  // show version
  if (sub === 'version' || sub === 'ver') {
    let out = `WireCraft IOS-Compatible Engine (Emulated C2900), Software Version 15.4(3)M2\n`;
    out += `% Notice: WireCraft is an educational simulator for CCNA study, not affiliated with Cisco Systems, Inc.\n`;
    out += `ROM: WireCraft System Bootstrap, Version 15.0(1r)M16\n\n`;
    out += `${device.config.hostname || device.name} uptime is 4 days, 16 hours, 28 minutes\n`;
    out += `System returned to ROM by power-on\n`;
    out += `Emulated 2911 Hardware Platform (revision 1.0) with 514048K/10240K bytes of memory.\n`;
    out += `3 Gigabit Ethernet interfaces\n`;
    out += `2 Serial(sync/async) interfaces\n`;
    out += `DRAM configuration is 64 bits wide with parity enabled.\n`;
    out += `255K bytes of non-volatile configuration memory.\n`;
    out += `Configuration register is 0x2102\n`;
    return { output: out.trimEnd(), newSession: session };
  }

  return { output: `% Incomplete or unsupported show command: "${sub}"`, newSession: session };
}
