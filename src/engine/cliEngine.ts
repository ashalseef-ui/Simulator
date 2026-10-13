import { Device, DeviceConfig, DeviceInterface, Link } from '../types/network';
import { isValidIp, maskToCidr, getNetworkAddress } from '../utils/ipUtils';
import { calculateStp, calculatePvst, getStpPortState } from './stpEngine';
import { computeOspf, formatNeighborTable, formatOspfRoute, OspfRoute } from './ospfEngine';
import { simulatePing } from './simulationEngine';
import { CommandTrie } from './cli/commandTrie';
import { COMMAND_TREE_REGISTRY } from './cli/commandTreeRegistry';
import {
  getMultiVendorPrompt,
  executeJunosCommand,
  executeAristaCommand,
  executeLinuxCommand,
  executeMikrotikCommand,
} from './cli/multiVendorEngines';

export const commandTrie = new CommandTrie();
commandTrie.registerAll(COMMAND_TREE_REGISTRY);

export type CliMode =
  | 'user'
  | 'priv'
  | 'config'
  | 'config-if'
  | 'config-subif'
  | 'config-router'
  | 'config-router-bgp'
  | 'config-router-eigrp'
  | 'config-router-rip'
  | 'config-dhcp'
  | 'config-vlan'
  | 'config-line';

export interface CliSession {
  mode: CliMode;
  currentInterface?: string;
  currentInterfaceRange?: string[];
  currentOspfProcess?: number;
  currentBgpAsn?: number;
  currentEigrpAs?: number;
  currentDhcpPool?: string;
  currentVlan?: number;
  history: string[];
  historyIndex: number;
  debugFlags?: {
    icmp?: boolean;
    ospfEvents?: boolean;
    ospfAdj?: boolean;
    bgpEvents?: boolean;
  };
  terminalMonitor?: boolean;
}

export function createCliSession(): CliSession {
  return {
    mode: 'user',
    history: [],
    historyIndex: -1,
    debugFlags: {},
    terminalMonitor: false,
  };
}

export function getPrompt(device: Device, session: CliSession): string {
  if (device.config.networkOs && device.config.networkOs !== 'cisco-ios') {
    return getMultiVendorPrompt(device, session);
  }
  const host = device.config.hostname || device.name;
  switch (session.mode) {
    case 'user':
      return `${host}>`;
    case 'priv':
      return `${host}#`;
    case 'config':
      return `${host}(config)#`;
    case 'config-if':
      return session.currentInterfaceRange && session.currentInterfaceRange.length > 1
        ? `${host}(config-if-range)#`
        : `${host}(config-if)#`;
    case 'config-subif':
      return `${host}(config-subif)#`;
    case 'config-router':
    case 'config-router-bgp':
    case 'config-router-eigrp':
    case 'config-router-rip':
      return `${host}(config-router)#`;
    case 'config-dhcp':
      return `${host}(config-dhcp-config)#`;
    case 'config-vlan':
      return `${host}(config-vlan)#`;
    case 'config-line':
      return `${host}(config-line)#`;
    default:
      return `${host}>`;
  }
}

/**
 * Normalizes interface names like g0/0 -> GigabitEthernet0/0, fa0/1 -> FastEthernet0/1, se0/0/0 -> Serial0/0/0
 */
export function normalizeInterfaceName(input: string, availableInterfaces: Record<string, any>): string | null {
  const clean = input.trim().replace(/\s+/g, '');
  const lower = clean.toLowerCase();

  // Direct match
  if (availableInterfaces[clean]) return clean;

  // Case-insensitive key search
  for (const name of Object.keys(availableInterfaces)) {
    if (name.toLowerCase() === lower || name.replace(/\s+/g, '').toLowerCase() === lower) return name;
  }

  // Prefix & abbreviation matching (gi, fa, se, eth, te, fo, lo, vl)
  for (const name of Object.keys(availableInterfaces)) {
    const nameLower = name.toLowerCase();
    if (lower.startsWith('gi') && nameLower.startsWith('gi')) {
      const numPart = lower.replace(/^gi(gabitethernet)?/, '');
      const actualNum = nameLower.replace(/^gi(gabitethernet)?/, '');
      if (numPart === actualNum) return name;
    }
    if (lower.startsWith('fa') && nameLower.startsWith('fa')) {
      const numPart = lower.replace(/^fa(stethernet)?/, '');
      const actualNum = nameLower.replace(/^fa(stethernet)?/, '');
      if (numPart === actualNum) return name;
    }
    if (lower.startsWith('eth') && nameLower.startsWith('eth')) {
      const numPart = lower.replace(/^eth(ernet)?/, '');
      const actualNum = nameLower.replace(/^eth(ernet)?/, '');
      if (numPart === actualNum) return name;
    }
    if (lower.startsWith('te') && nameLower.startsWith('te')) {
      const numPart = lower.replace(/^te(ngigabitethernet)?/, '');
      const actualNum = nameLower.replace(/^te(ngigabitethernet)?/, '');
      if (numPart === actualNum) return name;
    }
    if (lower.startsWith('se') && nameLower.startsWith('se')) {
      const numPart = lower.replace(/^se(rial)?/, '');
      const actualNum = nameLower.replace(/^se(rial)?/, '');
      if (numPart === actualNum) return name;
    }
    if (lower.startsWith('lo') && nameLower.startsWith('lo')) {
      const numPart = lower.replace(/^lo(opback)?/, '');
      const actualNum = nameLower.replace(/^lo(opback)?/, '');
      if (numPart === actualNum) return name;
    }
    if (lower.startsWith('vl') && nameLower.startsWith('vl')) {
      const numPart = lower.replace(/^vl(an)?/, '');
      const actualNum = nameLower.replace(/^vl(an)?/, '');
      if (numPart === actualNum) return name;
    }
  }

  // Subinterface creation or SVI e.g. Gi0/0.10 or Vlan10
  if (clean.includes('.') || lower.startsWith('vlan')) {
    return clean;
  }

  return null;
}

