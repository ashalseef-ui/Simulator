import { Device, Link } from '../../types/network';

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
  | 'config-line'
  | 'config-std-nacl'
  | 'config-ext-nacl';

export interface CliSession {
  mode: CliMode;
  currentInterface?: string;
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

export interface CliExecutionResult {
  output: string;
  newSession: CliSession;
}

export interface CommandContext {
  device: Device;
  session: CliSession;
  allDevices: Device[];
  allLinks: Link[];
  rawLine: string;
}

export interface CommandNode {
  name: string;
  aliases?: string[];
  description: string;
  modes: CliMode[];
  children?: CommandNode[];
  execute?: (args: string[], ctx: CommandContext) => CliExecutionResult;
}
