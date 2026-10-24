import React from 'react';
import { SimulationStep } from '../types/network';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Layers,
  Activity,
  Gauge,
  History,
} from 'lucide-react';

interface SimulationBarProps {
  simulationSteps: SimulationStep[];
  currentStepIndex: number;
  isPlaying: boolean;
  playbackSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  packetHistory?: { id: string; label: string; count: number }[];
  onSelectHistoryItem?: (id: string) => void;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onReset: () => void;
  onOpenInspector: () => void;
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  simulationSteps,
  currentStepIndex,
  isPlaying,
  playbackSpeed = 1,
  onSpeedChange,
  packetHistory = [],
  onSelectHistoryItem,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onReset,
  onOpenInspector,
}) => {
  const [showHistoryMenu, setShowHistoryMenu] = React.useState<boolean>(false);
  if (simulationSteps.length === 0) return null;

  const currentStep = simulationSteps[currentStepIndex];
  const speeds = [0.5, 1, 2, 4];

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 border border-white/10 backdrop-blur-xl rounded-xl shadow-2xl px-3 py-1.5 flex items-center gap-3 select-none animate-in fade-in slide-in-from-top-2">
      {/* Simulation Indicator */}
      <div className="flex items-center gap-1.5 pr-2.5 border-r border-white/10">
        <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span className="text-xs font-semibold text-white">
          Sim Playback
        </span>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onStepBackward}
          disabled={currentStepIndex <= 0}
          title="Step Backward"
          className="p-1.5 rounded-md bg-white/[0.04] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition-colors cursor-pointer"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {isPlaying ? (
          <button
            onClick={onPause}
            title="Pause Simulation"
            className="p-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={currentStepIndex >= simulationSteps.length - 1}
            title="Play Simulation"
            className="p-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-bold transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
        )}

        <button
          onClick={onStepForward}
          disabled={currentStepIndex >= simulationSteps.length - 1}
          title="Step Forward"
          className="p-1.5 rounded-md bg-white/[0.04] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition-colors cursor-pointer"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onReset}
          title="Reset Simulation"
          className="p-1.5 rounded-md bg-white/[0.04] hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer ml-0.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Step Info Readout */}
      <div className="flex items-center gap-2 pl-2.5 border-l border-white/10">
        <span className="text-[11px] font-mono font-semibold text-sky-400">
          {currentStepIndex + 1}/{simulationSteps.length}
        </span>
        <span className="text-xs text-slate-300 font-normal truncate max-w-[240px]">
          {currentStep?.stage}: {currentStep?.message}
        </span>
      </div>

      {/* Speed Multiplier Pills */}
      {onSpeedChange && (
        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-white/[0.04] border border-white/10">
          <Gauge className="w-3 h-3 text-slate-400 mr-1" />
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                playbackSpeed === s
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      )}

      {/* Inspect PDU Button */}
      <button
        onClick={onOpenInspector}
        className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <Layers className="w-3.5 h-3.5" />
        PDU
      </button>

      {/* Packet History Drawer */}
      {packetHistory.length > 0 && onSelectHistoryItem && (
        <div className="relative">
          <button
            onClick={() => setShowHistoryMenu(!showHistoryMenu)}
            title="Packet History"
            className="p-1.5 rounded-md bg-white/[0.04] hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
          </button>

          {showHistoryMenu && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                Simulation History ({packetHistory.length})
              </div>
              <div className="max-h-48 overflow-y-auto">
                {packetHistory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectHistoryItem(item.id);
                      setShowHistoryMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate pr-2 font-mono text-[11px]">{item.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-sky-400 font-mono">
                      {item.count} steps
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
