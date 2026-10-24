import React, { useState } from 'react';
import { Device, DeviceConfig, Link } from '../types/network';
import { computeEigrpNetworkState } from '../engine/protocols/eigrpEngine';
import { computeBgpNetworkState } from '../engine/protocols/bgpEngine';
import { computeMplsNetworkState } from '../engine/protocols/mplsEngine';
import { computeIpsecSessions } from '../engine/protocols/ipsecEngine';
import { computeVxlanState } from '../engine/protocols/vxlanEngine';
import { computeSrv6State } from '../engine/protocols/srv6Engine';
import { computeIsisNetworkState } from '../engine/protocols/isisEngine';
import { computeWirelessIotNetworkState } from '../engine/protocols/wirelessIotEngine';
import { computeOspf } from '../engine/ospfEngine';
import {
  Network,
  Radio,
  Cpu,
  Shield,
  Layers,
  Globe,
  Share2,
  Activity,
  Wifi,
} from 'lucide-react';

interface ProtocolsDashboardProps {
  device: Device;
  allDevices: Device[];
  allLinks: Link[];
  onUpdateDeviceConfig: (deviceId: string, config: DeviceConfig) => void;
}

type ProtocolTab =
  | 'eigrp'
  | 'bgp'
  | 'ospf'
  | 'hsrp'
  | 'mpls'
  | 'ipsec'
  | 'vxlan'
  | 'srv6'
  | 'isis'
  | 'wireless'
  | 'iot';

