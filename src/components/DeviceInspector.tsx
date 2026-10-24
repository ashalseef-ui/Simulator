import React, { useState, useEffect, useRef } from 'react';
import {
  Device,
  DeviceConfig,
  DeviceWindowState,
  Link,
  NetworkOsType,
} from '../types/network';
import { DEVICE_SPECS } from '../engine/deviceSpecs';
import {
  createCliSession,
  executeCliCommand,
  getPrompt,
  CliSession,
  generateRunningConfig,
} from '../engine/cliEngine';
import { VENDOR_OS_PROFILES } from '../engine/cli/multiVendorEngines';
import {
  Terminal,
  Settings,
  Monitor,
  Server,
  Minus,
  Maximize2,
  Minimize2,
  X,
  Globe,
  Box,
  Sparkles,
  Copy,
  Trash2,
  Loader2,
  Layers,
  Shield,
  BookOpen,
  Network,
  Tv,
} from 'lucide-react';
import { audioEngine } from '../utils/audioEffects';
import { DeviceFrontPanel } from './DeviceFrontPanel';
import { StackingView } from './StackingView';
import { ProtocolsDashboard } from './ProtocolsDashboard';
import { CommandReferenceModal } from './CommandReferenceModal';
import { DesktopAppsTab } from './inspector/DesktopAppsTab';
import { ServicesTab } from './inspector/ServicesTab';
import { DeviceConfigTab } from './inspector/DeviceConfigTab';
import { CliTerminalTab } from './inspector/CliTerminalTab';
import { isValidIp } from '../utils/ipUtils';

interface DeviceInspectorProps {
  device: Device;
  allDevices: Device[];
  allLinks?: Link[];
  windowState: DeviceWindowState;
  onUpdateWindowState: (id: string, updates: Partial<DeviceWindowState>) => void;
  onClose: (id: string) => void;
  onUpdateDeviceConfig: (deviceId: string, config: DeviceConfig) => void;
  onRunPingSim: (srcDeviceId: string, dstIp: string) => void;
  onRunDhcpSim: (clientDeviceId: string) => void;
}