/**
 * Resolves a Cisco interface range expression like:
 * "GigabitEthernet0/1 - 4", "gi0/1 - 0/4", "FastEthernet0/1 - 2, GigabitEthernet0/1"
 */
export function parseInterfaceRange(
  rangeExpr: string,
  availableInterfaces: Record<string, any>
): string[] {
  const chunks = rangeExpr.split(',').map((c) => c.trim()).filter(Boolean);
  const matchedNames: string[] = [];

  for (const chunk of chunks) {
    if (chunk.includes('-')) {
      const parts = chunk.split('-').map((p) => p.trim());
      const startStr = parts[0];
      const endStr = parts[1];

      const startResolved = normalizeInterfaceName(startStr, availableInterfaces);
      if (!startResolved) continue;

      // Extract slot prefix and starting number
      const numMatch = startResolved.match(/^(.*?)(\d+)$/);
      if (!numMatch) {
        matchedNames.push(startResolved);
        continue;
      }

      const prefix = numMatch[1];
      const startNum = parseInt(numMatch[2], 10);

      // End number might be "4" or full "0/4" or "GigabitEthernet0/4"
      let endNum = parseInt(endStr, 10);
      if (isNaN(endNum)) {
        const endNumMatch = endStr.match(/(\d+)$/);
        endNum = endNumMatch ? parseInt(endNumMatch[1], 10) : startNum;
      }

      const minNum = Math.min(startNum, endNum);
      const maxNum = Math.max(startNum, endNum);

      for (let n = minNum; n <= maxNum; n++) {
        const candidate = `${prefix}${n}`;
        const candidateResolved = normalizeInterfaceName(candidate, availableInterfaces);
        if (candidateResolved && !matchedNames.includes(candidateResolved)) {
          matchedNames.push(candidateResolved);
        }
      }
    } else {
      const single = normalizeInterfaceName(chunk, availableInterfaces);
      if (single && !matchedNames.includes(single)) {
        matchedNames.push(single);
      }
    }
  }

  return matchedNames;
}

/**
 * Appends a syslog message into the device's loggingBuffer.
 */
export function appendDeviceLog(config: DeviceConfig, message: string): void {
  if (!config.loggingBuffer) {
    config.loggingBuffer = [];
  }
  const dateStr = new Date().toLocaleTimeString('en-US', { hour12: false });
  const formatted = `*Mar 1 ${dateStr}: ${message}`;
  config.loggingBuffer.push(formatted);
  if (config.loggingBuffer.length > 50) {
    config.loggingBuffer.shift();
  }
}

/**
 * Returns dynamic and configured MAC entries learned from connected links and topology devices.
 */
export function getLiveMacTable(device: Device, allDevices: Device[], allLinks: Link[]): { vlan: number; mac: string; type: 'DYNAMIC' | 'STATIC'; port: string }[] {
  const result: { vlan: number; mac: string; type: 'DYNAMIC' | 'STATIC'; port: string }[] = [];
  const seen = new Set<string>();

  // Add explicit statically configured or sticky MACs
  if (device.config.macTable && device.config.macTable.length > 0) {
    for (const e of device.config.macTable) {
      result.push(e);
      seen.add(`${e.vlan}:${e.mac}`);
    }
  }

  // Add sticky port-security MACs
  for (const [pName, iface] of Object.entries(device.config.interfaces)) {
    if (iface.portSecurity?.enabled && iface.portSecurity.stickyMacs) {
      for (const sm of iface.portSecurity.stickyMacs) {
        const vlan = iface.accessVlan || 1;
        const key = `${vlan}:${sm}`;
        if (!seen.has(key)) {
          result.push({ vlan, mac: sm, type: 'STATIC', port: pName });
          seen.add(key);
        }
      }
    }
  }

  // Derive live dynamic MAC learning across links connected to this switch
  for (const link of allLinks) {
    let localPort = '';
    let remoteDeviceId = '';
    let remotePort = '';

    if (link.fromDevice === device.id) {
      localPort = link.fromPort;
      remoteDeviceId = link.toDevice;
      remotePort = link.toPort;
    } else if (link.toDevice === device.id) {
      localPort = link.toPort;
      remoteDeviceId = link.fromDevice;
      remotePort = link.fromPort;
    }

    if (!localPort || !remoteDeviceId) continue;
    const localIface = device.config.interfaces[localPort];
    if (!localIface || localIface.status === 'down') continue;

    const remoteDev = allDevices.find((d) => d.id === remoteDeviceId);
    if (!remoteDev) continue;

    const remoteIface = remoteDev.config.interfaces[remotePort];
    if (!remoteIface || !remoteIface.mac) continue;

    const vlan = localIface.mode === 'access' ? (localIface.accessVlan || 1) : (localIface.nativeVlan || 1);
    const key = `${vlan}:${remoteIface.mac}`;
    if (!seen.has(key)) {
      result.push({ vlan, mac: remoteIface.mac, type: 'DYNAMIC', port: localPort });
      seen.add(key);
    }
  }

  return result;
}

/**
 * Returns live ARP table entries computed from active interfaces and reachable neighbor IPs.
 */
