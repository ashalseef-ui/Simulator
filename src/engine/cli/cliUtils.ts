import { Device, DeviceConfig, Link } from '../../types/network';

/**
 * Normalizes interface names like g0/0 -> GigabitEthernet0/0, fa0/1 -> FastEthernet0/1, se0/0/0 -> Serial0/0/0
 */
export function normalizeInterfaceName(
  input: string,
  availableInterfaces: Record<string, any>
): string | null {
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
export function getLiveMacTable(
  device: Device,
  allDevices: Device[],
  allLinks: Link[]
): { vlan: number; mac: string; type: 'DYNAMIC' | 'STATIC'; port: string }[] {
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
export function getLiveArpTable(
  device: Device,
  allDevices: Device[],
  allLinks: Link[]
): { ip: string; mac: string; port: string }[] {
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
