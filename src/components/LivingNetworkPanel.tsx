import React from 'react';
import {
  Activity,
  Zap,
  Flame,
  Globe,
  Radio,
  Video,
  ShieldAlert,
  RotateCcw,
  X,
  Sliders,
  AlertTriangle,
  Play,
  Pause,
  Layers,
} from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import { LivingNetworkState, TrafficType } from '../engine/livingNetworkEngine';

interface LivingNetworkPanelProps {
  isOpen: boolean;
  onClose: () => void;
  state: LivingNetworkState;
  onToggleEnabled: (enabled: boolean) => void;
  onToggleProfile: (type: TrafficType, active: boolean) => void;
  onChangeChaosLevel: (level: number) => void;
  onManualChaosStrike: () => void;
  onClearChaosFaults: () => void;
}

export const LivingNetworkPanel: React.FC<LivingNetworkPanelProps> = ({
  isOpen,
  onClose,
  state,
  onToggleEnabled,
  onToggleProfile,
  onChangeChaosLevel,
  onManualChaosStrike,
  onClearChaosFaults,
}) => {
  const { position, handleMouseDown } = useDraggable();

  if (!isOpen) return null;

  const profileList: { key: TrafficType; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'web', label: 'Web Browsing (HTTP)', icon: <Globe className="w-3.5 h-3.5 text-cyan-400" />, color: 'text-cyan-400' },
    { key: 'dns', label: 'DNS Queries', icon: <Layers className="w-3.5 h-3.5 text-amber-400" />, color: 'text-amber-400' },
    { key: 'voip', label: 'VoIP Calls (RTP)', icon: <Radio className="w-3.5 h-3.5 text-emerald-400" />, color: 'text-emerald-400' },
    { key: 'video', label: '4K Video Streams', icon: <Video className="w-3.5 h-3.5 text-purple-400" />, color: 'text-purple-400' },
    { key: 'icmp', label: 'ICMP Heartbeats', icon: <Activity className="w-3.5 h-3.5 text-blue-400" />, color: 'text-blue-400' },
  ];

  return (
    <div
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      className="fixed bottom-16 left-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-slate-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col select-none animate-in fade-in duration-200"
    >
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        className="p-3 bg-gradient-to-r from-cyan-950/80 via-slate-950 to-indigo-950 border-b border-cyan-500/30 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
            <Flame className="w-4 h-4 animate-pulse text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-white">"Living Network" Generator</h3>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                TRAFFIC & HEATMAP
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Autonomous traffic flows & Chaos Monkey congestion</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Body */}
      <div className="p-3.5 space-y-3 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
        {/* Toggle Generator Banner */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${state.enabled ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
            <div>
              <div className="font-bold text-slate-200">
                {state.enabled ? 'Traffic Simulation ACTIVE' : 'Traffic Simulation STANDBY'}
              </div>
              <div className="text-[10px] text-slate-400">
                {state.enabled ? `${state.totalThroughputMbps} Mbps total · ${state.totalActiveFlows} flows` : 'Click enable to synthesize live network traffic'}
              </div>
            </div>
          </div>

          <button
            onClick={() => onToggleEnabled(!state.enabled)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              state.enabled
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
            }`}
          >
            {state.enabled ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Enable
              </>
            )}
          </button>
        </div>

        {/* Telemetry Gauge Grid */}
        {state.enabled && (
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Throughput</span>
              <span className="text-sm font-bold font-mono text-cyan-400">{state.totalThroughputMbps} <span className="text-[10px]">Mbps</span></span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Active Flows</span>
              <span className="text-sm font-bold font-mono text-emerald-400">{state.totalActiveFlows}</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Buffer Drops</span>
              <span className="text-sm font-bold font-mono text-rose-400">{state.totalDropCount}</span>
            </div>
          </div>
        )}

        {/* Traffic Profiles Toggle Section */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>Traffic Types to Generate</span>
          </div>

          <div className="space-y-1 bg-slate-950 p-2 rounded-xl border border-slate-800">
            {profileList.map((p) => {
              const isActive = state.trafficProfiles[p.key];
              return (
                <button
                  key={p.key}
                  onClick={() => onToggleProfile(p.key, !isActive)}
                  className={`w-full flex items-center justify-between p-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 border-slate-700 text-slate-200'
                      : 'bg-transparent border-transparent text-slate-500 hover:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {p.icon}
                    <span className="font-medium text-[11px]">{p.label}</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                      isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isActive ? 'ON' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chaos Monkey Slider Section */}
        <div className="space-y-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
              <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>Chaos Monkey Intensity</span>
            </div>
            <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/40">
              {state.chaosLevel}%
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={state.chaosLevel}
            onChange={(e) => onChangeChaosLevel(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
          />

          <div className="flex items-center justify-between text-[10px] text-amber-200/70 font-mono">
            <span>0% Safe</span>
            <span>50% Frequent Cuts</span>
            <span>100% Total Chaos</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onManualChaosStrike}
              className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Trigger Chaos Strike</span>
            </button>
            {state.chaosFaults.length > 0 && (
              <button
                onClick={onClearChaosFaults}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer"
                title="Clear Fault Log"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chaos Event Feed */}
        {state.chaosFaults.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>Live Chaos Fault Feed</span>
            </div>
            <div className="space-y-1 bg-slate-950 p-2 rounded-xl border border-slate-800 max-h-28 overflow-y-auto custom-scrollbar">
              {state.chaosFaults.map((f) => (
                <div key={f.id} className="text-[10px] p-1.5 rounded bg-slate-900 border border-slate-800 space-y-0.5">
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span>{f.targetName}</span>
                    <span className="font-mono text-slate-500 text-[9px]">{f.timestamp}</span>
                  </div>
                  <p className="text-slate-300 text-[10px] leading-tight">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
