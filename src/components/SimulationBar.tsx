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
} from 'lucide-react';

interface SimulationBarProps {
  simulationSteps: SimulationStep[];
  currentStepIndex: number;
  isPlaying: boolean;
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
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onReset,
  onOpenInspector,
}) => {
  if (simulationSteps.length === 0) return null;

  const currentStep = simulationSteps[currentStepIndex];

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-4 select-none">
      {/* Simulation Indicator */}
      <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
        <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
        <span className="text-xs font-bold text-slate-200">
          Simulation Mode
        </span>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onStepBackward}
          disabled={currentStepIndex <= 0}
          title="Step Backward"
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 cursor-pointer"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {isPlaying ? (
          <button
            onClick={onPause}
            title="Pause Simulation"
            className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={currentStepIndex >= simulationSteps.length - 1}
            title="Play Simulation"
            className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold cursor-pointer"
          >
            <Play className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onStepForward}
          disabled={currentStepIndex >= simulationSteps.length - 1}
          title="Step Forward"
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 cursor-pointer"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <button
          onClick={onReset}
          title="Reset Simulation"
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer ml-1"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Step Info Readout */}
      <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
        <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
          Step {currentStepIndex + 1} / {simulationSteps.length}
        </span>
        <span className="text-xs text-slate-300 font-medium truncate max-w-[280px]">
          {currentStep?.stage}: {currentStep?.message}
        </span>
      </div>

      {/* Inspect PDU Button */}
      <button
        onClick={onOpenInspector}
        className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
      >
        <Layers className="w-3.5 h-3.5" />
        PDU Details
      </button>
    </div>
  );
};
