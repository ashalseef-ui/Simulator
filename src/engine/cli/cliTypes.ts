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
  currentInterfaceRange?: string[];
  currentOspfProcess?: number;
  currentBgpAsn?: number;
  currentEigrpAs?: number;
  currentDhcpPool?: string;
  currentVlan?: number;
  currentAcl?: string;
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