export const ProtocolsDashboard: React.FC<ProtocolsDashboardProps> = ({
  device,
  allDevices,
  allLinks,
  onUpdateDeviceConfig,
}) => {
  const [selectedProto, setSelectedProto] = useState<ProtocolTab>('eigrp');

  // Compute live protocol states
  const eigrpState = computeEigrpNetworkState(allDevices, allLinks);
  const bgpState = computeBgpNetworkState(allDevices, allLinks);
  const mplsState = computeMplsNetworkState(allDevices, allLinks);
  const ipsecState = computeIpsecSessions(allDevices);
  const vxlanState = computeVxlanState(allDevices);
  const srv6State = computeSrv6State(allDevices);
  const isisState = computeIsisNetworkState(allDevices, allLinks);
  const wirelessIotState = computeWirelessIotNetworkState(allDevices, allLinks);
  const ospfState = computeOspf(allDevices, allLinks);

  const devEigrpNeighbors = eigrpState.neighbors[device.id] || [];
  const devEigrpRoutes = eigrpState.routes[device.id] || [];
  const devBgpPeers = bgpState.peers[device.id] || [];
  const devBgpEvpn = bgpState.evpnTable[device.id] || [];
  const devMplsLfib = mplsState.lfib[device.id] || [];
  const devIpsecTunnels = ipsecState.activeTunnels.filter(
    (t) => t.localGatewayIp && Object.values(device.config.interfaces).some((i) => i.ip === t.localGatewayIp)
  );
  const devVxlan = vxlanState.vtepOverlays.filter(
    (v) => v.localVtepIp && Object.values(device.config.interfaces).some((i) => i.ip === v.localVtepIp)
  );
  const devSrv6Sids = srv6State.activeSids[device.id] || [];
  const devIsisNeighbors = isisState.neighbors[device.id] || [];
  const devOspfNeighbors = ospfState.neighbors[device.id] || [];
  const devOspfRoutes = ospfState.routes[device.id] || [];

  const PROTOCOL_NAV: { id: ProtocolTab; label: string; icon: React.FC<{ className?: string }>; active: boolean }[] = [
    { id: 'eigrp', label: 'EIGRP', icon: Network, active: !!device.config.eigrp },
    { id: 'bgp', label: 'BGP & EVPN', icon: Globe, active: !!device.config.bgp },
    { id: 'ospf', label: 'OSPF', icon: Share2, active: !!device.config.ospf },
    { id: 'hsrp', label: 'HSRP (FHRP)', icon: Layers, active: Object.values(device.config.interfaces).some((i) => !!i.hsrp) },
    { id: 'mpls', label: 'MPLS & LDP', icon: Layers, active: !!device.config.mpls?.enabled || Object.values(device.config.interfaces).some((i) => !!i.mplsEnabled) },
    { id: 'ipsec', label: 'IPsec VPN', icon: Shield, active: !!device.config.ipsec || Object.values(device.config.interfaces).some((i) => !!i.ipsecCryptoMap) },
    { id: 'vxlan', label: 'VXLAN VTEP', icon: Network, active: !!device.config.vxlan },
    { id: 'srv6', label: 'SRv6', icon: Cpu, active: !!device.config.srv6?.enabled },
    { id: 'isis', label: 'IS-IS', icon: Activity, active: !!device.config.isis },
    { id: 'wireless', label: '802.11 WiFi', icon: Wifi, active: !!device.config.wireless || device.type === 'wlc' || device.type === 'ap' },
    { id: 'iot', label: 'IoT & MQTT', icon: Radio, active: !!device.config.iot || device.type === 'iot_sensor' || device.type === 'iot_gateway' },
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-slate-950 text-slate-200">
      {/* Sidebar Selector */}
      <div className="w-full md:w-56 bg-slate-900/90 border-r border-slate-800 flex flex-col p-2 space-y-1 overflow-y-auto shrink-0">
        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Enterprise & SP Protocols
        </div>
        {PROTOCOL_NAV.map((p) => {
          const Icon = p.icon;
          const isSelected = selectedProto === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedProto(p.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                <span>{p.label}</span>
              </div>
              {p.active && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-500/20" />
              )}
            </button>
          );
        })}
      </div>

      {/* Protocol Main Display Panel */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 custom-scrollbar">
        {/* 1. EIGRP */}
        {selectedProto === 'eigrp' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Network className="w-4 h-4 text-sky-400" />
                  EIGRP (Enhanced Interior Gateway Routing Protocol)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Cisco DUAL finite-state machine with composite metrics: 256 * (BW + Delay)
                </p>
              </div>
              <span
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                  device.config.eigrp
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {device.config.eigrp ? `AS ${device.config.eigrp.asNumber} Active` : 'Not Configured'}
              </span>
            </div>

            {device.config.eigrp ? (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Autonomous System</span>
                    <span className="text-base font-bold font-mono text-sky-400">{device.config.eigrp.asNumber}</span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Router ID</span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      {device.config.eigrp.routerId || Object.values(device.config.interfaces)[0]?.ip || '10.0.0.1'}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Adjacencies</span>
                    <span className="text-base font-bold font-mono text-amber-400">{devEigrpNeighbors.length}</span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">DUAL Successors</span>
                    <span className="text-base font-bold font-mono text-indigo-400">{devEigrpRoutes.length}</span>
                  </div>
                </div>

                {/* Neighbors Table */}
                <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-200">EIGRP Neighbor Adjacencies</div>
                  {devEigrpNeighbors.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2">Neighbor Device</th>
                            <th className="py-2">Neighbor IP</th>
                            <th className="py-2">Interface</th>
                            <th className="py-2">Holdtime</th>
                            <th className="py-2">SRTT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {devEigrpNeighbors.map((nbr: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="py-2 text-sky-300">{allDevices.find((d) => d.id === nbr.neighborId)?.name || nbr.neighborId}</td>
                              <td className="py-2 text-emerald-300">{nbr.neighborIp}</td>
                              <td className="py-2 text-slate-300">{nbr.localInterface}</td>
                              <td className="py-2 text-slate-400">{nbr.holdTime}s</td>
                              <td className="py-2 text-slate-400">{nbr.srtt} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No neighbors detected in AS {device.config.eigrp.asNumber} on local subnets.</p>
                  )}
                </div>

                {/* Topology Table */}
                <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-200">EIGRP Topology & Successor Routes</div>
                  {devEigrpRoutes.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2">Prefix</th>
                            <th className="py-2">Next-Hop</th>
                            <th className="py-2">Interface</th>
                            <th className="py-2">Composite Metric (FD)</th>
                            <th className="py-2">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {devEigrpRoutes.map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="py-2 text-sky-300">{r.prefix}/{r.mask}</td>
                              <td className="py-2 text-emerald-300">{r.nextHop}</td>
                              <td className="py-2 text-slate-300">{r.outInterface}</td>
                              <td className="py-2 text-amber-300">{r.metric.toLocaleString()}</td>
                              <td className="py-2 text-slate-400">{r.isExternal ? 'EX (AD 170)' : 'Internal (AD 90)'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No routes calculated yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-center space-y-3">
                <p className="text-xs text-slate-400">EIGRP is not enabled on this device.</p>
                <button
                  onClick={() => {
                    onUpdateDeviceConfig(device.id, {
                      ...device.config,
                      eigrp: {
                        asNumber: 100,
                        networks: [{ network: '10.0.0.0', wildcard: '0.0.0.255' }],
                      },
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Enable EIGRP AS 100
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. BGP & BGP EVPN */}
        {selectedProto === 'bgp' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  BGP & BGP EVPN (Border Gateway Protocol)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  eBGP/iBGP path vector with Weight, Local-Pref, AS-Path, and L2VPN EVPN Type-2/3 address-family.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                  device.config.bgp
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {device.config.bgp ? `AS ${device.config.bgp.asn}` : 'Not Configured'}
              </span>
            </div>

            {device.config.bgp ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Local AS</span>
                    <span className="text-base font-bold font-mono text-emerald-400">{device.config.bgp.asn}</span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Router ID</span>
                    <span className="text-base font-bold font-mono text-sky-400">
                      {device.config.bgp.routerId || Object.values(device.config.interfaces)[0]?.ip || '10.0.0.1'}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Peers</span>
                    <span className="text-base font-bold font-mono text-amber-400">{devBgpPeers.length}</span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">EVPN Address Family</span>
                    <span className="text-xs font-bold font-mono text-indigo-400">
                      {device.config.bgp.addressFamilies?.l2vpnEvpn ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Peers Table */}
                <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-200">BGP Neighbors</div>
                  {devBgpPeers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2">Neighbor IP</th>
                            <th className="py-2">Remote AS</th>
                            <th className="py-2">Type</th>
                            <th className="py-2">State</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {devBgpPeers.map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="py-2 text-sky-300">{p.peerIp}</td>
                              <td className="py-2 text-emerald-300">{p.remoteAs}</td>
                              <td className="py-2 text-slate-300">{p.isExternal ? 'eBGP' : 'iBGP'}</td>
                              <td className="py-2 text-emerald-400">{p.state}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No peers configured or reached.</p>
                  )}
                </div>

                {/* EVPN Table */}
                {device.config.bgp.addressFamilies?.l2vpnEvpn && (
                  <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-200">BGP EVPN RIB (RFC 7432)</div>
                    {devBgpEvpn.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="py-2">Route Type</th>
                              <th className="py-2">RD</th>
                              <th className="py-2">VNI</th>
                              <th className="py-2">MAC Address</th>
                              <th className="py-2">Next Hop (VTEP)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {devBgpEvpn.map((r, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/40">
                                <td className="py-2 text-amber-300">{r.type.toUpperCase()}</td>
                                <td className="py-2 text-slate-400">{r.rd}</td>
                                <td className="py-2 text-sky-300">{r.vni}</td>
                                <td className="py-2 text-emerald-300">{r.mac || '-'}</td>
                                <td className="py-2 text-slate-300">{r.nextHop}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No EVPN MAC/IP or IMET routes advertised.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-center space-y-3">
                <p className="text-xs text-slate-400">BGP is not enabled on this device.</p>
                <button
                  onClick={() => {
                    onUpdateDeviceConfig(device.id, {
                      ...device.config,
                      bgp: {
                        asn: 65001,
                        routerId: Object.values(device.config.interfaces)[0]?.ip || '10.255.0.1',
                        neighbors: [],
                        networks: [],
                        addressFamilies: { l2vpnEvpn: true },
                      },
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Enable BGP AS 65001 with EVPN
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. OSPF */}
        {selectedProto === 'ospf' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-amber-400" />
                  OSPF (Open Shortest Path First)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Link-state Dijkstra SPF shortest-path tree with Area 0 backbone hierarchy.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                  device.config.ospf
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {device.config.ospf ? `Process ${device.config.ospf.processId}` : 'Not Configured'}
              </span>
            </div>

            {device.config.ospf ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Process ID</span>
                    <span className="text-base font-bold font-mono text-amber-400">{device.config.ospf.processId}</span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Router ID</span>
                    <span className="text-base font-bold font-mono text-sky-400">
                      {device.config.ospf.routerId || Object.values(device.config.interfaces)[0]?.ip || '1.1.1.1'}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Adjacencies</span>
                    <span className="text-base font-bold font-mono text-emerald-400">{devOspfNeighbors.length}</span>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">SPF Routes</span>
                    <span className="text-base font-bold font-mono text-indigo-400">{devOspfRoutes.length}</span>
                  </div>
                </div>

                {/* Neighbors */}
                <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-200">OSPF Neighbors</div>
                  {devOspfNeighbors.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2">Neighbor ID</th>
                            <th className="py-2">Priority</th>
                            <th className="py-2">State</th>
                            <th className="py-2">Dead Time</th>
                            <th className="py-2">Address</th>
                            <th className="py-2">Interface</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {devOspfNeighbors.map((nbr: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="py-2 text-sky-300">{nbr.routerId}</td>
                              <td className="py-2 text-slate-300">{nbr.priority}</td>
                              <td className="py-2 text-emerald-400 font-bold">{nbr.state}</td>
                              <td className="py-2 text-slate-400">{nbr.deadSeconds}s</td>
                              <td className="py-2 text-amber-300">{nbr.address}</td>
                              <td className="py-2 text-slate-300">{nbr.localInterface}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No OSPF neighbors in FULL state.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-center space-y-3">
                <p className="text-xs text-slate-400">OSPF is not enabled on this device.</p>
                <button
                  onClick={() => {
                    onUpdateDeviceConfig(device.id, {
                      ...device.config,
                      ospf: {
                        processId: 1,
                        networks: [{ network: '10.0.0.0', wildcard: '0.0.0.255', area: 0 }],
                      },
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Enable OSPF Process 1
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. HSRP */}
        {selectedProto === 'hsrp' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  HSRP (Hot Standby Router Protocol - RFC 2281)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Default gateway redundancy with Virtual IP and Cisco Virtual MAC 0000.0c07.acXX.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(device.config.interfaces)
                .filter(([, iface]) => !!iface.hsrp)
                .map(([portName, iface]) => {
                  const h = iface.hsrp!;
                  const isMaster = h.state === 'Active';
                  return (
                    <div key={portName} className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isMaster ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span className="text-xs font-bold font-mono text-white">{portName} - Group {h.group}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${isMaster ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          {h.state}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">Virtual IP</span>
                          <span className="text-sky-300 font-bold">{h.virtualIp || 'Not set'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">Virtual MAC</span>
                          <span className="text-indigo-300">{`0000.0c07.ac${h.group.toString(16).padStart(2, '0')}`}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">Priority</span>
                          <span className="text-white">{h.priority}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">Preempt</span>
                          <span className="text-white">{h.preempt ? 'Enabled' : 'Disabled'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {Object.values(device.config.interfaces).every((i) => !i.hsrp) && (
                <div className="p-6 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-center space-y-3">
                  <p className="text-xs text-slate-400">No HSRP groups configured on any interface of this device.</p>
                  <button
                    onClick={() => {
                      const firstIface = Object.keys(device.config.interfaces)[0];
                      if (firstIface) {
                        const ifaces = { ...device.config.interfaces };
                        ifaces[firstIface].hsrp = {
                          group: 1,
                          virtualIp: '192.168.1.1',
                          priority: 110,
                          preempt: true,
                          state: 'Active',
                        };
                        onUpdateDeviceConfig(device.id, { ...device.config, interfaces: ifaces });
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Configure HSRP Group 1 on primary interface
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. MPLS & LDP */}
        {selectedProto === 'mpls' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Full MPLS & LDP (Label Distribution Protocol)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Label-switched routing (LSR / LER) with LFIB, Push, Swap, and Pop (PHP) label operations.
                </p>
              </div>
              <span
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                  device.config.mpls?.enabled
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {device.config.mpls?.enabled ? 'LDP Active' : 'Not Configured'}
              </span>
            </div>

            {device.config.mpls?.enabled ? (
              <div className="space-y-4">
                <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-200">Label Forwarding Information Base (LFIB)</div>
                  {devMplsLfib.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="text-[10px] text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2">Local Tag</th>
                            <th className="py-2">Outgoing Tag</th>
                            <th className="py-2">Prefix</th>
                            <th className="py-2">Next Hop</th>
                            <th className="py-2">Out Interface</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {devMplsLfib.map((e, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="py-2 text-purple-300">{e.inLabel}</td>
                              <td className="py-2 text-amber-300">{e.outLabel}</td>
                              <td className="py-2 text-sky-300">{e.prefix}</td>
                              <td className="py-2 text-emerald-300">{e.nextHop}</td>
                              <td className="py-2 text-slate-300">{e.outInterface}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No LFIB entries present.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-center space-y-3">
                <p className="text-xs text-slate-400">MPLS is not enabled on this device.</p>
                <button
                  onClick={() => {
                    const ifaces = { ...device.config.interfaces };
                    Object.keys(ifaces).forEach((k) => (ifaces[k].mplsEnabled = true));
                    onUpdateDeviceConfig(device.id, {
                      ...device.config,
                      mpls: {
                        enabled: true,
                        routerId: Object.values(device.config.interfaces)[0]?.ip || '10.255.0.1',
                        lfib: [
                          { inLabel: 1001, outLabel: 'Pop', prefix: '192.168.10.0/24', nextHop: '10.0.0.2', outInterface: 'Gi0/0' },
                        ],
                      },
                      interfaces: ifaces,
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Enable MPLS IP & LDP
                </button>
              </div>
            )}
          </div>
        )}

        {/* 6. IPsec */}
        {selectedProto === 'ipsec' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  IPsec VPN (IKEv1 / IKEv2 Phase 1 & 2 ESP Tunnel)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Site-to-site cryptographic encryption with Transform Sets and Crypto Access-Lists.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-200">Active IPsec Crypto Sessions</div>
              {devIpsecTunnels.length > 0 ? (
                <div className="space-y-3">
                  {devIpsecTunnels.map((t: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                      <div className="flex justify-between items-center text-emerald-400 font-bold">
                        <span>{t.localGatewayIp} &harr; {t.remoteGatewayIp}</span>
                        <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">UP-ACTIVE</span>
                      </div>
                      <div className="text-slate-400">Cipher/Auth: {t.cipher} / {t.hash} | SPI: 0x3bf7a01c</div>
                      <div className="text-sky-300">Protected Subnet: {t.localSubnet} &rarr; {t.remoteSubnet}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No active IPsec crypto sessions found.</p>
              )}
            </div>
          </div>
        )}

        {/* 7. VXLAN */}
        {selectedProto === 'vxlan' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Network className="w-4 h-4 text-sky-400" />
                  VXLAN Overlay (RFC 7348)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Virtual Extensible LAN over L3 IP (UDP 4789) with 24-bit VNIs.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-200">VTEP Overlays & VNI Mappings</div>
              {devVxlan.length > 0 ? (
                <div className="space-y-2">
                  {devVxlan.map((v, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                      <div className="text-sky-400 font-bold">VNI {v.vni} &harr; VLAN {v.vlan}</div>
                      <div className="text-slate-400">Local VTEP: {v.localVtepIp} | Remote VTEP: {v.remoteVtepIp}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No VXLAN VTEP overlays configured.</p>
              )}
            </div>
          </div>
        )}

        {/* 8. SRv6 */}
        {selectedProto === 'srv6' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-rose-400" />
                  SRv6 (Segment Routing over IPv6 - RFC 8754 / 8986)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Source routing with 128-bit IPv6 Segment Identifiers (SIDs) and Segment Routing Header (SRH).
                </p>
              </div>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-200">Active Segment Identifiers (SIDs)</div>
              {devSrv6Sids.length > 0 ? (
                <div className="space-y-2">
                  {devSrv6Sids.map((sid, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-rose-300">
                      {sid} &bull; End behavior
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No SRv6 SIDs allocated for this node.</p>
              )}
            </div>
          </div>
        )}

        {/* 9. IS-IS */}
        {selectedProto === 'isis' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  IS-IS (Intermediate System to Intermediate System)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  ISO/IEC 10589 link-state protocol with NET addressing and Level 1 / Level 2 hierarchy.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-200">IS-IS Adjacencies</div>
                {devIsisNeighbors.length > 0 ? (
                  <div className="space-y-2">
                    {devIsisNeighbors.map((n, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono flex justify-between">
                        <span className="text-sky-300">{n.systemId} ({n.level})</span>
                        <span className="text-emerald-400 font-bold">{n.state}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No IS-IS neighbors established.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 10. Wireless */}
        {selectedProto === 'wireless' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-cyan-400" />
                  Wireless 802.11 & CAPWAP Controller Fabric
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Lightweight AP to WLC CAPWAP control & data tunnels with 802.11ax client associations.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-200">Registered Access Points (CAPWAP)</div>
                {wirelessIotState.registeredAps.length > 0 ? (
                  <div className="space-y-2">
                    {wirelessIotState.registeredAps.map((ap: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono flex justify-between">
                        <span className="text-cyan-300">{ap.apName}</span>
                        <span className="text-emerald-400 font-bold">CAPWAP: {ap.capwapState}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No Access Points connected to controller.</p>
                )}
              </div>

              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-200">Client Wireless Associations</div>
                {wirelessIotState.associations.length > 0 ? (
                  <div className="space-y-2">
                    {wirelessIotState.associations.map((assoc: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono flex justify-between">
                        <span className="text-slate-200">SSID: <strong className="text-cyan-400">{assoc.ssid}</strong> (AP: {assoc.apName})</span>
                        <span className="text-emerald-400">{assoc.rssiDbm} dBm &bull; {assoc.clientIp || 'DHCP'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No wireless clients currently associated.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 11. IoT */}
        {selectedProto === 'iot' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  IoT Sensors & MQTT Telemetry
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Environmental sensor metrics, alert monitoring, and lightweight broker telemetry feeds.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-200">Connected Sensors</div>
              {wirelessIotState.iotSensorsStatus.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {wirelessIotState.iotSensorsStatus.map((sens: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-400 font-bold">{sens.deviceName}</span>
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 uppercase">{sens.sensorType}</span>
                      </div>
                      <div className="text-slate-400">Broker: {sens.brokerIp} &bull; State: <span className="text-emerald-400">{sens.status}</span></div>
                      <div className="p-2 bg-slate-900/80 rounded mt-2 text-[11px] text-slate-300">
                        {JSON.stringify(sens.telemetry)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No active IoT sensors in network.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