export function getLiveArpTable(device: Device, allDevices: Device[], allLinks: Link[]): { ip: string; mac: string; port: string }[] {
  const result: { ip: string; mac: string; port: string }[] = [];
  const seenIps = new Set<string>();

  // Add self interfaces with IP
  for (const [pName, iface] of Object.entries(device.config.interfaces)) {
    if (iface.ip && iface.status === 'up') {
      result.push({ ip: iface.ip, mac: iface.mac, port: pName });
      seenIps.add(iface.ip);
    }
  }

  // Add explicit static ARP entries
  if (device.config.arpTable) {
    for (const e of device.config.arpTable) {
      if (!seenIps.has(e.ip)) {
        result.push({ ip: e.ip, mac: e.mac, port: e.port || 'Vlan1' });
        seenIps.add(e.ip);
      }
    }
  }

  // Resolve adjacent devices on same subnet across topology links
  for (const link of allLinks) {
    let localPort = '';
    let remoteDeviceId = '';
    let remotePort = '';

    if (link.fromDevice === device.id) {
      localPort = link.fromPort;
      remoteDeviceId = link.toDevice;
      remotePort = link.toPort;
    } else if (link.toDevice === device.id) {
      localPort = link.toPort;
      remoteDeviceId = link.fromDevice;
      remotePort = link.fromPort;
    }

    if (!localPort || !remoteDeviceId) continue;
    const localIface = device.config.interfaces[localPort];
    if (!localIface || localIface.status === 'down') continue;

    const remoteDev = allDevices.find((d) => d.id === remoteDeviceId);
    if (!remoteDev) continue;

    const remoteIface = remoteDev.config.interfaces[remotePort];
    if (remoteIface && remoteIface.ip && !seenIps.has(remoteIface.ip)) {
      result.push({ ip: remoteIface.ip, mac: remoteIface.mac, port: localPort });
      seenIps.add(remoteIface.ip);
    }
  }

  return result;
}

/**
 * Produces Cisco-style '% Invalid input detected at '^' marker' error output.
 */
export function formatInvalidInputCaret(commandLine: string, errorPos: number): string {
  const safePos = Math.max(0, Math.min(errorPos, commandLine.length));
  const caretLine = ' '.repeat(safePos) + '^';
  return `${commandLine}\n${caretLine}\n% Invalid input detected at '^' marker.`;
}

/**
 * Applies Cisco IOS pipe filters (| include, | exclude, | begin, | section, | count)
 */
