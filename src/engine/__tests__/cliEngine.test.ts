import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCliSession,
  executeCliCommand,
  getPrompt,
  commandTrie,
} from '../cliEngine';
import { createDevice } from '../deviceSpecs';
import { Device, Link, DeviceConfig } from '../../types/network';

describe('Hierarchical Command Trie & CLI Engine', () => {
  let router: Device;
  let switchDev: Device;
  let allDevices: Device[];
  let allLinks: Link[];
  let onConfigChange: (cfg: DeviceConfig) => void;

  beforeEach(() => {
    router = createDevice('router', 'R1-Edge', 100, 100);
    switchDev = createDevice('switch', 'SW1-Core', 300, 100);
    allDevices = [router, switchDev];
    allLinks = [
      { id: 'l1', fromDevice: router.id, fromPort: 'Gi0/0', toDevice: switchDev.id, toPort: 'Gi0/1', cable: 'straight' },
    ];
    onConfigChange = (cfg: DeviceConfig) => {
      router.config = cfg;
    };
  });

  describe('CommandTrie Prefix & Modal Resolution', () => {
    it('resolves unique prefixes to root commands', () => {
      const match = commandTrie.matchNode('sh', [
        { name: 'show', description: '', modes: ['user', 'priv'] },
        { name: 'ping', description: '', modes: ['user', 'priv'] },
      ]);
      expect(match.node).toBeDefined();
      expect(match.node?.name).toBe('show');
    });

    it('identifies ambiguous prefixes', () => {
      const match = commandTrie.matchNode('s', [
        { name: 'show', description: '', modes: ['user'] },
        { name: 'set', description: '', modes: ['user'] },
      ]);
      expect(match.isAmbiguous).toBe(true);
      expect(match.matches).toContain('show');
      expect(match.matches).toContain('set');
    });

    it('generates contextual ? help for user mode', () => {
      const help = commandTrie.getHelp('user');
      expect(help).toContain('enable');
      expect(help).toContain('ping');
      expect(help).toContain('show');
      expect(help).not.toContain('configure'); // configure is priv/config only
    });

    it('generates contextual ? help for config-if mode', () => {
      const help = commandTrie.getHelp('config-if');
      expect(help).toContain('ip');
      expect(help).toContain('shutdown');
      expect(help).toContain('switchport');
    });
  });

  describe('Modal Hierarchy & Transitions', () => {
    it('transitions smoothly from user to priv mode', () => {
      let session = createCliSession();
      expect(getPrompt(router, session)).toBe('R1-Edge>');

      const res = executeCliCommand('enable', router, allDevices, session, onConfigChange, allLinks);
      session = res.newSession;
      expect(session.mode).toBe('priv');
      expect(getPrompt(router, session)).toBe('R1-Edge#');
    });

    it('supports shorthand "en" and "conf t"', () => {
      let session = createCliSession();
      session = executeCliCommand('en', router, allDevices, session, onConfigChange, allLinks).newSession;
      expect(session.mode).toBe('priv');

      session = executeCliCommand('conf t', router, allDevices, session, onConfigChange, allLinks).newSession;
      expect(session.mode).toBe('config');
      expect(getPrompt(router, session)).toBe('R1-Edge(config)#');
    });

    it('enters interface sub-mode and configures IP address', () => {
      let session = createCliSession();
      session = executeCliCommand('enable', router, allDevices, session, onConfigChange, allLinks).newSession;
      session = executeCliCommand('configure terminal', router, allDevices, session, onConfigChange, allLinks).newSession;

      const ifRes = executeCliCommand('interface GigabitEthernet0/0', router, allDevices, session, onConfigChange, allLinks);
      session = ifRes.newSession;
      expect(session.mode).toBe('config-if');
      expect(session.currentInterface).toBe('Gi0/0');
      expect(getPrompt(router, session)).toBe('R1-Edge(config-if)#');

      // Configure IP
      executeCliCommand('ip address 192.168.1.1 255.255.255.0', router, allDevices, session, onConfigChange, allLinks);
      expect(router.config.interfaces['Gi0/0'].ip).toBe('192.168.1.1');
      expect(router.config.interfaces['Gi0/0'].mask).toBe('255.255.255.0');

      // No shutdown
      executeCliCommand('no shutdown', router, allDevices, session, onConfigChange, allLinks);
      expect(router.config.interfaces['Gi0/0'].status).toBe('up');
    });

    it('enters router ospf sub-mode and adds network statement', () => {
      let session = createCliSession();
      session = executeCliCommand('enable', router, allDevices, session, onConfigChange, allLinks).newSession;
      session = executeCliCommand('configure terminal', router, allDevices, session, onConfigChange, allLinks).newSession;

      const rRes = executeCliCommand('router ospf 1', router, allDevices, session, onConfigChange, allLinks);
      session = rRes.newSession;
      expect(session.mode).toBe('config-router');
      expect(session.currentOspfProcess).toBe(1);
      expect(getPrompt(router, session)).toBe('R1-Edge(config-router)#');

      // Add network
      executeCliCommand('network 192.168.1.0 0.0.0.255 area 0', router, allDevices, session, onConfigChange, allLinks);
      expect(router.config.ospf?.networks.some((n) => n.network === '192.168.1.0' && n.area === 0)).toBe(true);
    });

    it('exits sub-modes hierarchically back to global config then priv', () => {
      let session = createCliSession();
      session = executeCliCommand('enable', router, allDevices, session, onConfigChange, allLinks).newSession;
      session = executeCliCommand('configure terminal', router, allDevices, session, onConfigChange, allLinks).newSession;
      session = executeCliCommand('interface Gi0/0', router, allDevices, session, onConfigChange, allLinks).newSession;

      expect(session.mode).toBe('config-if');

      // exit from interface -> config
      session = executeCliCommand('exit', router, allDevices, session, onConfigChange, allLinks).newSession;
      expect(session.mode).toBe('config');

      // exit from config -> priv
      session = executeCliCommand('exit', router, allDevices, session, onConfigChange, allLinks).newSession;
      expect(session.mode).toBe('priv');

      // exit from priv -> user
      session = executeCliCommand('exit', router, allDevices, session, onConfigChange, allLinks).newSession;
      expect(session.mode).toBe('user');
    });
  });

  describe('Legal Branding & Show Output Safety', () => {
    it('outputs NetT-Sim educational banner on reload', () => {
      let session = createCliSession();
      session = executeCliCommand('enable', router, allDevices, session, onConfigChange, allLinks).newSession;
      const reloadRes = executeCliCommand('reload', router, allDevices, session, onConfigChange, allLinks);
      expect(reloadRes.output).toContain('NetT-Sim');
      expect(reloadRes.output).not.toContain('NetSim IOS');
    });

    it('outputs legal nominative fair use notice on show version', () => {
      let session = createCliSession();
      session = executeCliCommand('enable', router, allDevices, session, onConfigChange, allLinks).newSession;
      const verRes = executeCliCommand('show version', router, allDevices, session, onConfigChange, allLinks);
      expect(verRes.output).toContain('NetT-Sim');
      expect(verRes.output).toContain('educational simulator');
      expect(verRes.output).toContain('not affiliated with Cisco Systems, Inc.');
    });
  });
});
