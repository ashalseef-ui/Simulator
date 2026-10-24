import { Device, DeviceConfig, Link } from '../types/network';
import { isValidIp } from '../utils/ipUtils';
import { CommandTrie } from './cli/commandTrie';
import { COMMAND_TREE_REGISTRY } from './cli/commandTreeRegistry';
import {
  getMultiVendorPrompt,
  executeJunosCommand,
  executeAristaCommand,
  executeLinuxCommand,
  executeMikrotikCommand,
} from './cli/multiVendorEngines';
import { deepClone } from '../utils/deepClone';
import { handleCliEasterEggs, CCNA_TIPS } from './cli/cliEasterEggs';
import { getContextHelp } from './cli/cliHelp';
import {
  resolveHostOrDomain,
  resolveTarget,
  simulateCliPing,
  simulateCliTraceroute,
} from './cli/cliDiagnostics';

// Re-export CLI types, utils, and generators for external consumers
export type { CliMode, CliSession } from './cli/cliTypes';
export { createCliSession } from './cli/cliTypes';
export {
  normalizeInterfaceName,
  parseInterfaceRange,
  appendDeviceLog,
  getLiveMacTable,
  getLiveArpTable,
  formatInvalidInputCaret,
  applyCliOutputFilter,
} from './cli/cliUtils';
export {
  generateRunningConfig,
  generateRoutingTableOutput,
} from './cli/cliRunningConfig';
export {
  handleCliEasterEggs,
  CCNA_TIPS,
  getContextHelp,
  simulateCliPing,
  simulateCliTraceroute,
  resolveTarget,
  resolveHostOrDomain,
};

import { CliSession } from './cli/cliTypes';
import { applyCliOutputFilter, appendDeviceLog } from './cli/cliUtils';
import { handleShowCommands } from './cli/cliShowCommands';
import { handleConfigGlobalCommand } from './cli/modes/cliConfigGlobalMode';
import { handleConfigIfCommand } from './cli/modes/cliConfigIfMode';
import { handleConfigRouterModes } from './cli/modes/cliConfigRouterModes';

export const commandTrie = new CommandTrie();
commandTrie.registerAll(COMMAND_TREE_REGISTRY);

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
    case 'config-std-nacl':
      return `${host}(config-std-nacl)#`;
    case 'config-ext-nacl':
      return `${host}(config-ext-nacl)#`;
    default:
      return `${host}>`;
  }
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
  const config: DeviceConfig = deepClone(device.config);

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

  // Check if command uses pipe output redirection
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

  // CLI Easter Eggs
  const easterEggResult = handleCliEasterEggs(line);
  if (easterEggResult !== null) {
    return { output: easterEggResult, newSession };
  }

  // Navigation commands across modes
  if (cmd === 'logout') {
    newSession.mode = 'user';
    newSession.currentInterface = undefined;
    newSession.currentInterfaceRange = undefined;
    newSession.currentOspfProcess = undefined;
    newSession.currentDhcpPool = undefined;
    newSession.currentVlan = undefined;
    newSession.currentAcl = undefined;
    return { output: '\n[Connection to device closed]', newSession };
  }

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
    newSession.currentAcl = undefined;
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
      newSession.currentAcl = undefined;
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
    if (cmd === 'traceroute' || cmd === 'trace') {
      const target = tokens[1];
      if (!target) return { output: '% Incomplete command.', newSession };
      return { output: simulateCliPing(target, device, allDevices, allLinks), newSession };
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
        output: 'Proceed with reload? [confirm]\nSystem restarted.\nWireCraft IOS-Compatible Engine, Version 15.4(3)M2\nReady.',
        newSession,
      };
    }
    if (cmd === 'dir' || line.startsWith('dir')) {
      return handleShowCommands(['flash'], device, allDevices, newSession, allLinks);
    }
    if (cmd === 'mkdir') {
      const dirName = tokens[1] || 'new_dir';
      return {
        output: `Create directory filename [${dirName}]?\nCreated dir flash:/${dirName}`,
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

  // GLOBAL CONFIGURATION MODE (config)
  if (session.mode === 'config') {
    return handleConfigGlobalCommand(
      line,
      cmd,
      tokens,
      cmd === 'no',
      device,
      allDevices,
      config,
      session,
      newSession,
      onConfigChange,
      allLinks,
      executeCliCommand
    );
  }

  // INTERFACE CONFIGURATION MODE (config-if) & (config-subif)
  if (session.mode === 'config-if' || session.mode === 'config-subif') {
    return handleConfigIfCommand(
      line,
      cmd,
      tokens,
      cmd === 'no',
      device,
      allDevices,
      config,
      session,
      newSession,
      onConfigChange,
      allLinks,
      executeCliCommand
    );
  }

  // ROUTER, DHCP, VLAN, LINE, ACL CONFIGURATION MODES
  return handleConfigRouterModes(
    line,
    cmd,
    tokens,
    cmd === 'no',
    device,
    allDevices,
    config,
    session,
    newSession,
    onConfigChange,
    allLinks,
    executeCliCommand
  );
}