export const DeviceInspector: React.FC<DeviceInspectorProps> = ({
  device,
  allDevices,
  allLinks = [],
  windowState,
  onUpdateWindowState,
  onClose,
  onUpdateDeviceConfig,
  onRunPingSim,
  onRunDhcpSim,
}) => {
  const spec = DEVICE_SPECS[device.type];
  const isSwitchDevice =
    spec.category === 'Switches' ||
    device.type === 'switch' ||
    device.type === 'switch3560' ||
    device.type === 'l3switch' ||
    device.type === 'nexus9000';

  const [activeTab, setActiveTab] = useState<'physical' | 'cli' | 'config' | 'desktop' | 'services' | 'stacking' | 'protocols'>(
    (windowState.activeTab as any) || (spec.supportsCli ? 'cli' : spec.supportsDesktop ? 'desktop' : 'physical')
  );
  const [selectedPhysicalPort, setSelectedPhysicalPort] = useState<string | null>(null);

  // Dragging window state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Resizing window state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // CLI Terminal state
  const [cliSession, setCliSession] = useState<CliSession>(createCliSession());
  const [terminalThemeMode, setTerminalThemeMode] = useState<'vendor' | 'matrix' | 'amber' | 'cyber' | 'c64'>('vendor');
  const [showScanlines, setShowScanlines] = useState<boolean>(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>(() => {
    if (device.type === 'firewall' || device.type === 'firepower') {
      return [
        `WireCraft ASA/Firepower Emulated Security Appliance, Software Version 9.8(2)`,
        `Device: Emulated ASA 5506-X Platform`,
        `% Educational simulation - Not affiliated with Cisco Systems, Inc.`,
        ``,
        `Type 'enable' to enter privileged mode.`,
        ``,
      ];
    }
    if (device.type === 'nexus9000') {
      return [
        `WireCraft NX-OS-Compatible Switch Engine, Version 9.3(5)`,
        `% Educational simulation - Not affiliated with Cisco Systems, Inc.`,
        ``,
        `Press RETURN or type 'enable' to get started!`,
        ``,
      ];
    }
    if (device.type === 'wlc') {
      return [
        `WireCraft AireOS-Compatible Controller Emulation, Version 8.5.151.0`,
        `Device: Emulated 3504 Wireless LAN Controller`,
        `% Educational simulation - Not affiliated with Cisco Systems, Inc.`,
        ``,
        `Press RETURN to start session.`,
        ``,
      ];
    }
    if (isSwitchDevice) {
      return [
        `WireCraft Catalyst-Compatible Switch Engine, Software Version 17.3(4)`,
        `% Educational simulation - Not affiliated with Cisco Systems, Inc.`,
        ``,
        `Press RETURN or type 'enable' to get started!`,
        ``,
      ];
    }
    return [
      `WireCraft IOS-Compatible Router Engine (Emulated C2900), Software Version 15.4(3)M2`,
      `% Educational simulation - Not affiliated with Cisco Systems, Inc.`,
      ``,
      `Press RETURN or type 'enable' to get started!`,
      ``,
    ];
  });
  const [cliInput, setCliInput] = useState('');
  const [isCommandReferenceOpen, setIsCommandReferenceOpen] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (activeTab === 'cli') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalOutput, activeTab]);

  // Window Drag Handlers
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (windowState.maximized) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - windowState.x,
      y: e.clientY - windowState.y,
    });
    onUpdateWindowState(windowState.id, { zIndex: Date.now() });
  };

  // Window Resize Handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: windowState.width,
      height: windowState.height,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        onUpdateWindowState(windowState.id, {
          x: Math.max(0, e.clientX - dragStart.x),
          y: Math.max(40, e.clientY - dragStart.y),
        });
      }
      if (isResizing) {
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;
        onUpdateWindowState(windowState.id, {
          width: Math.max(450, resizeStart.width + dx),
          height: Math.max(350, resizeStart.height + dy),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, windowState.id, onUpdateWindowState]);

  // Handle CLI Command Enter
  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    audioEngine.playKeyClick();
    const cmd = cliInput;
    const prompt = getPrompt(device, cliSession);
    const newLines = [...terminalOutput, `${prompt} ${cmd}`];

    const result = executeCliCommand(
      cmd,
      device,
      allDevices,
      cliSession,
      (newConfig) => onUpdateDeviceConfig(device.id, newConfig),
      allLinks
    );

    if (result.output) {
      newLines.push(result.output);

      // Play ping blips or buzzes if command was ping
      if (cmd.trim().toLowerCase().startsWith('ping')) {
        if (result.output.includes('!') || result.output.includes('Reply from') || result.output.includes('Success rate is 100') || result.output.includes('Success rate is 80')) {
          audioEngine.playPing(true);
        } else if (result.output.includes('.....') || result.output.includes('Request timed out') || result.output.includes('packet loss')) {
          audioEngine.playPing(false);
        }
      }
    }

    setTerminalOutput(newLines);
    setCliSession(result.newSession);
    setCliInput('');
  };

  // Handle CLI Keydown (History navigation, Ctrl+C/Ctrl+Z breaks & Tab auto-complete)
  const handleCliKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+C: Cancel current line or break out of config submodes
    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      const prompt = getPrompt(device, cliSession);
      const isSubmode = cliSession.mode !== 'user' && cliSession.mode !== 'priv';
      const updatedSession: CliSession = isSubmode
        ? {
            ...cliSession,
            mode: 'priv',
            currentInterface: undefined,
            currentVlan: undefined,
            currentAcl: undefined,
            currentOspfProcess: undefined,
            currentBgpAsn: undefined,
          }
        : cliSession;
      setTerminalOutput((prev) => [...prev, `${prompt} ${cliInput}^C`]);
      setCliSession(updatedSession);
      setCliInput('');
      return;
    }

    // Ctrl+Z: Cisco IOS end command equivalent
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      const prompt = getPrompt(device, cliSession);
      const isConfig = cliSession.mode !== 'user' && cliSession.mode !== 'priv';
      const updatedSession: CliSession = isConfig
        ? {
            ...cliSession,
            mode: 'priv',
            currentInterface: undefined,
            currentVlan: undefined,
            currentAcl: undefined,
            currentOspfProcess: undefined,
            currentBgpAsn: undefined,
          }
        : cliSession;
      const lines = [`${prompt} ${cliInput}^Z`];
      if (isConfig) {
        lines.push('%SYS-5-CONFIG_I: Configured from console by console');
      }
      setTerminalOutput((prev) => [...prev, ...lines]);
      setCliSession(updatedSession);
      setCliInput('');
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cliSession.history.length > 0) {
        const nextIdx = Math.max(0, cliSession.historyIndex - 1);
        setCliInput(cliSession.history[nextIdx] || '');
        setCliSession({ ...cliSession, historyIndex: nextIdx });
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cliSession.history.length > 0) {
        const nextIdx = Math.min(cliSession.history.length, cliSession.historyIndex + 1);
        if (nextIdx === cliSession.history.length) {
          setCliInput('');
        } else {
          setCliInput(cliSession.history[nextIdx] || '');
        }
        setCliSession({ ...cliSession, historyIndex: nextIdx });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const current = cliInput.trim();
      // Handle pipe autocompletion e.g. "show run | inc" -> "show run | include"
      const pipeIdx = cliInput.indexOf('|');
      if (pipeIdx !== -1) {
        const prePipe = cliInput.slice(0, pipeIdx + 1);
        const postPipe = cliInput.slice(pipeIdx + 1).trim();
        const pipeModifiers: Record<string, string> = {
          'i': 'include ',
          'inc': 'include ',
          'e': 'exclude ',
          'ex': 'exclude ',
          'exc': 'exclude ',
          'b': 'begin ',
          'beg': 'begin ',
          's': 'section ',
          'sec': 'section ',
          'c': 'count',
        };
        if (pipeModifiers[postPipe.toLowerCase()]) {
          setCliInput(`${prePipe} ${pipeModifiers[postPipe.toLowerCase()]}`);
          return;
        }
      }

      // Tab autocomplete dictionary for comprehensive Cisco IOS commands
      const completions: Record<string, string> = {
        // Mode transitions
        'en': 'enable',
        'dis': 'disable',
        'conf': 'configure terminal',
        'conf t': 'configure terminal',
        'config': 'configure terminal',
        'config t': 'configure terminal',
        'wr': 'write memory',
        'wr m': 'write memory',
        'wr mem': 'write memory',
        'wr er': 'write erase',
        'copy run start': 'copy running-config startup-config',
        'cp run start': 'copy running-config startup-config',
        'erase start': 'erase startup-config',
        'rel': 'reload',

        // Show commands
        'sh': 'show',
        'sh run': 'show running-config',
        'sh start': 'show startup-config',
        'sh ip int br': 'show ip interface brief',
        'sh ip int': 'show ip interface brief',
        'sh ip ro': 'show ip route',
        'sh ip route': 'show ip route',
        'sh ip proto': 'show ip protocols',
        'sh ip protocols': 'show ip protocols',
        'sh ip ospf nei': 'show ip ospf neighbor',
        'sh ip ospf int': 'show ip ospf interface',
        'sh ip ospf data': 'show ip ospf database',
        'sh ip bgp sum': 'show ip bgp summary',
        'sh ip bgp nei': 'show ip bgp neighbors',
        'sh ip eigrp nei': 'show ip eigrp neighbors',
        'sh ip nat trans': 'show ip nat translations',
        'sh ip nat stat': 'show ip nat statistics',
        'sh ip dhcp bind': 'show ip dhcp binding',
        'sh ip dhcp snoop': 'show ip dhcp snooping',
        'sh mac': 'show mac address-table',
        'sh mac-address-table': 'show mac address-table',
        'sh vlan': 'show vlan brief',
        'sh vl': 'show vlan brief',
        'sh vlan br': 'show vlan brief',
        'sh span': 'show spanning-tree',
        'sh spanning-tree': 'show spanning-tree',
        'sh cdp nei': 'show cdp neighbors',
        'sh cdp nei det': 'show cdp neighbors detail',
        'sh lldp nei': 'show lldp neighbors',
        'sh lldp nei det': 'show lldp neighbors detail',
        'sh int status': 'show interfaces status',
        'sh int desc': 'show interfaces description',
        'sh int trunk': 'show interfaces trunk',
        'sh int switchport': 'show interfaces switchport',
        'sh port-sec': 'show port-security',
        'sh port-security': 'show port-security',
        'sh port-sec int': 'show port-security interface',
        'sh ether sum': 'show etherchannel summary',
        'sh etherchannel': 'show etherchannel summary',
        'sh standby': 'show standby brief',
        'sh standby br': 'show standby brief',
        'sh hsrp': 'show standby brief',
        'sh vrrp': 'show vrrp brief',
        'sh glbp': 'show glbp brief',
        'sh arp': 'show arp',
        'sh hosts': 'show hosts',
        'sh vtp stat': 'show vtp status',
        'sh ver': 'show version',
        'sh version': 'show version',
        'sh acl': 'show access-lists',
        'sh access-list': 'show access-lists',
        'sh clock': 'show clock',
        'sh hist': 'show history',
        'sh log': 'show logging',
        'sh proc cpu': 'show processes cpu',
        'sh mem': 'show memory',
        'sh tech': 'show tech-support',
        'sh switch': 'show switch detail',
        'sh red': 'show redundancy',
        'sh ntp stat': 'show ntp status',
        'sh track': 'show track',

        // Global Configuration commands
        'host': 'hostname ',
        'hostname': 'hostname ',
        'int': 'interface ',
        'int g0/0': 'interface GigabitEthernet0/0',
        'int g0/1': 'interface GigabitEthernet0/1',
        'int fa0/1': 'interface FastEthernet0/1',
        'int range': 'interface range ',
        'ip rout': 'ip routing',
        'ip routing': 'ip routing',
        'ip route': 'ip route ',
        'ip def': 'ip default-gateway ',
        'ip default-gateway': 'ip default-gateway ',
        'ip dhcp pool': 'ip dhcp pool ',
        'ip dhcp excl': 'ip dhcp excluded-address ',
        'ip domain-name': 'ip domain-name ',
        'ip name-server': 'ip name-server ',
        'ip host': 'ip host ',
        'ip ssh ver': 'ip ssh version 2',
        'ipv6 uni': 'ipv6 unicast-routing',
        'ipv6 unicast-routing': 'ipv6 unicast-routing',
        'ipv6 route': 'ipv6 route ',
        'crypto key gen rsa': 'crypto key generate rsa',
        'line con': 'line console 0',
        'line vty': 'line vty 0 4',
        'ro ospf': 'router ospf 1',
        'router ospf': 'router ospf 1',
        'ro bgp': 'router bgp ',
        'ro eigrp': 'router eigrp 100',
        'ro rip': 'router rip',
        'span mode pvst': 'spanning-tree mode pvst',
        'span mode rapid': 'spanning-tree mode rapid-pvst',
        'span vlan 1 prio': 'spanning-tree vlan 1 priority 4096',
        'span vlan 1 root pri': 'spanning-tree vlan 1 root primary',
        'span vlan 1 root sec': 'spanning-tree vlan 1 root secondary',
        'span portfast def': 'spanning-tree portfast default',
        'vlan': 'vlan ',
        'vtp mode': 'vtp mode transparent',
        'user': 'username admin secret cisco',
        'en sec': 'enable secret cisco',
        'service pass': 'service password-encryption',
        'banner motd': 'banner motd # Authorized Access Only #',

        // Interface subcommands
        'ip add': 'ip address ',
        'ip address': 'ip address ',
        'ip helper': 'ip helper-address ',
        'ip ospf cost': 'ip ospf cost 10',
        'ip ospf prio': 'ip ospf priority 100',
        'no shut': 'no shutdown',
        'no shutdown': 'no shutdown',
        'shut': 'shutdown',
        'shutdown': 'shutdown',
        'sw': 'switchport',
        'sw mode': 'switchport mode ',
        'sw mode acc': 'switchport mode access',
        'sw mode trunk': 'switchport mode trunk',
        'sw acc vl': 'switchport access vlan ',
        'sw access vlan': 'switchport access vlan ',
        'sw trunk all vl': 'switchport trunk allowed vlan ',
        'sw trunk allowed vlan': 'switchport trunk allowed vlan ',
        'sw trunk native vlan': 'switchport trunk native vlan ',
        'sw voice vlan': 'switchport voice vlan ',
        'sw port-sec': 'switchport port-security',
        'sw port-security': 'switchport port-security',
        'sw port-sec max': 'switchport port-security maximum 2',
        'sw port-sec mac sticky': 'switchport port-security mac-address sticky',
        'sw port-sec viol shut': 'switchport port-security violation shutdown',
        'encap dot': 'encapsulation dot1Q ',
        'encapsulation dot1q': 'encapsulation dot1Q ',
        'chan': 'channel-group 1 mode active',
        'channel-group': 'channel-group 1 mode active',
        'standby ip': 'standby 1 ip ',
        'standby prio': 'standby 1 priority 110',
        'standby preempt': 'standby 1 preempt',
        'desc': 'description ',
        'description': 'description ',
        'speed': 'speed 1000',
        'duplex': 'duplex full',

        // Router subcommands
        'net': 'network ',
        'network': 'network ',
        'router-id': 'router-id ',
        'passive': 'passive-interface ',
        'def-info': 'default-information originate',
        'default-information originate': 'default-information originate',
        'no auto': 'no auto-summary',
        'no auto-summary': 'no auto-summary',
        'neighbor': 'neighbor ',

        // Line subcommands
        'login local': 'login local',
        'transport input ssh': 'transport input ssh',
        'transport input all': 'transport input all',
        'logging syn': 'logging synchronous',
        'logging synchronous': 'logging synchronous',
        'exec-timeout': 'exec-timeout 10 0',

        // Clear and Debug
        'deb ip icmp': 'debug ip icmp',
        'deb ip ospf': 'debug ip ospf events',
        'deb all': 'debug all',
        'undeb all': 'undebug all',
        'clear arp': 'clear arp-cache',
        'clear mac': 'clear mac address-table dynamic',
        'clear ip route': 'clear ip route *',
        'clear ip ospf': 'clear ip ospf process',

        // Multi-Vendor Junos completions
        'sh int ter': 'show interfaces terse',
        'sh int terse': 'show interfaces terse',
        'sh rou': 'show route',
        'sh route': 'show route',
        'set int': 'set interfaces ',
        'com': 'commit',
        'com check': 'commit check',
        'rol': 'rollback 0',

        // Multi-Vendor Linux completions
        'ip a': 'ip addr show',
        'ip addr': 'ip addr show',
        'ip r': 'ip route show',
        'ip n': 'ip neigh show',
        'ip neigh': 'ip neigh show',

        // Multi-Vendor Arista completions
        'sh int st': 'show interfaces status',
        'sh run san': 'show running-config sanitized',
        'sh lldp': 'show lldp neighbors',

        // Multi-Vendor MikroTik completions
        '/ip addr': '/ip address print',
        '/ip addr pr': '/ip address print',
        '/ip rou': '/ip route print',
        '/ip rou pr': '/ip route print',
        '/int pr': '/interface print',
        '/export': '/export',
      };

      // Pipe output filter autocomplete (e.g. "sh run | inc" -> "sh run | include ")
      if (current.includes('|')) {
        const lastPipeIdx = current.lastIndexOf('|');
        const beforePipe = current.slice(0, lastPipeIdx + 1);
        const pipeArg = current.slice(lastPipeIdx + 1).trim().toLowerCase();
        const pipeCompletions: Record<string, string> = {
          'i': 'include ',
          'in': 'include ',
          'inc': 'include ',
          'incude': 'include ',
          'include': 'include ',
          'e': 'exclude ',
          'ex': 'exclude ',
          'exc': 'exclude ',
          'exclude': 'exclude ',
          'b': 'begin ',
          'beg': 'begin ',
          'begin': 'begin ',
          's': 'section ',
          'sec': 'section ',
          'section': 'section ',
          'c': 'count',
          'cou': 'count',
          'count': 'count',
        };
        if (pipeCompletions[pipeArg]) {
          setCliInput(`${beforePipe} ${pipeCompletions[pipeArg]}`);
          return;
        }
      }

      const lower = current.toLowerCase();
      if (completions[lower]) {
        setCliInput(completions[lower]);
      } else {
        // Prefix match against dictionary
        const candidateKey = Object.keys(completions).find((k) => k.startsWith(lower));
        if (candidateKey) {
          setCliInput(completions[candidateKey]);
        }
      }
    }
  };


  // AI Device Troubleshooter
  const [aiAdvisorTip, setAiAdvisorTip] = useState<string | null>(null);
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);

  const handleRequestAiDeviceAudit = async () => {
    setIsAdvisorLoading(true);
    try {
      const res = await fetch('/api/ai/tac-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Analyze this network device (${device.name}, ${device.type}). Audit interface IP allocations, OSPF areas, VLANs, and default routes. Provide a concise 2-sentence TAC assessment and recommended commands.`,
          deviceContext: {
            hostname: device.config.hostname,
            type: device.type,
            runningConfig: generateRunningConfig(device),
          },
        }),
      });
      const data = await res.json();
      setAiAdvisorTip(data.reply || 'Device analysis complete.');
    } catch (err) {
      setAiAdvisorTip(`TAC Advice: Run "show ip interface brief" and "show ip route" to verify local interface states and routing entries.`);
    } finally {
      setIsAdvisorLoading(false);
    }
  };

  if (windowState.minimized) return null;

  const isMax = windowState.maximized;

  return (
    <div
      className={`fixed flex flex-col bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden select-none z-50 ${
        isMax ? 'inset-4 w-auto h-auto' : ''
      }`}
      style={
        isMax
          ? { zIndex: windowState.zIndex }
          : {
              left: `${windowState.x}px`,
              top: `${windowState.y}px`,
              width: `${windowState.width}px`,
              height: `${windowState.height}px`,
              zIndex: windowState.zIndex,
            }
      }
      onMouseDown={() => onUpdateWindowState(windowState.id, { zIndex: Date.now() })}
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="h-9 bg-slate-950/90 px-3 flex items-center justify-between border-b border-white/5 cursor-move"
      >
        {/* Device Name & Icon */}
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-bold text-slate-200">
            {device.config.hostname || device.name}
          </span>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center bg-white/[0.04] p-0.5 rounded-md border border-white/5">
          <button
            onClick={() => setActiveTab('physical')}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded flex items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'physical'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Box className="w-3 h-3" />
            Phys
          </button>

          {spec.supportsCli && (
            <button
              onClick={() => setActiveTab('cli')}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded flex items-center gap-1 transition-colors ${
                activeTab === 'cli'
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Terminal className="w-3 h-3" />
              CLI
            </button>
          )}

          <button
            onClick={() => setActiveTab('config')}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded flex items-center gap-1 transition-colors ${
              activeTab === 'config'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Settings className="w-3 h-3" />
            Conf
          </button>

          {spec.supportsDesktop && (
            <button
              onClick={() => setActiveTab('desktop')}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded flex items-center gap-1 transition-colors ${
                activeTab === 'desktop'
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Monitor className="w-3 h-3" />
              Desk
            </button>
          )}

          {spec.supportsServices && (
            <button
              onClick={() => setActiveTab('services')}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded flex items-center gap-1 transition-colors ${
                activeTab === 'services'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Server className="w-3 h-3" />
              Serv
            </button>
          )}

          {isSwitchDevice && (
            <button
              onClick={() => setActiveTab('stacking')}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded flex items-center gap-1 transition-colors ${
                activeTab === 'stacking'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Layers className="w-3 h-3" />
              Stack
            </button>
          )}

          <button
            onClick={() => setActiveTab('protocols')}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded flex items-center gap-1 transition-colors ${
              activeTab === 'protocols'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Network className="w-3 h-3" />
            Prot
          </button>
        </div>

        {/* Window Control Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdateWindowState(windowState.id, { minimized: true })}
            title="Minimize"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() =>
              onUpdateWindowState(windowState.id, {
                maximized: !windowState.maximized,
              })
            }
            title={isMax ? 'Restore' : 'Maximize'}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
          >
            {isMax ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => onClose(windowState.id)}
            title="Close"
            className="p-1 hover:bg-rose-500 hover:text-white text-slate-400 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Tab Panels */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950 font-sans">
        {/* TAB 0: PHYSICAL REALISTIC FRONT PANEL INSPECTION */}
        {activeTab === 'physical' && (
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col items-center gap-4 bg-slate-950">
            <div className="w-full max-w-4xl flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-semibold text-slate-200">
                19" Enterprise Rack Front Panel Simulation
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Interactive front faceplate & status LEDs. Click any port to inspect details.
              </span>
            </div>

            <DeviceFrontPanel
              type={device.type}
              mode="full"
              device={device}
              selectedPortName={selectedPhysicalPort}
              onPortClick={(portName) => setSelectedPhysicalPort(portName)}
            />
          </div>
        )}

        {/* TAB 1: UNIVERSAL MULTI-VENDOR CLI TERMINAL */}
        {activeTab === 'cli' && (
          <CliTerminalTab
            device={device}
            cliSession={cliSession}
            terminalThemeMode={terminalThemeMode}
            setTerminalThemeMode={setTerminalThemeMode}
            showScanlines={showScanlines}
            setShowScanlines={setShowScanlines}
            terminalOutput={terminalOutput}
            setTerminalOutput={setTerminalOutput}
            cliInput={cliInput}
            setCliInput={setCliInput}
            inputRef={inputRef}
            terminalEndRef={terminalEndRef}
            onUpdateDeviceConfig={onUpdateDeviceConfig}
            onOpenCommandReference={() => setIsCommandReferenceOpen(true)}
            onRequestAiAudit={handleRequestAiDeviceAudit}
            isAdvisorLoading={isAdvisorLoading}
            aiAdvisorTip={aiAdvisorTip}
            onDismissAiAdvisorTip={() => setAiAdvisorTip(null)}
            onSubmit={handleCliSubmit}
            onKeyDown={handleCliKeyDown}
          />
        )}

        {/* TAB 2: CONFIGURATION GUI */}
        {activeTab === 'config' && (
          <DeviceConfigTab
            device={device}
            onUpdateDeviceConfig={onUpdateDeviceConfig}
          />
        )}

        {/* TAB 3: END-DEVICE DESKTOP TOOLS (PC/Laptop) */}
        {activeTab === 'desktop' && (
          <DesktopAppsTab
            device={device}
            allDevices={allDevices}
            onUpdateDeviceConfig={onUpdateDeviceConfig}
            onRunPingSim={onRunPingSim}
            onRunDhcpSim={onRunDhcpSim}
          />
        )}

        {/* TAB 4: SERVER SERVICES (DHCP / DNS / HTTP) */}
        {activeTab === 'services' && (
          <ServicesTab
            device={device}
            onUpdateDeviceConfig={onUpdateDeviceConfig}
          />
        )}

        {/* TAB 5: CISCO STACKWISE SWITCH STACKING */}
        {activeTab === 'stacking' && (
          <StackingView
            device={device}
            onUpdateDeviceConfig={onUpdateDeviceConfig}
          />
        )}

        {/* TAB 6: ENTERPRISE & SP ADVANCED PROTOCOLS */}
        {activeTab === 'protocols' && (
          <ProtocolsDashboard
            device={device}
            allDevices={allDevices}
            allLinks={allLinks}
            onUpdateDeviceConfig={onUpdateDeviceConfig}
          />
        )}
      </div>

      {/* Resizable Corner Handle */}
      {!isMax && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5"
        >
          <div className="w-2 h-2 border-r-2 border-b-2 border-slate-500" />
        </div>
      )}

      {/* Cisco IOS Command Master Reference Modal */}
      <CommandReferenceModal
        isOpen={isCommandReferenceOpen}
        onClose={() => setIsCommandReferenceOpen(false)}
        onInsertCommand={(cmd) => {
          setCliInput(cmd);
          inputRef.current?.focus();
        }}
      />
    </div>
  );
};