export function applyCliOutputFilter(rawOutput: string, pipeExpr: string): string {
  if (!rawOutput) return '';
  const trimmed = pipeExpr.trim();
  if (!trimmed) return rawOutput;

  const tokens = trimmed.split(/\s+/);
  const filterType = tokens[0]?.toLowerCase();
  const pattern = tokens.slice(1).join(' ').trim();

  // If user only typed '|' or '| ?'
  if (!filterType || filterType === '?') {
    return `Output modifiers:\n  begin     Begin with the line that matches\n  exclude   Exclude lines that match\n  include   Include lines that match\n  section   Filter a section of interest\n  count     Count the number of lines`;
  }

  // If user typed '| include ?' or similar
  if (tokens[1] === '?' || pattern === '?') {
    return '  LINE  Regular expression to match';
  }

  const lines = rawOutput.split('\n');

  // Case-insensitive regex matcher
  let regex: RegExp;
  try {
    regex = new RegExp(pattern || '', 'i');
  } catch {
    regex = new RegExp((pattern || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  // | include / inc / incude / i <pattern>
  if (filterType === 'include' || filterType === 'inc' || filterType === 'incude' || filterType === 'i') {
    if (!pattern) return rawOutput;
    return lines.filter((l) => regex.test(l)).join('\n');
  }

  // | exclude / exc / ex / e <pattern>
  if (filterType === 'exclude' || filterType === 'exc' || filterType === 'ex' || filterType === 'e') {
    if (!pattern) return rawOutput;
    return lines.filter((l) => !regex.test(l)).join('\n');
  }

  // | begin / beg / b <pattern>
  if (filterType === 'begin' || filterType === 'beg' || filterType === 'b') {
    if (!pattern) return rawOutput;
    const matchIdx = lines.findIndex((l) => regex.test(l));
    if (matchIdx === -1) return '';
    return lines.slice(matchIdx).join('\n');
  }

  // | section / sec / s <pattern>
  if (filterType === 'section' || filterType === 'sec' || filterType === 's') {
    if (!pattern) return rawOutput;
    const matchedSections: string[] = [];
    let inSection = false;
    let sectionLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isTopLevelHeader = !line.startsWith(' ') && !line.startsWith('\t') && line.trim().length > 0;

      if (isTopLevelHeader) {
        if (inSection && sectionLines.length > 0) {
          matchedSections.push(sectionLines.join('\n'));
          sectionLines = [];
        }
        if (regex.test(line)) {
          inSection = true;
          sectionLines.push(line);
        } else {
          inSection = false;
        }
      } else if (inSection) {
        sectionLines.push(line);
      }
    }
    if (inSection && sectionLines.length > 0) {
      matchedSections.push(sectionLines.join('\n'));
    }
    return matchedSections.length > 0
      ? matchedSections.join('\n!\n')
      : lines.filter((l) => regex.test(l)).join('\n');
  }

  // | count / c
  if (filterType === 'count' || filterType === 'c') {
    const count = lines.filter((l) => l.trim().length > 0).length;
    return `Number of lines: ${count}`;
  }

  return rawOutput;
}

export function executeCliCommand(
  rawCommand: string,
  device: Device,
  allDevices: Device[],
  session: CliSession,
  onConfigChange: (updatedConfig: DeviceConfig) => void,
  allLinks: Link[] = []
): { output: string; newSession: CliSession } {
  const line = rawCommand.trim();
  const newSession: CliSession = { ...session };
  const config: DeviceConfig = JSON.parse(JSON.stringify(device.config));

  // Save to history
  if (line.length > 0) {
    newSession.history = [...newSession.history, line];
    newSession.historyIndex = newSession.history.length;
  }

  if (!line) {
    return { output: '', newSession };
  }

  // Multi-Vendor Engine Dispatch (Universal Network OS Emulation)
  const currentOs = device.config.networkOs || 'cisco-ios';
  if (currentOs === 'juniper-junos') {
    return executeJunosCommand(line, device, allDevices, session, onConfigChange, allLinks);
  }
  if (currentOs === 'linux-vyos') {
    return executeLinuxCommand(line, device, allDevices, session, onConfigChange, allLinks);
  }
  if (currentOs === 'mikrotik-routeros') {
    return executeMikrotikCommand(line, device, allDevices, session, onConfigChange, allLinks);
  }
  if (currentOs === 'arista-eos') {
    const lower = line.trim().toLowerCase();
    if (
      lower === 'bash' ||
      (session as any).bashActive ||
      lower.startsWith('show running-config sanitized') ||
      lower.startsWith('show lldp') ||
      lower === 'show version' ||
      lower === 'sh ver' ||
      lower.startsWith('show interfaces status') ||
      lower.startsWith('sh int status')
    ) {
      return executeAristaCommand(line, device, allDevices, session, onConfigChange, allLinks);
    }
  }

  // Check if command uses pipe output redirection (e.g., "show run | include ip" or "show ip int br | exc unassigned | count")
  const pipeIndex = line.indexOf('|');
  if (pipeIndex !== -1) {
    const mainCommand = line.slice(0, pipeIndex).trim();
    const pipeParts = line.slice(pipeIndex + 1).split('|');

    // Execute the base command without the pipe
    const baseResult = executeCliCommand(
      mainCommand,
      device,
      allDevices,
      session,
      onConfigChange,
      allLinks
    );

    // Sequentially apply each pipe filter to the output
    let filteredOutput = baseResult.output;
    for (const part of pipeParts) {
      filteredOutput = applyCliOutputFilter(filteredOutput, part);
    }
    return { output: filteredOutput, newSession: baseResult.newSession };
  }

  // Check help '?'
  if (line.endsWith('?')) {
    const rawPrefix = line.slice(0, -1).trim();
    const trieHelp = commandTrie.getHelp(session.mode, rawPrefix ? rawPrefix.split(/\s+/) : []);
    const helpText = trieHelp.startsWith('%')
      ? getContextHelp(rawPrefix, session.mode, device)
      : trieHelp;
    return { output: helpText, newSession };
  }

  const tokens = line.split(/\s+/);
  const cmd = tokens[0].toLowerCase();

  // Navigation commands across modes
  if (cmd === 'exit') {
    if (session.mode === 'user') {
      return { output: '\n[Connection to device closed]', newSession };
    }
    if (session.mode === 'priv') {
      newSession.mode = 'user';
      return { output: '', newSession };
    }
    if (session.mode === 'config') {
      newSession.mode = 'priv';
      return { output: '', newSession };
    }
    // Submodes back to global config
    newSession.mode = 'config';
    newSession.currentInterface = undefined;
    newSession.currentInterfaceRange = undefined;
    newSession.currentOspfProcess = undefined;
    newSession.currentDhcpPool = undefined;
    newSession.currentVlan = undefined;
    return { output: '', newSession };
  }

  if (cmd === 'end') {
    if (session.mode !== 'user') {
      newSession.mode = 'priv';
      newSession.currentInterface = undefined;
      newSession.currentInterfaceRange = undefined;
      newSession.currentOspfProcess = undefined;
      newSession.currentDhcpPool = undefined;
      newSession.currentVlan = undefined;
    }
    return { output: '', newSession };
  }

  // USER EXEC MODE
  if (session.mode === 'user') {
    if (cmd === 'enable' || cmd === 'en') {
      newSession.mode = 'priv';
      return { output: '', newSession };
    }
    if (cmd === 'ping') {
      const target = tokens[1];
      if (!target) return { output: '% Incomplete command.', newSession };
      return { output: simulateCliPing(target, device, allDevices, allLinks), newSession };
    }
    if (cmd === 'show' || cmd === 'sh') {
      return handleShowCommands(tokens.slice(1), device, allDevices, newSession, allLinks);
    }
    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

  // PRIVILEGED EXEC MODE
  if (session.mode === 'priv') {
    if (cmd === 'disable') {
      newSession.mode = 'user';
      return { output: '', newSession };
    }
    if (
      cmd === 'configure' ||
      cmd === 'conf' ||
      (cmd === 'con' && tokens[1] === 't') ||
      line.startsWith('conf t') ||
      line.startsWith('configure terminal') ||
      line.startsWith('config t')
    ) {
      newSession.mode = 'config';
      return {
        output: 'Enter configuration commands, one per line. End with CNTL/Z.',
        newSession,
      };
    }
    if (
      cmd === 'write' ||
      cmd === 'wr' ||
      cmd === 'copy' ||
      line === 'copy run start' ||
      line.startsWith('copy running-config') ||
      line.startsWith('write memory')
    ) {
      return {
        output: 'Building configuration...\n[OK]',
        newSession,
      };
    }
    if (
      cmd === 'erase' ||
      line.startsWith('write erase') ||
      line.startsWith('erase startup-config') ||
      line.startsWith('erase nvram:')
    ) {
      return {
        output: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]\n[OK]\nErase of nvram: complete\n%SYS-7-NV_BLOCK_INIT: Initialized the geometry of nvram',
        newSession,
      };
    }
    if (cmd === 'clock' && tokens[1] === 'set') {
      return { output: '', newSession };
    }
    if (cmd === 'reload') {
      return {
        output: 'Proceed with reload? [confirm]\nSystem restarted.\nNetT-Sim IOS-Compatible Engine, Version 15.4(3)M2\nReady.',
        newSession,
      };
    }
    if (cmd === 'debug') {
      const sub = tokens.slice(1).join(' ').toLowerCase();
      if (sub === 'ip icmp') {
        newSession.debugFlags = { ...newSession.debugFlags, icmp: true };
        return { output: 'ICMP packet debugging is on', newSession };
      }
      if (sub === 'ip ospf events' || sub === 'ip ospf') {
        newSession.debugFlags = { ...newSession.debugFlags, ospfEvents: true };
        return { output: 'OSPF events debugging is on', newSession };
      }
      if (sub === 'ip ospf adj') {
        newSession.debugFlags = { ...newSession.debugFlags, ospfAdj: true };
        return { output: 'OSPF adjacency debugging is on', newSession };
      }
      if (sub.includes('packet')) {
        return { output: 'IP packet debugging is on (detailed)', newSession };
      }
      if (sub.includes('dhcp')) {
        return { output: 'DHCP server event debugging is on', newSession };
      }
      if (sub.includes('spanning-tree') || sub.includes('stp')) {
        return { output: 'Spanning Tree Protocol debugging is on', newSession };
      }
      if (sub.includes('arp')) {
        return { output: 'ARP packet debugging is on', newSession };
      }
      if (sub === 'all') {
        newSession.debugFlags = { icmp: true, ospfEvents: true, ospfAdj: true };
        return { output: 'All possible debugging has been turned on', newSession };
      }
      return { output: '% Unsupported debug option. Try: debug ip icmp, debug ip ospf events, debug ip packet, or debug all', newSession };
    }

    if (cmd === 'undebug' || cmd === 'un' || (cmd === 'no' && tokens[1] === 'debug')) {
      newSession.debugFlags = {};
      return { output: 'All possible debugging has been turned off', newSession };
    }

    if (cmd === 'terminal' && tokens[1] === 'monitor') {
      newSession.terminalMonitor = true;
      return { output: '% Terminal monitor enabled. Debug logs will be mirrored to this VTY session.', newSession };
    }
    if (cmd === 'terminal' && (tokens[1] === 'no' || tokens[1] === 'n') && tokens[2] === 'monitor') {
      newSession.terminalMonitor = false;
      return { output: '% Terminal monitor disabled.', newSession };
    }

    if (cmd === 'telnet') {
      const target = tokens[1] || '192.168.1.1';
      return {
        output: `Trying ${target} ...Open\n\nUser Access Verification\n\nPassword: `,
        newSession,
      };
    }

    if (cmd === 'ssh') {
      const target = tokens.find((t) => isValidIp(t)) || '192.168.1.1';
      return {
        output: `Open SSH connection to ${target} (port 22)\nPassword: `,
        newSession,
      };
    }

    if (cmd === 'redundancy' && (tokens[1] === 'force-switchover' || tokens[1] === 'switchover')) {
      return {
        output: 'Proceed with switchover to standby stack member? [confirm]\n%RF-5-SWITCHOVER: User triggered stateful switchover (SSO) to Standby Master.\n%STACKMGR-5-SWITCH_ACTIVE: Switch 2 is now the active stack master.\nStandby transition completed with 0 dropped packets.',
        newSession,
      };
    }

    if (cmd === 'clear') {
      const sub = tokens.slice(1).join(' ').toLowerCase();
      if (sub.includes('arp')) {
        config.arpTable = [];
        onConfigChange(config);
        appendDeviceLog(config, '%SYS-5-CLEAR: Dynamic ARP cache cleared.');
        return { output: '[OK] Dynamic ARP cache cleared.', newSession };
      }
      if (sub.includes('mac')) {
        config.macTable = [];
        onConfigChange(config);
        appendDeviceLog(config, '%SYS-5-CLEAR: Dynamic MAC address table purged.');
        return { output: '[OK] Dynamic MAC address table entries purged.', newSession };
      }
      if (sub.includes('logging') || sub.includes('log')) {
        config.loggingBuffer = [];
        onConfigChange(config);
        return { output: 'Clear logging buffer [confirm]\n[OK] Logging buffer cleared.', newSession };
      }
      if (sub.includes('access-list') || sub.includes('acl')) {
        if (config.accessLists) {
          for (const acl of Object.values(config.accessLists)) {
            for (const r of acl.rules) {
              r.matchCount = 0;
            }
          }
          onConfigChange(config);
        }
        return { output: '[OK] Access-list hit counters cleared.', newSession };
      }
      if (sub.includes('ip route')) {
        appendDeviceLog(config, '%ROUTING-5-RESET: IP routing table refreshed.');
        return { output: '[OK] IP routing table refreshed.', newSession };
      }
      if (sub.includes('ip ospf process') || sub.includes('ospf')) {
        appendDeviceLog(config, '%OSPF-5-ADJCHANGE: Process 1, neighbors reset and re-converged.');
        return { output: 'Reset ALL OSPF processes? [no]: yes\n%OSPF-5-ADJCHANGE: Process 1, Nbr 10.0.0.2 on Gi0/0 from FULL to DOWN, Neighbor Down: Interface down or detached\n%OSPF-5-ADJCHANGE: Process 1, Nbr 10.0.0.2 on Gi0/0 from DOWN to INIT\n%OSPF-5-ADJCHANGE: Process 1, Nbr 10.0.0.2 on Gi0/0 from LOADING to FULL, Loading Done', newSession };
      }
      if (sub.includes('counters')) {
        return { output: 'Clear "show interface" counters on all interfaces [confirm]\n[OK] Counters cleared.', newSession };
      }
      if (sub.includes('nat')) {
        if (config.nat) {
          config.nat.translations = [];
          onConfigChange(config);
        }
        return { output: '[OK] Dynamic NAT translations cleared.', newSession };
      }
      return { output: '% Unsupported clear target. Try: clear arp-cache, clear mac address-table dynamic, clear logging, clear ip route *, or clear counters', newSession };
    }

    if (cmd === 'ping') {
      const target = tokens[1];
      if (!target) return { output: '% Incomplete command. Syntax: ping <ip_address> [repeat <count>]', newSession };
      const repeatIdx = tokens.indexOf('repeat');
      const count = repeatIdx !== -1 ? parseInt(tokens[repeatIdx + 1], 10) || 5 : 5;
      return { output: simulateCliPing(target, device, allDevices, allLinks, newSession.debugFlags?.icmp, count), newSession };
    }
    if (cmd === 'traceroute' || cmd === 'trace') {
      const target = tokens[1];
      if (!target) return { output: '% Incomplete command. Syntax: traceroute <ip_address>', newSession };
      return { output: simulateCliTraceroute(target, device, allDevices, allLinks), newSession };
    }
    if (cmd === 'show' || cmd === 'sh') {
      return handleShowCommands(tokens.slice(1), device, allDevices, newSession, allLinks);
    }
    return { output: `% Invalid command: "${line}"`, newSession };
  }

  // GLOBAL CONFIGURATION MODE
  if (session.mode === 'config') {
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

    // crypto key generate rsa
    if (line.startsWith('crypto key generate rsa')) {
      return {
        output: 'The name for the keys will be: ' + (config.hostname || 'Router') + '\n% The key-pair has been generated. Key size: 1024 bits.\n% SSH 1.99 has been enabled',
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

    if (cmd === 'line' && (tokens[1] === 'vty' || tokens[1] === 'con')) {
      newSession.mode = 'config-line';
      return { output: '', newSession };
    }

    if (cmd === 'do') {
      return executeCliCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange
      );
    }

    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

  // INTERFACE CONFIGURATION MODE (config-if) & (config-subif)
  if (session.mode === 'config-if' || session.mode === 'config-subif') {
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

    // spanning-tree portfast / bpduguard
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

    if (cmd === 'do') {
      return executeCliCommand(
        tokens.slice(1).join(' '),
        device,
        allDevices,
        { ...session, mode: 'priv' },
        onConfigChange
      );
    }

    return { output: `% Invalid input detected at '^' marker.`, newSession };
  }

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
      return executeCliCommand(
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
      return executeCliCommand(
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
      return executeCliCommand(
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
      return executeCliCommand(
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
      return executeCliCommand(
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
      return executeCliCommand(
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
      return executeCliCommand(
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

function handleShowCommands(
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
        out += `Holdtime : 142 sec\n\nVersion :\nNetSim IOS-Compatible Engine, Version 15.4(3)M2, RELEASE SIMULATION (fc2)\n-------------------------\n`;
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
        out += `System Description: NetSim IOS-Compatible Engine, Version 15.4(3)M2\n`;
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
    let out = 'Manufacturer\'s Name.............................. NetT-Sim Systems (Educational Emulation)\n';
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
    out += `NetT-Sim IOS-Compatible Engine (Emulated C2900), Software Version 15.4(3)M2\n`;
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
    let out = `NetT-Sim IOS-Compatible Engine (Emulated C2900), Software Version 15.4(3)M2\n`;
    out += `% Notice: NetT-Sim is an educational simulator for CCNA study, not affiliated with Cisco Systems, Inc.\n`;
    out += `ROM: NetT-Sim System Bootstrap, Version 15.0(1r)M16\n\n`;
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

export function generateRunningConfig(device: Device): string {
  const c = device.config;
  let lines: string[] = [
    'Building configuration...',
    '',
    'Current configuration : 1842 bytes',
    '!',
    'version 15.4',
    'no service timestamps log datetime msec',
    'no service password-encryption',
    '!',
    `hostname ${c.hostname}`,
    '!',
  ];

  if (c.enableSecret) {
    lines.push(`enable secret ${c.enableSecret}`);
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

function generateRoutingTableOutput(device: Device, ospfRoutes: OspfRoute[] = []): string {
  let out = 'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP\n';
  out += '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area\n\n';

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

  return out.trimEnd();
}

function resolveHostOrDomain(target: string, device: Device, allDevices: Device[]): { ip: string; resolvedVia?: string } {
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
        const dnsServerIp = device.config.dnsServer || Object.values(d.config.interfaces)[0]?.ip || '192.168.1.10';
        return { ip: record.ip, resolvedVia: `domain server (${dnsServerIp})` };
      }
    }
  }

  return { ip: target };
}

function resolveTarget(
  target: string,
  device: Device,
  allDevices: Device[]
): { ip?: string; log: string; error?: string } {
  if (isValidIp(target)) return { ip: target, log: '' };
  if (device.config.domainLookupEnabled === false) {
    return { log: '', error: '% Unrecognized host or address, or protocol not running.' };
  }
  const res = resolveHostOrDomain(target, device, allDevices);
  if (res.resolvedVia) return { ip: res.ip, log: `Translating "${target}"...${res.resolvedVia} [OK]\n\n` };
  return {
    log: '',
    error: `Translating "${target}"...domain server (${device.config.dnsServer || '255.255.255.255'})\n% Unrecognized host or address, or protocol not running.`,
  };
}

function simulateCliPing(
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

  // Reachability is decided by the same engine that drives the packet animation:
  // L2/VLAN/STP path, routing tables on every hop, ACLs and the return path.
  const result = simulatePing(device.id, resolvedIp, allDevices, allLinks);
  const found = result.success;
  const srcIp =
    Object.values(device.config.interfaces).find((i) => i.ip && i.status === 'up')?.ip || '0.0.0.0';

  let out = `${resolved.log}Type escape sequence to abort.\nSending ${repeat}, 100-byte ICMP Echos to ${resolvedIp}, timeout is 2 seconds:\n`;
  if (debugIcmp) {
    for (let i = 1; i <= Math.min(repeat, 3); i++) {
      out += found
        ? `*Mar 1 00:04:12.${100 + i * 15}: ICMP: echo reply rcvd, src=${resolvedIp}, dst=${srcIp}, seq=${i}\n`
        : `*Mar 1 00:04:12.${100 + i * 15}: ICMP: echo request sent to ${resolvedIp}, timeout expired (${result.error || 'unreachable'})\n`;
    }
  }

  if (found) {
    out += `${'!'.repeat(repeat)}\nSuccess rate is 100 percent (${repeat}/${repeat}), round-trip min/avg/max = 1/2/4 ms`;
  } else {
    // Real IOS prints U when an upstream router answers "destination unreachable", . on silence.
    const unreachable = /no route/i.test(result.error || '');
    out += `${(unreachable ? 'U' : '.').repeat(repeat)}\nSuccess rate is 0 percent (0/${repeat})`;
  }
  return out;
}

function simulateCliTraceroute(target: string, device: Device, allDevices: Device[], allLinks: Link[]): string {
  const resolved = resolveTarget(target, device, allDevices);
  if (!resolved.ip) return resolved.error!;
  const resolvedIp = resolved.ip;

  let out = `${resolved.log}Type escape sequence to abort.\nTracing the route to ${target} (${resolvedIp})\n\n`;
  const result = simulatePing(device.id, resolvedIp, allDevices, allLinks);
  const byId = new Map(allDevices.map((d) => [d.id, d]));

  // Each L3 hop = the ingress interface address of every router on the forward path, then the destination.
  const hops: string[] = [];
  for (const st of result.steps) {
    if (!st.stage.startsWith('ICMP Echo Request')) continue;
    const to = byId.get(st.toDeviceId);
    const ip = to?.config.interfaces[st.toPort]?.ip;
    const routed = to && (to.type.startsWith('router') || to.type === 'firewall' || (to.type === 'l3switch' && to.config.ipRoutingEnabled));
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

function getContextHelp(prefix: string, mode: CliMode, _device: Device): string {
  const pfx = prefix.trim().toLowerCase();

  // Subcommand help
  if (pfx === 'show' || pfx === 'sh') {
    return '  access-lists        List access lists\n  arp                 Arp table\n  cdp                 CDP information (neighbors, detail)\n  clock               Display the system clock\n  dhcp                Dynamic Host Configuration Protocol\n  etherchannel        EtherChannel information\n  flash:              Directory of flash:\n  history             Display the session command history\n  hosts               Display DNS domain and static host table\n  interfaces          Interface status and configuration\n  inventory           Show physical inventory\n  ip                  IP information (route, interface, ospf, bgp, eigrp, nat, dhcp, protocols, sla)\n  ipv6                IPv6 information (interface brief, route)\n  lldp                LLDP information\n  logging             Show logging buffer\n  mac-address-table   MAC address table\n  ntp                 NTP status\n  policy-map          QoS Policy Maps\n  port-security       Port Security status, interface, address\n  processes           Active process statistics (cpu)\n  redundancy          Stateful switchover status\n  running-config      Current operating configuration\n  spanning-tree       Spanning Tree topology & PVST+ details\n  standby             Hot Standby Router Protocol (HSRP)\n  startup-config      Contents of startup configuration (NVRAM)\n  switch              SwitchWise stack details and ring\n  tech-support        Detailed system diagnostic information\n  track               Object tracking status\n  version             System hardware & software status\n  vlan                VLAN information (brief, id, summary)\n  vrrp                VRRP redundancy status\n  vtp                 VTP domain and operational mode';
  }

  if (pfx === 'ip') {
    return '  address             Set the IP address of an interface\n  default-gateway     Specify default gateway (if not routing)\n  dhcp                Configure DHCP server parameters\n  domain-lookup       Enable IP Domain Name System hostname translation\n  domain-name         Define the default domain name\n  helper-address      Specify a destination address for UDP broadcasts\n  host                Define static hostname to IP mapping\n  nat                 Network Address Translation\n  ospf                OSPF interface subcommands\n  route               Establish static routes\n  routing             Enable IP routing\n  sla                 IP SLA synthetic probes\n  ssh                 Configure SSH version';
  }

  if (pfx === 'spanning-tree' || pfx === 'span' || pfx === 'stp') {
    return '  mode                Operating spanning-tree mode (pvst, rapid-pvst, mst)\n  portfast            Spanning Tree PortFast immediate forwarding\n  vlan                VLAN spanning-tree configuration (priority, root primary/secondary)';
  }

  if (pfx === 'debug') {
    return '  all                 Enable all debugging\n  ip icmp             ICMP packet debugging\n  ip ospf             OSPF events and adjacencies\n  ip packet           IP packet debugging\n  ip dhcp             DHCP server events\n  spanning-tree       STP BPDU and topology change debugging\n  arp                 ARP packet debugging';
  }

  if (pfx === 'switchport' || pfx === 'sw') {
    return '  access              Set access mode characteristics of the interface\n  mode                Set trunk or access mode of the interface\n  nonegotiate         Device will not engage in DTP negotiation\n  port-security       Security related command (maximum, mac-address, violation)\n  trunk               Set trunking characteristics of the interface (allowed, native)\n  voice               Configure Voice VLAN for VoIP phones';
  }

  if (pfx === 'router' || pfx === 'ro') {
    return '  bgp                 Border Gateway Protocol (BGP)\n  eigrp               Enhanced Interior Gateway Routing Protocol\n  ospf                Open Shortest Path First (OSPF)\n  rip                 Routing Information Protocol (RIP)';
  }

  if (pfx === 'copy' || pfx === 'cp') {
    return '  running-config      Copy running configuration (e.g. copy run start)\n  startup-config      Copy startup configuration\n  flash:              Copy from flash filesystem\n  tftp:               Copy from TFTP network host';
  }

  if (pfx === 'clear' || pfx === 'clr') {
    return '  arp-cache           Purge dynamic ARP entries\n  counters            Reset interface packet counters\n  ip ospf process     Reset OSPF neighbor adjacencies and SPF recalculation\n  ip route *          Flush routing cache\n  mac address-table   Purge dynamic CAM/MAC table entries\n  nat translations    Flush dynamic NAT translation slots';
  }

  if (pfx === 'vtp') {
    return '  domain              Set VTP administrative domain\n  mode                Set VTP operating mode (server, client, transparent, off)\n  password            Set VTP administrative password';
  }

  if (mode === 'user') {
    return '  enable       Turn on privileged commands\n  ping         Send echo messages (ICMP)\n  show         Show running system information\n  traceroute   Trace route to destination\n  exit         Exit from EXEC mode';
  }
  if (mode === 'priv') {
    return '  clear        Reset functions (arp, mac, ip route, ospf, counters)\n  clock        Manage the system clock (clock set)\n  configure    Enter configuration mode (terminal)\n  copy         Copy from one file to another (copy run start)\n  debug        Debugging functions (debug ip icmp, debug ip ospf)\n  disable      Turn off privileged commands\n  erase        Erase a filesystem (erase startup-config)\n  ping         Send echo messages\n  redundancy   Force SSO switchover\n  reload       Halt and perform a cold restart\n  show         Show running system information\n  ssh          Open a secure shell client connection\n  telnet       Open a telnet connection\n  terminal     Set terminal line parameters (terminal monitor)\n  traceroute   Trace route to destination\n  undebug      Disable debugging functions (undebug all)\n  write        Write running configuration to memory (wr mem)\n  exit         Exit from EXEC mode';
  }
  if (mode === 'config') {
    return '  access-list  Add an access list entry (standard / extended)\n  banner       Define a login banner (motd)\n  cdp          Global CDP configuration subcommands (cdp run)\n  class-map    Configure QoS classification match criteria\n  crypto       Encryption subsystem (crypto key generate rsa)\n  do           To run exec commands in config mode\n  enable       Modify enable password parameters (secret / password)\n  end          Exit from configure mode to Privileged EXEC\n  exit         Exit from configure mode\n  feature      NX-OS feature enablement (ospf, vpc, lldp, lacp)\n  hostname     Set system network name\n  interface    Select an interface to configure\n  ip           Global IP configuration subcommands (route, routing, dhcp, nat, sla)\n  ipv6         Global IPv6 configuration subcommands (unicast-routing, route)\n  line         Configure a terminal line (console, vty)\n  lldp         Global LLDP configuration subcommands (lldp run)\n  monitor      Configure SPAN port mirroring sessions\n  no           Negate a command or set its defaults\n  ntp          Configure NTP server time synchronization\n  policy-map   Configure QoS policy map service classes\n  router       Enable a routing process (ospf, bgp, eigrp, rip)\n  service      Modify use of network based services (password-encryption)\n  spanning-tree Spanning Tree Subsystem (vlan priority, mode, portfast)\n  switch       SwitchWise stack configuration (priority, provision)\n  track        Object tracking configuration for IP SLA\n  username     Establish User Name Authentication\n  vlan         Vlan configuration commands (1-4094)\n  vtp          Global VTP configuration commands\n  wlan         WLC Wireless LAN configuration';
  }
  if (mode === 'config-if' || mode === 'config-subif') {
    return '  cdp          CDP interface subcommands (cdp enable)\n  channel-group Add this interface to an EtherChannel bundle\n  description  Interface specific description label\n  duplex       Configure duplex operation (auto, full, half)\n  encapsulation Set encapsulation type for an interface (dot1Q)\n  glbp         GLBP gateway load balancing configuration\n  ip           Interface Internet Protocol config commands (address, helper-address, ospf, nat)\n  ipv6         Interface IPv6 config commands (address, autoconfig)\n  lldp         LLDP interface subcommands\n  nameif       ASA Firewall: Assign interface zone\n  no           Negate a command or set its defaults (no shutdown, no switchport)\n  security-level ASA Firewall: Assign security level (0-100)\n  service-policy Attach QoS policy map (input / output)\n  shutdown     Shutdown the selected interface\n  speed        Configure speed operation (10, 100, 1000, auto)\n  standby      HSRP interface configuration commands (ip, priority, preempt)\n  switchport   Set switching mode characteristics (access, trunk, vlan, port-security, voice)\n  tunnel       Configure GRE VPN tunnel parameters (source, destination, mode)\n  vrrp         VRRP interface redundancy commands\n  exit         Exit from interface configuration mode\n  end          Return directly to privileged exec mode\n  do           To run exec commands';
  }
  if (mode === 'config-router') {
    return '  auto-summary        Automatic network number summarization\n  default-information Control distribution of default information (originate)\n  neighbor            BGP neighbor IP and remote-as\n  network             Enable routing on an IP network\n  passive-interface   Suppress routing updates on an interface\n  router-id           OSPF/BGP router-id in IP address format\n  version             RIP protocol version (1 or 2)\n  exit                Exit from router configuration mode\n  end                 Return directly to privileged exec mode\n  do                  To run exec commands';
  }
  if (mode === 'config-dhcp') {
    return '  default-router      Default routers\n  dns-server          DNS servers\n  domain-name         Domain name\n  network             Network number and mask\n  exit                Exit from DHCP pool configuration mode\n  end                 Return directly to privileged exec mode\n  do                  To run exec commands';
  }
  if (mode === 'config-vlan') {
    return '  name                Ascii name of the VLAN\n  exit                Exit from VLAN configuration mode\n  end                 Return directly to privileged exec mode\n  do                  To run exec commands';
  }
  if (mode === 'config-line') {
    return '  exec-timeout        Set the EXEC timeout (minutes seconds)\n  logging             Modify message logging facilities (synchronous)\n  login               Enable password checking (or login local)\n  password            Set line access password\n  transport           Define transport protocols for line (input ssh, all)\n  exit                Exit from line configuration mode\n  end                 Return directly to privileged exec mode\n  do                  To run exec commands';
  }
  return '  exit         Exit current configuration mode\n  end          Return to privileged exec mode';
}
