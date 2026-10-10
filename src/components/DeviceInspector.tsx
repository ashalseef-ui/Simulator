import React, { useState, useEffect, useRef } from 'react';
import {
  Device,
  DeviceConfig,
  DeviceWindowState,
  Link,
} from '../types/network';
import { DEVICE_SPECS } from '../engine/deviceSpecs';
import {
  createCliSession,
  executeCliCommand,
  getPrompt,
  CliSession,
  generateRunningConfig,
} from '../engine/cliEngine';
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
} from 'lucide-react';
import { DeviceFrontPanel } from './DeviceFrontPanel';
import { StackingView } from './StackingView';
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

  const [activeTab, setActiveTab] = useState<'physical' | 'cli' | 'config' | 'desktop' | 'services' | 'stacking'>(
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
  const [terminalOutput, setTerminalOutput] = useState<string[]>(() => {
    if (device.type === 'firewall' || device.type === 'firepower') {
      return [
        `Cisco Adaptive Security Appliance Software Version 9.8(2)`,
        `Device: Cisco ASA 5506-X with FirePOWER Services`,
        `Compiled Mon 05-Oct-26 06:30 by NetCraft`,
        ``,
        `Type 'enable' to enter privileged mode.`,
        ``,
      ];
    }
    if (device.type === 'nexus9000') {
      return [
        `Cisco Nexus Operating System (NX-OS) Software, Version 9.3(5)`,
        `TAC support: http://www.cisco.com/tac`,
        `Compiled Mon 05-Oct-26 06:30 by NetCraft`,
        ``,
        `Press RETURN or type 'enable' to get started!`,
        ``,
      ];
    }
    if (device.type === 'wlc') {
      return [
        `Cisco AireOS Controller Software Version 8.5.151.0`,
        `Cisco 3504 Wireless LAN Controller (AIR-CT3504-K9)`,
        ``,
        `Press RETURN to start session.`,
        ``,
      ];
    }
    if (isSwitchDevice) {
      return [
        `Cisco IOS Software, Catalyst C2960/3560/3850/9300 Software (C9300-UNIVERSALK9-M), Version 17.3(4)`,
        `Technical Support: http://www.cisco.com/techsupport`,
        `Compiled Mon 05-Oct-26 06:30 by NetCraft`,
        ``,
        `Press RETURN or type 'enable' to get started!`,
        ``,
      ];
    }
    return [
      `Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.4(3)M2`,
      `Technical Support: http://www.cisco.com/techsupport`,
      `Compiled Mon 05-Oct-26 06:30 by NetCraft`,
      ``,
      `Press RETURN or type 'enable' to get started!`,
      ``,
    ];
  });
  const [cliInput, setCliInput] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Desktop tool state (for PC/Laptop)
  const [desktopTool, setDesktopTool] = useState<'ip' | 'terminal' | 'browser'>('ip');
  const [cmdOutput, setCmdOutput] = useState<string[]>(['NetCraft Command Prompt [Version 1.0]', 'Type "ping <ip>", "nslookup <domain>", or "help".', '']);
  const [cmdInput, setCmdInput] = useState('');
  const [browserUrl, setBrowserUrl] = useState('http://cisco.com');
  const [browserContent, setBrowserContent] = useState<string | null>(null);

  // Server DNS Record input state
  const [newDnsDomain, setNewDnsDomain] = useState('');
  const [newDnsIp, setNewDnsIp] = useState('');

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
    }

    setTerminalOutput(newLines);
    setCliSession(result.newSession);
    setCliInput('');
  };

  // Handle CLI Keydown (History navigation & Tab auto-complete)
  const handleCliKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      // Simple tab autocomplete for common commands
      const completions: Record<string, string> = {
        'conf': 'configure terminal',
        'sh': 'show',
        'int': 'interface',
        'ip': 'ip address',
        'no': 'no shutdown',
        'sw': 'switchport',
        'en': 'enable',
        'wr': 'write memory',
      };
      if (completions[cliInput.trim()]) {
        setCliInput(completions[cliInput.trim()]);
      }
    }
  };

  // PC/Laptop Desktop Command Prompt handler
  const handleCmdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cmdInput.trim();
    if (!cmd) return;

    const out = [...cmdOutput, `C:\\> ${cmd}`];
    const lower = cmd.toLowerCase();

    if (lower.startsWith('ping')) {
      const parts = cmd.split(/\s+/);
      const target = parts[1];
      if (target) {
        let targetIp = target;
        let dnsResolvedMsg = '';

        if (!isValidIp(target)) {
          // Look up domain across all DNS servers in topology
          let resolved: string | undefined;
          for (const d of allDevices) {
            if (d.type === 'server' && d.config.services?.dns?.enabled) {
              const rec = d.config.services.dns.records?.find((r) => r.domain.toLowerCase() === target.toLowerCase());
              if (rec?.ip) {
                resolved = rec.ip;
                break;
              }
            }
          }
          if (resolved) {
            targetIp = resolved;
            dnsResolvedMsg = `Pinging ${target} [${targetIp}] with 32 bytes of data:`;
          } else {
            out.push(`Ping request could not find host ${target}. Please check the name and try again.`);
            setCmdOutput(out);
            setCmdInput('');
            return;
          }
        } else {
          dnsResolvedMsg = `Pinging ${target} with 32 bytes of data:`;
        }

        onRunPingSim(device.id, targetIp);
        out.push(dnsResolvedMsg);
        out.push(`Reply from ${targetIp}: bytes=32 time=2ms TTL=128`);
        out.push(`Reply from ${targetIp}: bytes=32 time=1ms TTL=128`);
        out.push(`Reply from ${targetIp}: bytes=32 time=2ms TTL=128`);
        out.push(`Reply from ${targetIp}: bytes=32 time=1ms TTL=128`);
        out.push(`Ping statistics for ${targetIp}: Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`);
      } else {
        out.push('Usage: ping <destination_ip_or_domain>');
      }
    } else if (lower === 'ipconfig' || lower === 'ipconfig /all') {
      const iface = Object.values(device.config.interfaces)[0];
      out.push('Windows IP Configuration\n');
      out.push('Ethernet adapter FastEthernet0/0:');
      out.push(`   Connection-specific DNS Suffix  . : localdomain`);
      out.push(`   Physical Address. . . . . . . . . : ${iface?.mac || '00-1C-B1-00-00-01'}`);
      out.push(`   DHCP Enabled. . . . . . . . . . . : ${iface?.ip ? 'No' : 'Yes'}`);
      out.push(`   IPv4 Address. . . . . . . . . . . : ${iface?.ip || '0.0.0.0'}`);
      out.push(`   Subnet Mask . . . . . . . . . . . : ${iface?.mask || '0.0.0.0'}`);
      out.push(`   Default Gateway . . . . . . . . . : ${device.config.defaultGateway || '0.0.0.0'}`);
      out.push(`   DNS Server. . . . . . . . . . . . : ${device.config.dnsServer || '0.0.0.0'}`);
    } else if (lower === 'ipconfig /renew') {
      onRunDhcpSim(device.id);
      out.push('Renewing IP address from DHCP server...');
      out.push('DHCP Discover sent -> DHCP Offer received -> DHCP Request -> DHCP ACK.');
      out.push('IP address successfully leased.');
    } else if (lower === 'ipconfig /release') {
      const iface = Object.values(device.config.interfaces)[0];
      if (iface) {
        iface.ip = '';
        iface.mask = '';
      }
      device.config.defaultGateway = '';
      onUpdateDeviceConfig(device.id, { ...device.config });
      out.push('IP address for adapter FastEthernet0/0 has been released.');
    } else if (lower === 'ipconfig /displaydns') {
      out.push('Windows IP Configuration - DNS Resolver Cache:\n');
      let recordsFound = false;
      for (const d of allDevices) {
        if (d.type === 'server' && d.config.services?.dns?.enabled) {
          d.config.services.dns.records?.forEach((r) => {
            recordsFound = true;
            out.push(`    Record Name . . . . . : ${r.domain}`);
            out.push(`    Record Type . . . . . : 1 (A)`);
            out.push(`    Time To Live  . . . . : 3600`);
            out.push(`    Data Length . . . . . : 4`);
            out.push(`    Section . . . . . . . : Answer`);
            out.push(`    A (IPv4) Record . . . : ${r.ip}\n`);
          });
        }
      }
      if (!recordsFound) {
        out.push('    Record Name . . . . . : cisco.com');
        out.push('    A (IPv4) Record . . . : 192.168.1.10');
      }
    } else if (lower === 'ipconfig /flushdns') {
      out.push('Windows IP Configuration\n\nSuccessfully flushed the DNS Resolver Cache.');
    } else if (lower.startsWith('tracert') || lower.startsWith('traceroute')) {
      const parts = cmd.split(/\s+/);
      const target = parts[1] || '8.8.8.8';
      out.push(`Tracing route to ${target} over a maximum of 30 hops:\n`);
      out.push(`  1     1 ms     1 ms     1 ms  ${device.config.defaultGateway || '192.168.1.1'}`);
      out.push(`  2     3 ms     2 ms     3 ms  ${target}`);
      out.push('\nTrace complete.');
    } else if (lower.startsWith('nslookup')) {
      const parts = cmd.split(/\s+/);
      const domain = parts[1] || 'cisco.com';
      const activeDnsServer = device.config.dnsServer || '192.168.1.10';

      out.push(`Server:  ns1.netcraft.lab`);
      out.push(`Address: ${activeDnsServer}\n`);

      // Search all servers in network topology
      let resolvedIp: string | undefined;
      for (const d of allDevices) {
        if (d.type === 'server' && d.config.services?.dns?.enabled) {
          const record = d.config.services.dns.records?.find((r) => r.domain.toLowerCase() === domain.toLowerCase());
          if (record) {
            resolvedIp = record.ip;
            break;
          }
        }
      }

      if (resolvedIp) {
        out.push(`Name:    ${domain}`);
        out.push(`Address: ${resolvedIp}`);
      } else {
        out.push(`*** ns1.netcraft.lab can't find ${domain}: Non-existent domain`);
      }
    } else if (lower.startsWith('arp')) {
      if (lower.includes('-d')) {
        out.push('[OK] ARP cache table flushed.');
      } else {
        out.push('Interface: 192.168.1.50 --- 0x2');
        out.push('  Internet Address      Physical Address      Type');
        out.push(`  ${device.config.defaultGateway || '192.168.1.1'}          00-1c-b1-a0-00-01     dynamic`);
      }
    } else if (lower.startsWith('netstat')) {
      out.push('Active Connections\n');
      out.push('  Proto  Local Address          Foreign Address        State');
      out.push('  TCP    192.168.1.50:49152     192.168.1.10:80        ESTABLISHED');
    } else if (lower.startsWith('route print')) {
      out.push('IPv4 Route Table\n===========================================================================');
      out.push('Network Destination        Netmask          Gateway       Interface  Metric');
      out.push(`          0.0.0.0          0.0.0.0  ${(device.config.defaultGateway || '192.168.1.1').padEnd(15)}    192.168.1.50      25`);
      out.push('        127.0.0.1  255.255.255.255        On-link         127.0.0.1     306');
    } else if (lower.startsWith('ssh')) {
      const parts = cmd.split(/\s+/);
      const target = parts.find((p) => isValidIp(p)) || '192.168.1.1';
      out.push(`Connecting to SSH host at ${target}:22...`);
      out.push(`SSH banner received: Cisco IOS Software, Version 15.4(3)M2`);
      out.push(`Password: [Enter Cisco VTY password in device terminal]`);
    } else if (lower.startsWith('telnet')) {
      const parts = cmd.split(/\s+/);
      const target = parts.find((p) => isValidIp(p)) || '192.168.1.1';
      out.push(`Trying ${target}... Open`);
      out.push(`User Access Verification`);
      out.push(`Password: `);
    } else if (lower.startsWith('curl') || lower.startsWith('wget') || lower.startsWith('http')) {
      out.push('HTTP/1.1 200 OK\nContent-Type: text/html\nServer: NetCraft Linux Web Engine\n\n<html><body><h1>NetCraft Web Portal</h1><p>Connection Successful</p></body></html>');
    } else if (lower === 'hostname') {
      out.push(device.config.hostname || device.name);
    } else if (lower === 'whoami') {
      out.push('netcraft-user\\admin');
    } else if (lower === 'systeminfo') {
      out.push(`Host Name:                 ${device.config.hostname || device.name}\nOS Name:                   NetCraft Workstation OS v10.0\nSystem Type:               x64-based PC\nNetwork Card(s):           1 NIC(s) Installed.\n                           [01]: FastEthernet0/0 - Status: Connected`);
    } else if (lower === 'cls' || lower === 'clear') {
      setCmdOutput([]);
      setCmdInput('');
      return;
    } else if (lower === 'help' || lower === '?') {
      out.push('Available Desktop & Command Prompt Commands:');
      out.push('  ping <ip>            - Send ICMP echo requests');
      out.push('  ipconfig [/all]      - Display IP configuration');
      out.push('  ipconfig /renew      - Lease IP from DHCP server');
      out.push('  ipconfig /release    - Release current IP lease');
      out.push('  ipconfig /displaydns - Display DNS cache entries');
      out.push('  ipconfig /flushdns   - Flush DNS resolver cache');
      out.push('  tracert <ip>         - Trace network route');
      out.push('  nslookup <domain>    - Query DNS server');
      out.push('  arp -a / arp -d *    - Display or flush ARP resolution table');
      out.push('  netstat [-a]         - Display active network connections');
      out.push('  route print          - Display local routing table');
      out.push('  ssh [-l user] <ip>   - Connect via Secure Shell');
      out.push('  telnet <ip> [port]   - Connect via Telnet');
      out.push('  curl <url>           - Fetch HTTP payload');
      out.push('  hostname / whoami    - Display workstation identity');
      out.push('  systeminfo           - Display hardware and network summary');
      out.push('  cls                  - Clear screen');
    } else {
      out.push(`'${cmd}' is not recognized as an internal or external command. Type 'help' for available commands.`);
    }

    setCmdOutput(out);
    setCmdInput('');
  };

  // PC Web Browser go
  const handleBrowserNavigate = () => {
    const cleanUrl = browserUrl.replace(/^https?:\/\//, '');
    // Check if target matches any server HTTP service
    let foundServer: Device | undefined;
    for (const d of allDevices) {
      if (d.type === 'server' && d.config.services?.http?.enabled) {
        for (const iface of Object.values(d.config.interfaces)) {
          if (iface.ip === cleanUrl) foundServer = d;
        }
        // Also check server DNS records
        const dnsMatch = d.config.services?.dns?.records?.some((r) => r.domain === cleanUrl);
        if (dnsMatch) foundServer = d;
      }
    }

    if (foundServer?.config.services?.http) {
      const h = foundServer.config.services.http;
      setBrowserContent(`
        <div class="p-6 bg-slate-900 text-slate-100 rounded-lg border border-slate-800">
          <div class="text-xl font-bold text-sky-400 mb-2">${h.title}</div>
          <p class="text-sm text-slate-300 leading-relaxed">${h.body}</p>
          <div class="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
            Served by Cisco 2960 / Linux Enterprise Web Engine (HTTP/1.1 200 OK)
          </div>
        </div>
      `);
    } else {
      setBrowserContent(`
        <div class="p-6 bg-slate-900 text-slate-300 rounded-lg border border-slate-800 text-center">
          <div class="text-lg font-bold text-rose-400 mb-1">404 Not Found</div>
          <p class="text-xs text-slate-400">Unable to establish connection to ${browserUrl}. Server offline or host unreachable.</p>
        </div>
      `);
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
          message: `Analyze this Cisco device (${device.name}, ${device.type}). Audit interface IP allocations, OSPF areas, VLANs, and default routes. Provide a concise 2-sentence TAC assessment and recommended commands.`,
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
        className="h-10 bg-slate-950 px-3 flex items-center justify-between border-b border-slate-800 cursor-move"
      >
        {/* Device Name & Icon */}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-bold text-slate-200">
            {device.config.hostname || device.name} ({spec.displayName})
          </span>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('physical')}
            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'physical'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            Physical
          </button>

          {spec.supportsCli && (
            <button
              onClick={() => setActiveTab('cli')}
              className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                activeTab === 'cli'
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              CLI
            </button>
          )}

          <button
            onClick={() => setActiveTab('config')}
            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
              activeTab === 'config'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Config
          </button>

          {spec.supportsDesktop && (
            <button
              onClick={() => setActiveTab('desktop')}
              className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                activeTab === 'desktop'
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
          )}

          {spec.supportsServices && (
            <button
              onClick={() => setActiveTab('services')}
              className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                activeTab === 'services'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              Services
            </button>
          )}

          {isSwitchDevice && (
            <button
              onClick={() => setActiveTab('stacking')}
              className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                activeTab === 'stacking'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              StackWise
            </button>
          )}
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

        {/* TAB 1: CISCO IOS CLI TERMINAL */}
        {activeTab === 'cli' && (
          <div
            className="flex-1 flex flex-col p-3 font-mono text-xs overflow-hidden bg-black text-emerald-400"
            onClick={() => inputRef.current?.focus()}
          >
            {/* Terminal Mini Action Toolbar */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-900 select-none">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-bold">Cisco IOS CLI</span>
                <span className="text-slate-600">|</span>
                <span>{device.config.hostname || device.name}</span>
                {cliSession.debugFlags?.icmp && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                    DEBUG: ICMP ON
                  </span>
                )}
                {cliSession.debugFlags?.ospfEvents && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                    DEBUG: OSPF ON
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRequestAiDeviceAudit();
                  }}
                  disabled={isAdvisorLoading}
                  className="px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] font-bold flex items-center gap-1 border border-indigo-500/40 cursor-pointer disabled:opacity-50"
                  title="Ask Gemini TAC to audit this device configuration"
                >
                  {isAdvisorLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                  )}
                  AI TAC Assist
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const cfg = generateRunningConfig(device);
                    navigator.clipboard.writeText(cfg);
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-900 cursor-pointer"
                  title="Copy Running Configuration"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTerminalOutput([
                      `Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.4(3)M2`,
                      `Compiled Mon 05-Oct-26 06:30 by NetCraft`,
                      ``,
                    ]);
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-900 cursor-pointer"
                  title="Clear Terminal Screen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* AI Advisor Response Drawer */}
            {aiAdvisorTip && (
              <div className="mb-2 p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-[11px] leading-relaxed relative font-sans">
                <div className="flex items-center justify-between mb-1 font-bold text-indigo-300 flex items-center gap-1">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    AI TAC Diagnostic Advice
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAiAdvisorTip(null);
                    }}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="whitespace-pre-wrap">{aiAdvisorTip}</div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
              {terminalOutput.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-tight">
                  {line}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            {/* Input Line with Realistic IOS Prompt */}
            <form onSubmit={handleCliSubmit} className="flex items-center mt-2 pt-1 border-t border-slate-900">
              <span className="text-emerald-400 font-bold mr-1.5 select-none">
                {getPrompt(device, cliSession)}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                onKeyDown={handleCliKeyDown}
                className="flex-1 bg-transparent text-emerald-300 outline-none font-mono text-xs"
                autoFocus
                spellCheck={false}
              />
            </form>
          </div>
        )}

        {/* TAB 2: CONFIGURATION GUI */}
        {activeTab === 'config' && (
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-slate-200 custom-scrollbar">
            {/* General Settings */}
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                System Global Settings
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={device.name}
                    disabled
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    IOS Hostname
                  </label>
                  <input
                    type="text"
                    value={device.config.hostname}
                    onChange={(e) =>
                      onUpdateDeviceConfig(device.id, {
                        ...device.config,
                        hostname: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>

              {(device.type === 'router' || device.type === 'l3switch') && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-xs text-slate-300">
                    IP Routing (Layer 3 Forwarding)
                  </span>
                  <input
                    type="checkbox"
                    checked={!!device.config.ipRoutingEnabled}
                    onChange={(e) =>
                      onUpdateDeviceConfig(device.id, {
                        ...device.config,
                        ipRoutingEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-sky-500 bg-slate-950 border-slate-700"
                  />
                </div>
              )}
            </div>

            {/* Interfaces List & Configuration */}
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Physical Interfaces
              </div>
              <div className="space-y-3">
                {Object.entries(device.config.interfaces).map(([portName, iface]) => (
                  <div
                    key={portName}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            iface.status === 'up' ? 'bg-emerald-400' : 'bg-rose-500'
                          }`}
                        />
                        <span className="text-xs font-bold font-mono text-slate-200">
                          {portName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({iface.speed} Mbps)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Port Status:</span>
                        <button
                          onClick={() => {
                            const newIfaces = { ...device.config.interfaces };
                            newIfaces[portName] = {
                              ...iface,
                              status: iface.status === 'up' ? 'down' : 'up',
                            };
                            onUpdateDeviceConfig(device.id, {
                              ...device.config,
                              interfaces: newIfaces,
                            });
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            iface.status === 'up'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {iface.status.toUpperCase()}
                        </button>
                      </div>
                    </div>

                    {/* IP Configuration (if routed or end-host) */}
                    {(device.type !== 'switch' || iface.mode === 'routed') && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            IP Address
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 192.168.1.1"
                            value={iface.ip || ''}
                            onChange={(e) => {
                              const newIfaces = { ...device.config.interfaces };
                              newIfaces[portName] = {
                                ...iface,
                                ip: e.target.value,
                              };
                              onUpdateDeviceConfig(device.id, {
                                ...device.config,
                                interfaces: newIfaces,
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Subnet Mask
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 255.255.255.0"
                            value={iface.mask || ''}
                            onChange={(e) => {
                              const newIfaces = { ...device.config.interfaces };
                              newIfaces[portName] = {
                                ...iface,
                                mask: e.target.value,
                              };
                              onUpdateDeviceConfig(device.id, {
                                ...device.config,
                                interfaces: newIfaces,
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                          />
                        </div>
                      </div>
                    )}

                    {/* Switchport VLAN & Trunk Configuration */}
                    {(device.type === 'switch' || device.type === 'l3switch') && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Switchport Mode
                          </label>
                          <select
                            value={iface.mode || 'access'}
                            onChange={(e) => {
                              const newIfaces = { ...device.config.interfaces };
                              newIfaces[portName] = {
                                ...iface,
                                mode: e.target.value as any,
                              };
                              onUpdateDeviceConfig(device.id, {
                                ...device.config,
                                interfaces: newIfaces,
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                          >
                            <option value="access">Access</option>
                            <option value="trunk">Trunk</option>
                            {device.type === 'l3switch' && (
                              <option value="routed">Routed (No Switchport)</option>
                            )}
                          </select>
                        </div>
                        {iface.mode === 'access' && (
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">
                              Access VLAN ID
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="4094"
                              value={iface.accessVlan || 1}
                              onChange={(e) => {
                                const newIfaces = { ...device.config.interfaces };
                                newIfaces[portName] = {
                                  ...iface,
                                  accessVlan: parseInt(e.target.value, 10) || 1,
                                };
                                onUpdateDeviceConfig(device.id, {
                                  ...device.config,
                                  interfaces: newIfaces,
                                });
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: END-DEVICE DESKTOP TOOLS (PC/Laptop) */}
        {activeTab === 'desktop' && (
          <div className="flex-1 flex flex-col p-4 bg-slate-950 text-slate-200">
            {/* Desktop Tool Switcher */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDesktopTool('ip')}
                className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  desktopTool === 'ip'
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                IP Configuration
              </button>
              <button
                onClick={() => setDesktopTool('terminal')}
                className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  desktopTool === 'terminal'
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-4 h-4" />
                Command Prompt
              </button>
              <button
                onClick={() => setDesktopTool('browser')}
                className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  desktopTool === 'browser'
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-4 h-4" />
                Web Browser
              </button>
            </div>

            {/* Desktop Tool 1: IP Configuration */}
            {desktopTool === 'ip' && (
              <div className="flex-1 bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-6 pb-3 border-b border-slate-800">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="dhcpToggle"
                      checked={!device.config.isDhcpClient}
                      onChange={() =>
                        onUpdateDeviceConfig(device.id, {
                          ...device.config,
                          isDhcpClient: false,
                        })
                      }
                      className="text-sky-500 bg-slate-950"
                    />
                    Static IPv4
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="dhcpToggle"
                      checked={!!device.config.isDhcpClient}
                      onChange={() => {
                        onUpdateDeviceConfig(device.id, {
                          ...device.config,
                          isDhcpClient: true,
                        });
                        onRunDhcpSim(device.id);
                      }}
                      className="text-sky-500 bg-slate-950"
                    />
                    DHCP Client (Dynamic)
                  </label>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const primaryName = Object.keys(device.config.interfaces)[0] || 'Fa0/0';
                    const primaryIface = device.config.interfaces[primaryName] || {
                      name: primaryName,
                      mac: '00:1c:b1:00:00:01',
                      status: 'up',
                      speed: 100,
                    };
                    return (
                      <>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pb-1">
                          <span>Active Interface: <strong className="text-sky-400">{primaryName}</strong></span>
                          <span>MAC: <strong className="text-slate-300">{primaryIface.mac}</strong></span>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">
                            IPv4 Address
                          </label>
                          <input
                            type="text"
                            disabled={!!device.config.isDhcpClient}
                            value={primaryIface.ip || ''}
                            onChange={(e) => {
                              const ifaces = { ...device.config.interfaces };
                              ifaces[primaryName] = {
                                ...primaryIface,
                                ip: e.target.value,
                              };
                              onUpdateDeviceConfig(device.id, {
                                ...device.config,
                                interfaces: ifaces,
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
                            placeholder="192.168.1.10"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">
                            Subnet Mask
                          </label>
                          <input
                            type="text"
                            disabled={!!device.config.isDhcpClient}
                            value={primaryIface.mask || ''}
                            onChange={(e) => {
                              const ifaces = { ...device.config.interfaces };
                              ifaces[primaryName] = {
                                ...primaryIface,
                                mask: e.target.value,
                              };
                              onUpdateDeviceConfig(device.id, {
                                ...device.config,
                                interfaces: ifaces,
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
                            placeholder="255.255.255.0"
                          />
                        </div>
                      </>
                    );
                  })()}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Default Gateway
                    </label>
                    <input
                      type="text"
                      disabled={!!device.config.isDhcpClient}
                      value={device.config.defaultGateway || ''}
                      onChange={(e) =>
                        onUpdateDeviceConfig(device.id, {
                          ...device.config,
                          defaultGateway: e.target.value,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
                      placeholder="192.168.1.1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      DNS Server
                    </label>
                    <input
                      type="text"
                      disabled={!!device.config.isDhcpClient}
                      value={device.config.dnsServer || ''}
                      onChange={(e) =>
                        onUpdateDeviceConfig(device.id, {
                          ...device.config,
                          dnsServer: e.target.value,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200"
                      placeholder="8.8.8.8"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Desktop Tool 2: Command Prompt */}
            {desktopTool === 'terminal' && (
              <div className="flex-1 flex flex-col bg-black p-3 rounded-xl border border-slate-800 font-mono text-xs overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar pr-1 text-slate-300">
                  {cmdOutput.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
                <form onSubmit={handleCmdSubmit} className="flex items-center pt-2 border-t border-slate-800 mt-2">
                  <span className="text-emerald-400 mr-2">C:\&gt;</span>
                  <input
                    type="text"
                    value={cmdInput}
                    onChange={(e) => setCmdInput(e.target.value)}
                    placeholder="type 'ping 192.168.1.1' or 'ipconfig'"
                    className="flex-1 bg-transparent text-white outline-none font-mono text-xs"
                    autoFocus
                  />
                </form>
              </div>
            )}

            {/* Desktop Tool 3: Web Browser */}
            {desktopTool === 'browser' && (
              <div className="flex-1 flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                {/* Browser URL Bar */}
                <div className="p-2 bg-slate-950 flex items-center gap-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-400">URL:</span>
                  <input
                    type="text"
                    value={browserUrl}
                    onChange={(e) => setBrowserUrl(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                  />
                  <button
                    onClick={handleBrowserNavigate}
                    className="px-3 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded text-xs font-bold cursor-pointer"
                  >
                    Go
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-slate-950">
                  {browserContent ? (
                    <div dangerouslySetInnerHTML={{ __html: browserContent }} />
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Enter server URL or domain (e.g. 192.168.1.10) and click Go.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SERVER SERVICES (DHCP / DNS / HTTP) */}
        {activeTab === 'services' && device.config.services && (
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-slate-200 custom-scrollbar">
            {/* DHCP Service */}
            {device.config.services.dhcp && (
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    DHCP Service Configuration
                  </div>
                  <input
                    type="checkbox"
                    checked={device.config.services.dhcp.enabled}
                    onChange={(e) => {
                      const s = { ...device.config.services };
                      if (s.dhcp) s.dhcp.enabled = e.target.checked;
                      onUpdateDeviceConfig(device.id, {
                        ...device.config,
                        services: s,
                      });
                    }}
                    className="w-4 h-4 rounded text-sky-500 bg-slate-950"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Pool Name
                    </label>
                    <input
                      type="text"
                      value={device.config.services.dhcp.poolName}
                      onChange={(e) => {
                        const s = { ...device.config.services };
                        if (s.dhcp) s.dhcp.poolName = e.target.value;
                        onUpdateDeviceConfig(device.id, {
                          ...device.config,
                          services: s,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Start IP Address
                    </label>
                    <input
                      type="text"
                      value={device.config.services.dhcp.startIp}
                      onChange={(e) => {
                        const s = { ...device.config.services };
                        if (s.dhcp) s.dhcp.startIp = e.target.value;
                        onUpdateDeviceConfig(device.id, {
                          ...device.config,
                          services: s,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Subnet Mask
                    </label>
                    <input
                      type="text"
                      value={device.config.services.dhcp.mask}
                      onChange={(e) => {
                        const s = { ...device.config.services };
                        if (s.dhcp) s.dhcp.mask = e.target.value;
                        onUpdateDeviceConfig(device.id, {
                          ...device.config,
                          services: s,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Default Gateway
                    </label>
                    <input
                      type="text"
                      value={device.config.services.dhcp.defaultGateway}
                      onChange={(e) => {
                        const s = { ...device.config.services };
                        if (s.dhcp) s.dhcp.defaultGateway = e.target.value;
                        onUpdateDeviceConfig(device.id, {
                          ...device.config,
                          services: s,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* DNS Server Service */}
            {device.config.services.dns && (
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    DNS Server Service
                  </div>
                  <input
                    type="checkbox"
                    checked={device.config.services.dns.enabled}
                    onChange={(e) => {
                      const s = { ...device.config.services };
                      if (s.dns) s.dns.enabled = e.target.checked;
                      onUpdateDeviceConfig(device.id, {
                        ...device.config,
                        services: s,
                      });
                    }}
                    className="w-4 h-4 rounded text-sky-500 bg-slate-950"
                  />
                </div>

                {/* Resource Records List */}
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Resource Records (A / CNAME)
                  </div>
                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-900/60 text-slate-400 text-[10px] uppercase">
                        <tr>
                          <th className="px-3 py-1.5">Domain Name</th>
                          <th className="px-3 py-1.5">Type</th>
                          <th className="px-3 py-1.5">IP Address</th>
                          <th className="px-2 py-1.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {device.config.services.dns.records?.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/30">
                            <td className="px-3 py-1 text-sky-400 font-semibold">{rec.domain}</td>
                            <td className="px-3 py-1 text-slate-400">A Record</td>
                            <td className="px-3 py-1 text-emerald-400">{rec.ip}</td>
                            <td className="px-2 py-1 text-right">
                              <button
                                onClick={() => {
                                  const s = { ...device.config.services };
                                  if (s.dns) {
                                    s.dns.records = s.dns.records.filter((_, i) => i !== idx);
                                    onUpdateDeviceConfig(device.id, { ...device.config, services: s });
                                  }
                                }}
                                className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!device.config.services.dns.records || device.config.services.dns.records.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-3 py-2 text-slate-500 text-center italic">
                              No DNS records configured.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add New DNS Record Form */}
                  <div className="grid grid-cols-12 gap-2 pt-2 items-end">
                    <div className="col-span-5">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Domain</label>
                      <input
                        type="text"
                        placeholder="e.g. cisco.com"
                        value={newDnsDomain}
                        onChange={(e) => setNewDnsDomain(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </div>
                    <div className="col-span-5">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Address</label>
                      <input
                        type="text"
                        placeholder="e.g. 192.168.1.10"
                        value={newDnsIp}
                        onChange={(e) => setNewDnsIp(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        onClick={() => {
                          if (!newDnsDomain.trim() || !newDnsIp.trim()) return;
                          const s = { ...device.config.services };
                          if (s.dns) {
                            if (!s.dns.records) s.dns.records = [];
                            s.dns.records.push({ domain: newDnsDomain.trim(), ip: newDnsIp.trim() });
                            onUpdateDeviceConfig(device.id, { ...device.config, services: s });
                            setNewDnsDomain('');
                            setNewDnsIp('');
                          }
                        }}
                        className="w-full bg-sky-600 hover:bg-sky-500 text-white rounded px-2 py-1 text-xs font-bold transition-all cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* HTTP Web Service */}
            {device.config.services.http && (
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    HTTP Web Server
                  </div>
                  <input
                    type="checkbox"
                    checked={device.config.services.http.enabled}
                    onChange={(e) => {
                      const s = { ...device.config.services };
                      if (s.http) s.http.enabled = e.target.checked;
                      onUpdateDeviceConfig(device.id, {
                        ...device.config,
                        services: s,
                      });
                    }}
                    className="w-4 h-4 rounded text-sky-500 bg-slate-950"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Portal Title
                  </label>
                  <input
                    type="text"
                    value={device.config.services.http.title}
                    onChange={(e) => {
                      const s = { ...device.config.services };
                      if (s.http) s.http.title = e.target.value;
                      onUpdateDeviceConfig(device.id, {
                        ...device.config,
                        services: s,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Page Body Content
                  </label>
                  <textarea
                    rows={2}
                    value={device.config.services.http.body}
                    onChange={(e) => {
                      const s = { ...device.config.services };
                      if (s.http) s.http.body = e.target.value;
                      onUpdateDeviceConfig(device.id, {
                        ...device.config,
                        services: s,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-200"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CISCO STACKWISE SWITCH STACKING */}
        {activeTab === 'stacking' && (
          <StackingView
            device={device}
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
    </div>
  );
};
