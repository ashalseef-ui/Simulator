import React, { useState } from 'react';
import { Device, DeviceConfig, StackConfig, StackMember } from '../types/network';
import {
  Layers,
  ShieldCheck,
  Zap,
  Plus,
  Trash2,
  Cable,
  Activity,
} from 'lucide-react';

interface StackingViewProps {
  device: Device;
  onUpdateDeviceConfig: (deviceId: string, config: DeviceConfig) => void;
}

export const StackingView: React.FC<StackingViewProps> = ({
  device,
  onUpdateDeviceConfig,
}) => {
  // Initialize default stack config if not present
  const stack: StackConfig = device.config.stack || {
    enabled: true,
    ringSpeed: '480 Gbps',
    ringState: 'Full',
    members: [
      {
        memberId: 1,
        role: 'Active',
        priority: 15,
        mac: Object.values(device.config.interfaces)[0]?.mac || '001c.b100.0001',
        model: 'WS-C3650-24TS',
        state: 'Ready',
        stackPorts: { port1: 'Ok', port2: 'Ok' },
      },
      {
        memberId: 2,
        role: 'Standby',
        priority: 14,
        mac: '001c.b100.0002',
        model: 'WS-C3650-24TS',
        state: 'Ready',
        stackPorts: { port1: 'Ok', port2: 'Ok' },
      },
    ],
  };

  const [switchoverLog, setSwitchoverLog] = useState<string | null>(null);
  const [newMemberModel, setNewMemberModel] = useState<string>('WS-C3650-24TS');

  const updateStack = (newStack: StackConfig) => {
    onUpdateDeviceConfig(device.id, {
      ...device.config,
      stack: newStack,
    });
  };

  // Trigger SSO Failover
  const handleTriggerSso = () => {
    const activeIdx = stack.members.findIndex((m) => m.role === 'Active');
    const standbyIdx = stack.members.findIndex((m) => m.role === 'Standby');

    if (activeIdx === -1 || standbyIdx === -1) return;

    const newMembers = [...stack.members];
    newMembers[activeIdx] = { ...newMembers[activeIdx], role: 'Standby' };
    newMembers[standbyIdx] = { ...newMembers[standbyIdx], role: 'Active' };

    updateStack({
      ...stack,
      members: newMembers,
    });

    setSwitchoverLog(
      `[${new Date().toLocaleTimeString()}] %RF-5-SWITCHOVER: Switch ${newMembers[standbyIdx].memberId} promoted to Active Master (SSO Switchover completed with 0ms downtime).`
    );
  };

  // Toggle Ring Cable Break (Full vs Partial)
  const handleToggleRingCable = () => {
    const nextState = stack.ringState === 'Full' ? 'Partial' : 'Full';
    const newMembers = stack.members.map((m, idx) => {
      if (nextState === 'Partial' && idx === 0) {
        return {
          ...m,
          stackPorts: { port1: 'Ok' as const, port2: 'Down' as const },
        };
      }
      return {
        ...m,
        stackPorts: { port1: 'Ok' as const, port2: 'Ok' as const },
      };
    });

    updateStack({
      ...stack,
      ringState: nextState,
      members: newMembers,
    });

    setSwitchoverLog(
      nextState === 'Partial'
        ? `[${new Date().toLocaleTimeString()}] %STACKMGR-4-STACK_LINK_CHANGE: StackPort 2 on Switch 1 changed state to DOWN. Ring topology degraded to Partial.`
        : `[${new Date().toLocaleTimeString()}] %STACKMGR-4-STACK_LINK_CHANGE: Stack cable restored. Ring topology returned to FULL DUPLEX 480 Gbps.`
    );
  };

  // Update Member Priority
  const handlePriorityChange = (memberId: number, prio: number) => {
    const newMembers = stack.members.map((m) =>
      m.memberId === memberId ? { ...m, priority: prio } : m
    );
    // Sort & re-elect active if needed
    updateStack({
      ...stack,
      members: newMembers,
    });
  };

  // Add Member to Stack & Provision its 24 Unified Ports
  const handleAddMember = () => {
    if (stack.members.length >= 8) return;
    const nextId = Math.max(...stack.members.map((m) => m.memberId), 0) + 1;
    const newMember: StackMember = {
      memberId: nextId,
      role: 'Member',
      priority: 1,
      mac: `001c.b100.000${nextId}`,
      model: newMemberModel,
      state: 'Ready',
      stackPorts: { port1: 'Ok', port2: 'Ok' },
    };

    // Auto-provision 24 ports for this new stack member unit
    const updatedIfaces = { ...device.config.interfaces };
    for (let p = 1; p <= 24; p++) {
      const portName = `Gi${nextId}/0/${p}`;
      if (!updatedIfaces[portName]) {
        updatedIfaces[portName] = {
          name: portName,
          mac: `00:1c:b1:0${nextId}:00:${p.toString().padStart(2, '0')}`,
          status: 'up',
          speed: 1000,
          mode: 'access',
          accessVlan: 1,
        };
      }
    }

    onUpdateDeviceConfig(device.id, {
      ...device.config,
      interfaces: updatedIfaces,
      stack: {
        ...stack,
        members: [...stack.members, newMember],
      },
    });

    setSwitchoverLog(
      `[${new Date().toLocaleTimeString()}] %STACKMGR-5-SWITCH_ADDED: Switch ${nextId} (${newMemberModel}) joined StackWise ring. 24 unified ports (Gi${nextId}/0/1-24) provisioned.`
    );
  };

  // Remove Member from Stack & cleanup its ports
  const handleRemoveMember = (memberId: number) => {
    if (stack.members.length <= 1) return;
    const newMembers = stack.members.filter((m) => m.memberId !== memberId);
    if (!newMembers.some((m) => m.role === 'Active') && newMembers.length > 0) {
      newMembers[0].role = 'Active';
    }

    // Remove interfaces for this stack member
    const updatedIfaces = { ...device.config.interfaces };
    for (let p = 1; p <= 24; p++) {
      delete updatedIfaces[`Gi${memberId}/0/${p}`];
    }

    onUpdateDeviceConfig(device.id, {
      ...device.config,
      interfaces: updatedIfaces,
      stack: {
        ...stack,
        members: newMembers,
      },
    });
  };

  return (
    <div className="flex-1 flex flex-col p-4 bg-slate-950 text-slate-200 overflow-y-auto custom-scrollbar space-y-4">
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 p-4 rounded-xl border border-sky-900/40 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-500/20 border border-sky-400/30 text-sky-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Cisco StackWise-480 Architecture</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                SSO Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Unified control & management plane with single IP management and cross-stack EtherChannel.
            </p>
          </div>
        </div>

        {/* Ring Metrics */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">RING BANDWIDTH</span>
            <span className="text-sky-400 font-bold">{stack.ringSpeed}</span>
          </div>
          <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">TOPOLOGY</span>
            <span className={`font-bold flex items-center gap-1 ${stack.ringState === 'Full' ? 'text-emerald-400' : 'text-amber-400'}`}>
              <Activity className="w-3 h-3" />
              {stack.ringState} Ring
            </span>
          </div>
          <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">STACK MEMBERS</span>
            <span className="text-indigo-400 font-bold">{stack.members.length} Switches</span>
          </div>
        </div>
      </div>

      {/* Simulator Quick Action Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-900/90 rounded-xl border border-slate-800">
        <button
          onClick={handleTriggerSso}
          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
        >
          <Zap className="w-3.5 h-3.5" />
          Trigger SSO Failover (Active ➔ Standby)
        </button>

        <button
          onClick={handleToggleRingCable}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
            stack.ringState === 'Full'
              ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-300'
              : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <Cable className="w-3.5 h-3.5" />
          {stack.ringState === 'Full' ? 'Simulate Stack Cable Cut (Degrade)' : 'Restore Stack Cable (Heal Ring)'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={newMemberModel}
            onChange={(e) => setNewMemberModel(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 font-mono"
          >
            <option value="WS-C3650-24TS">WS-C3650-24TS</option>
            <option value="WS-C3850-24T">WS-C3850-24T</option>
            <option value="C9300-24T">Catalyst 9300-24T</option>
            <option value="WS-C2960X-24TS">Catalyst 2960-X</option>
          </select>
          <button
            onClick={handleAddMember}
            disabled={stack.members.length >= 8}
            className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Stack Member
          </button>
        </div>
      </div>

      {/* Switchover Alert / Log */}
      {switchoverLog && (
        <div className="bg-black/60 p-3 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 flex items-center justify-between">
          <span>{switchoverLog}</span>
          <button onClick={() => setSwitchoverLog(null)} className="text-slate-500 hover:text-slate-300 text-[10px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Stack Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {stack.members.map((member) => {
          const isActive = member.role === 'Active';
          const isStandby = member.role === 'Standby';

          return (
            <div
              key={member.memberId}
              className={`p-4 rounded-xl border transition-all ${
                isActive
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
                  : isStandby
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              {/* Member Card Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isActive
                        ? 'bg-emerald-500 text-black'
                        : isStandby
                        ? 'bg-amber-500 text-black'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    #{member.memberId}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      Switch {member.memberId}
                      <span className="text-[10px] text-slate-400 font-normal">({member.model})</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">{member.mac}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : isStandby
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {member.role === 'Active' ? 'Active Master' : member.role === 'Standby' ? 'Standby Hot' : 'Member'}
                  </span>
                  {stack.members.length > 1 && (
                    <button
                      onClick={() => handleRemoveMember(member.memberId)}
                      className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      title="Remove Member from Stack"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Stack Ports Status & Priority Controls */}
              <div className="space-y-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Master Election Priority:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="15"
                      value={member.priority}
                      onChange={(e) => handlePriorityChange(member.memberId, parseInt(e.target.value, 10))}
                      className="w-24 accent-sky-500 cursor-pointer"
                    />
                    <span className="font-mono font-bold text-sky-400 w-5 text-right">{member.priority}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 font-mono text-[11px]">
                  <span className="text-slate-400">Stack Ring Ports:</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      Port 1:
                      <span className={member.stackPorts.port1 === 'Ok' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {member.stackPorts.port1}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      Port 2:
                      <span className={member.stackPorts.port2 === 'Ok' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {member.stackPorts.port2}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Unified Interface Range:</span>
                  <span className="font-mono text-indigo-300">
                    Gi{member.memberId}/0/1 — Gi{member.memberId}/0/24
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-Stack EtherChannel (MEC) Explainer */}
      <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-xs space-y-2">
        <div className="font-bold text-sky-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Cross-Stack Multi-Chassis EtherChannel (MEC) & SSO Redundancy
        </div>
        <p className="text-slate-300 leading-relaxed">
          Switch stacking bundles the control plane of all physical units into a single logical Cisco IOS switch. You can create Cross-Stack EtherChannels combining interfaces from different stack members (e.g. <code className="text-emerald-400 font-mono">Gi1/0/1</code> on Switch 1 and <code className="text-emerald-400 font-mono">Gi2/0/1</code> on Switch 2). Even if Switch 1 suffers a power failure, traffic continues forwarding seamlessly across Switch 2 without Spanning-Tree topology recalculation.
        </p>
        <div className="pt-2 font-mono text-[11px] text-slate-400 flex flex-wrap gap-4">
          <span>CLI: <code className="text-sky-300">show switch detail</code></span>
          <span>CLI: <code className="text-sky-300">show redundancy</code></span>
          <span>CLI: <code className="text-sky-300">switch 1 priority 15</code></span>
        </div>
      </div>
    </div>
  );
};
