import React, { useState } from 'react';
import { Device, DeviceConfig } from '../../types/network';
import { isValidIp } from '../../utils/ipUtils';
import { Settings, Terminal, Globe } from 'lucide-react';

interface DesktopAppsTabProps {
  device: Device;
  allDevices: Device[];
  onUpdateDeviceConfig: (deviceId: string, config: DeviceConfig) => void;
  onRunPingSim: (srcDeviceId: string, dstIp: string) => void;
  onRunDhcpSim: (clientDeviceId: string) => void;
}

export const DesktopAppsTab: React.FC<DesktopAppsTabProps> = ({
  device,
  allDevices,
  onUpdateDeviceConfig,
  onRunPingSim,
  onRunDhcpSim,
}) => {
  const [desktopTool, setDesktopTool] = useState<'ip' | 'terminal' | 'browser'>('ip');

  // Command prompt state
  const [cmdInput, setCmdInput] = useState('');
  const [cmdOutput, setCmdOutput] = useState<string[]>([
    'WireCraft Workstation Command Interpreter [Version 10.0.19045.3803]',
    '(c) WireCraft Corporation. All rights reserved for CCNA network simulation.',
    '',
    "Type 'ping <ip>', 'ipconfig /all', 'tracert <ip>', 'nslookup <domain>' or 'help' for commands.",
    '',
  ]);

  // Browser state
  const [browserUrl, setBrowserUrl] = useState('192.168.1.10');
  const [browserView, setBrowserView] = useState<{
    kind: 'page' | 'error';
    title?: string;
    body?: string;
    url?: string;
  } | null>(null);

  // Command Prompt handler
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
          let resolved: string | undefined;
          for (const d of allDevices) {
            if (d.type === 'server' && d.config.services?.dns?.enabled) {
              const rec = d.config.services.dns.records?.find(
                (r) => r.domain.toLowerCase() === target.toLowerCase()
              );
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
            out.push(
              `Ping request could not find host ${target}. Please check the name and try again.`
            );
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
        out.push(
          `Ping statistics for ${targetIp}: Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`
        );
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
      out.push(
        `   Default Gateway . . . . . . . . . : ${device.config.defaultGateway || '0.0.0.0'}`
      );
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
        out.push('    Record Name . . . . . : wirecraft.local');
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
      const domain = parts[1] || 'wirecraft.local';
      const activeDnsServer = device.config.dnsServer || '192.168.1.10';

      out.push(`Server:  ns1.wirecraft.lab`);
      out.push(`Address: ${activeDnsServer}\n`);

      let resolvedIp: string | undefined;
      for (const d of allDevices) {
        if (d.type === 'server' && d.config.services?.dns?.enabled) {
          const record = d.config.services.dns.records?.find(
            (r) => r.domain.toLowerCase() === domain.toLowerCase()
          );
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
        out.push(`*** ns1.wirecraft.lab can't find ${domain}: Non-existent domain`);
      }
    } else if (lower.startsWith('arp')) {
      if (lower.includes('-d')) {
        out.push('[OK] ARP cache table flushed.');
      } else {
        out.push('Interface: 192.168.1.10 --- 0x2');
        out.push('  Internet Address      Physical Address      Type');
        out.push(`  ${device.config.defaultGateway || '192.168.1.1'}        00-1c-b1-aa-bb-cc     dynamic`);
        out.push('  192.168.1.255         ff-ff-ff-ff-ff-ff     static');
        out.push('  224.0.0.22            01-00-5e-00-00-16     static');
      }
    } else if (lower.startsWith('netstat')) {
      out.push('Active Connections');
      out.push('  Proto  Local Address          Foreign Address        State');
      out.push('  TCP    192.168.1.10:49211     192.168.1.1:80         ESTABLISHED');
      out.push('  TCP    192.168.1.10:49215     8.8.8.8:53             TIME_WAIT');
    } else if (lower.startsWith('route')) {
      out.push('===========================================================================');
      out.push('IPv4 Route Table');
      out.push('Active Routes:');
      out.push('Network Destination        Netmask          Gateway       Interface  Metric');
      out.push(`          0.0.0.0          0.0.0.0      ${(device.config.defaultGateway || '192.168.1.1').padEnd(15)}    192.168.1.10      25`);
      out.push('        127.0.0.0        255.0.0.0         On-link         127.0.0.1     331');
      out.push('      192.168.1.0    255.255.255.0         On-link      192.168.1.10     281');
      out.push('===========================================================================');
    } else if (lower.startsWith('ssh')) {
      const parts = cmd.split(/\s+/);
      const target = parts.find((p) => isValidIp(p)) || '192.168.1.1';
      out.push(`OpenSSH_8.2p1, OpenSSL 1.1.1f  31 Mar 2020`);
      out.push(`Connecting to ${target} port 22... Connection established.`);
      out.push(`Password: [Enter VTY password in device terminal]`);
    } else if (lower.startsWith('telnet')) {
      const parts = cmd.split(/\s+/);
      const target = parts.find((p) => isValidIp(p)) || '192.168.1.1';
      out.push(`Trying ${target}... Open`);
      out.push(`User Access Verification`);
      out.push(`Password: `);
    } else if (lower.startsWith('curl') || lower.startsWith('wget') || lower.startsWith('http')) {
      out.push(
        'HTTP/1.1 200 OK\nContent-Type: text/html\nServer: WireCraft Linux Web Engine\n\n<html><body><h1>WireCraft Web Portal</h1><p>Connection Successful</p></body></html>'
      );
    } else if (lower === 'hostname') {
      out.push(device.config.hostname || device.name);
    } else if (lower === 'whoami') {
      out.push('wirecraft-user\\admin');
    } else if (lower === 'systeminfo') {
      out.push(
        `Host Name:                 ${device.config.hostname || device.name}\nOS Name:                   WireCraft Workstation OS v10.0\nSystem Type:               x64-based PC\nNetwork Card(s):           1 NIC(s) Installed.\n                           [01]: FastEthernet0/0 - Status: Connected`
      );
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
      out.push(
        `'${cmd}' is not recognized as an internal or external command. Type 'help' for available commands.`
      );
    }

    setCmdOutput(out);
    setCmdInput('');
  };

  // Browser navigation handler
  const handleBrowserNavigate = () => {
    const cleanUrl = browserUrl.replace(/^https?:\/\//, '');
    let foundServer: Device | undefined;
    for (const d of allDevices) {
      if (d.type === 'server' && d.config.services?.http?.enabled) {
        for (const iface of Object.values(d.config.interfaces)) {
          if (iface.ip === cleanUrl) foundServer = d;
        }
        const dnsMatch = d.config.services?.dns?.records?.some((r) => r.domain === cleanUrl);
        if (dnsMatch) foundServer = d;
      }
    }

    if (foundServer?.config.services?.http) {
      const h = foundServer.config.services.http;
      setBrowserView({ kind: 'page', title: h.title, body: h.body });
    } else {
      setBrowserView({ kind: 'error', url: browserUrl });
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 bg-slate-950 text-slate-200">
      {/* Desktop Tool Switcher */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setDesktopTool('ip')}
          className={`flex-1 p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            desktopTool === 'ip'
              ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          IP Configuration
        </button>
        <button
          onClick={() => setDesktopTool('terminal')}
          className={`flex-1 p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            desktopTool === 'terminal'
              ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          Command Prompt
        </button>
        <button
          onClick={() => setDesktopTool('browser')}
          className={`flex-1 p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            desktopTool === 'browser'
              ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
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
                    <span>
                      Active Interface: <strong className="text-sky-400">{primaryName}</strong>
                    </span>
                    <span>
                      MAC: <strong className="text-slate-300">{primaryIface.mac}</strong>
                    </span>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">IPv4 Address</label>
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
                    <label className="text-xs text-slate-400 block mb-1">Subnet Mask</label>
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
              <label className="text-xs text-slate-400 block mb-1">Default Gateway</label>
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
              <label className="text-xs text-slate-400 block mb-1">DNS Server</label>
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
          <form
            onSubmit={handleCmdSubmit}
            className="flex items-center pt-2 border-t border-slate-800 mt-2"
          >
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
              className="px-3 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded text-xs font-bold cursor-pointer transition-colors"
            >
              Go
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-slate-950">
            {browserView?.kind === 'page' && (
              <div className="p-6 bg-slate-900 text-slate-100 rounded-lg border border-slate-800">
                <div className="text-xl font-bold text-sky-400 mb-2">{browserView.title}</div>
                <p className="text-sm text-slate-300 leading-relaxed">{browserView.body}</p>
                <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
                  Served by WireCraft Enterprise Web Engine (HTTP/1.1 200 OK)
                </div>
              </div>
            )}
            {browserView?.kind === 'error' && (
              <div className="p-6 bg-slate-900 text-slate-300 rounded-lg border border-slate-800 text-center">
                <div className="text-lg font-bold text-rose-400 mb-1">404 Not Found</div>
                <p className="text-xs text-slate-400">
                  Unable to establish connection to {browserView.url}. Server offline or host
                  unreachable.
                </p>
              </div>
            )}
            {!browserView && (
              <div className="text-center py-12 text-slate-500 text-xs">
                Enter server URL or domain (e.g. 192.168.1.10) and click Go.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
