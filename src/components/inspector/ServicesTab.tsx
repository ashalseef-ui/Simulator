import React, { useState } from 'react';
import { Device, DeviceConfig } from '../../types/network';
import { Trash2 } from 'lucide-react';

interface ServicesTabProps {
  device: Device;
  onUpdateDeviceConfig: (deviceId: string, config: DeviceConfig) => void;
}

export const ServicesTab: React.FC<ServicesTabProps> = ({
  device,
  onUpdateDeviceConfig,
}) => {
  const [newDnsDomain, setNewDnsDomain] = useState('');
  const [newDnsIp, setNewDnsIp] = useState('');

  if (!device.config.services) {
    return (
      <div className="flex-1 p-8 text-center text-slate-500 text-xs">
        No server services available on this device type.
      </div>
    );
  }

  return (
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
                  {(!device.config.services.dns.records ||
                    device.config.services.dns.records.length === 0) && (
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
                  placeholder="e.g. wirecraft.local"
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
  );
};
