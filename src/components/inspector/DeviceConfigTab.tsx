import React from 'react';
import { Device, DeviceConfig } from '../../types/network';
import { Shield } from 'lucide-react';

interface DeviceConfigTabProps {
  device: Device;
  onUpdateDeviceConfig: (deviceId: string, config: DeviceConfig) => void;
}

export const DeviceConfigTab: React.FC<DeviceConfigTabProps> = ({
  device,
  onUpdateDeviceConfig,
}) => {
  return (
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
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Interface Configurations & Port Settings
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {Object.keys(device.config.interfaces).length} Port
            {Object.keys(device.config.interfaces).length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="space-y-3">
          {Object.entries(device.config.interfaces).map(([portName, iface]) => {
            const isSwitch =
              device.type === 'switch' ||
              device.type === 'switch2960_48' ||
              device.type === 'switch3560' ||
              device.type === 'switch3850' ||
              device.type === 'switch9300' ||
              device.type === 'l3switch' ||
              device.type === 'nexus9000';
            const isL3Switch =
              device.type === 'switch3560' ||
              device.type === 'switch3850' ||
              device.type === 'switch9300' ||
              device.type === 'l3switch';

            return (
              <div
                key={portName}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2.5"
              >
                {/* Port Header & Basic State */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        iface.status === 'up'
                          ? 'bg-emerald-400 ring-2 ring-emerald-500/20'
                          : 'bg-rose-500 ring-2 ring-rose-500/20'
                      }`}
                    />
                    <span className="text-xs font-bold font-mono text-slate-200">
                      {portName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({iface.speed || 100} Mbps)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                      MAC: {iface.mac}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Port Admin:</span>
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
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        iface.status === 'up'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                      }`}
                    >
                      {iface.status.toUpperCase()}
                    </button>
                  </div>
                </div>

                {/* Port Speed, Duplex & Optional Description */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-900/80">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Port Speed
                    </label>
                    <select
                      value={iface.speed || 100}
                      onChange={(e) => {
                        const newIfaces = { ...device.config.interfaces };
                        newIfaces[portName] = {
                          ...iface,
                          speed: parseInt(e.target.value, 10),
                        };
                        onUpdateDeviceConfig(device.id, {
                          ...device.config,
                          interfaces: newIfaces,
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                    >
                      <option value={10}>10 Mbps (Ethernet)</option>
                      <option value={100}>100 Mbps (FastEthernet)</option>
                      <option value={1000}>1000 Mbps (Gigabit)</option>
                      <option value={10000}>10 Gbps (TenGigabit)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Duplex Mode
                    </label>
                    <select
                      value={iface.duplex || 'auto'}
                      onChange={(e) => {
                        const newIfaces = { ...device.config.interfaces };
                        newIfaces[portName] = {
                          ...iface,
                          duplex: e.target.value as any,
                        };
                        onUpdateDeviceConfig(device.id, {
                          ...device.config,
                          interfaces: newIfaces,
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                    >
                      <option value="auto">Auto-Negotiate</option>
                      <option value="full">Full Duplex</option>
                      <option value="half">Half Duplex</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Uplink to Core"
                      value={iface.description || ''}
                      onChange={(e) => {
                        const newIfaces = { ...device.config.interfaces };
                        newIfaces[portName] = {
                          ...iface,
                          description: e.target.value,
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

                {/* IP Configuration (if routed device, SVI, or L3 routed port) */}
                {(!isSwitch ||
                  iface.mode === 'routed' ||
                  portName.toLowerCase().startsWith('vlan')) && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900/80">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">
                        IPv4 Address
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
                {isSwitch && (
                  <div className="space-y-2 pt-1 border-t border-slate-900/80">
                    <div className="grid grid-cols-2 gap-2">
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
                          <option value="trunk">Trunk (802.1Q)</option>
                          {isL3Switch && (
                            <option value="routed">
                              Routed (No Switchport / L3 IP)
                            </option>
                          )}
                        </select>
                      </div>

                      {/* Access Mode Settings */}
                      {(!iface.mode || iface.mode === 'access') && (
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Access VLAN ID (1-4094)
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

                      {/* Trunk Mode Settings - Native VLAN */}
                      {iface.mode === 'trunk' && (
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">
                            Native VLAN (Untagged)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="4094"
                            value={iface.nativeVlan || 1}
                            onChange={(e) => {
                              const newIfaces = { ...device.config.interfaces };
                              newIfaces[portName] = {
                                ...iface,
                                nativeVlan: parseInt(e.target.value, 10) || 1,
                              };
                              onUpdateDeviceConfig(device.id, {
                                ...device.config,
                                interfaces: newIfaces,
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                            placeholder="Default 1"
                          />
                        </div>
                      )}
                    </div>

                    {/* Trunk Allowed VLANs */}
                    {iface.mode === 'trunk' && (
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10px] text-slate-400">
                            Trunk Allowed VLANs (comma-separated, e.g. 10,20,30
                            or blank for ALL)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newIfaces = { ...device.config.interfaces };
                              newIfaces[portName] = {
                                ...iface,
                                trunkAllowedVlans: undefined,
                              };
                              onUpdateDeviceConfig(device.id, {
                                ...device.config,
                                interfaces: newIfaces,
                              });
                            }}
                            className="text-[9px] text-sky-400 hover:text-sky-300"
                          >
                            Allow All (1-4094)
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="1,10,20,99 (empty = all VLANs allowed)"
                          value={
                            iface.trunkAllowedVlans
                              ? iface.trunkAllowedVlans.join(', ')
                              : ''
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            const vlans = raw
                              .split(',')
                              .map((s) => parseInt(s.trim(), 10))
                              .filter((n) => !isNaN(n) && n >= 1 && n <= 4094);
                            const newIfaces = { ...device.config.interfaces };
                            newIfaces[portName] = {
                              ...iface,
                              trunkAllowedVlans:
                                raw.trim() === '' ? undefined : vlans,
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

                    {/* Port Security Configuration for Access Ports */}
                    {iface.mode !== 'trunk' && iface.mode !== 'routed' && (
                      <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/80 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[11px] font-semibold text-slate-300">
                              Port Security
                            </span>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-300">
                            <input
                              type="checkbox"
                              checked={!!iface.portSecurity?.enabled}
                              onChange={(e) => {
                                const newIfaces = {
                                  ...device.config.interfaces,
                                };
                                newIfaces[portName] = {
                                  ...iface,
                                  portSecurity: e.target.checked
                                    ? {
                                        enabled: true,
                                        maxMacs:
                                          iface.portSecurity?.maxMacs || 1,
                                        violation:
                                          iface.portSecurity?.violation ||
                                          'shutdown',
                                        stickyMacs:
                                          iface.portSecurity?.stickyMacs || [],
                                      }
                                    : undefined,
                                };
                                onUpdateDeviceConfig(device.id, {
                                  ...device.config,
                                  interfaces: newIfaces,
                                });
                              }}
                              className="w-3.5 h-3.5 rounded text-sky-500 bg-slate-950 border-slate-700"
                            />
                            <span>Enabled</span>
                          </label>
                        </div>

                        {iface.portSecurity?.enabled && (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Maximum MACs
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="128"
                                value={iface.portSecurity.maxMacs}
                                onChange={(e) => {
                                  const newIfaces = {
                                    ...device.config.interfaces,
                                  };
                                  newIfaces[portName] = {
                                    ...iface,
                                    portSecurity: {
                                      ...iface.portSecurity!,
                                      maxMacs:
                                        parseInt(e.target.value, 10) || 1,
                                    },
                                  };
                                  onUpdateDeviceConfig(device.id, {
                                    ...device.config,
                                    interfaces: newIfaces,
                                  });
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Violation Action
                              </label>
                              <select
                                value={iface.portSecurity.violation}
                                onChange={(e) => {
                                  const newIfaces = {
                                    ...device.config.interfaces,
                                  };
                                  newIfaces[portName] = {
                                    ...iface,
                                    portSecurity: {
                                      ...iface.portSecurity!,
                                      violation: e.target.value as any,
                                    },
                                  };
                                  onUpdateDeviceConfig(device.id, {
                                    ...device.config,
                                    interfaces: newIfaces,
                                  });
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                              >
                                <option value="shutdown">
                                  Shutdown (err-disable)
                                </option>
                                <option value="restrict">
                                  Restrict (drop & count)
                                </option>
                                <option value="protect">
                                  Protect (silent drop)
                                </option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
