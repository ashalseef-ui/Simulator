import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Clock,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Zap,
  ChevronDown,
  ChevronUp,
  Activity,
  Calendar,
} from 'lucide-react';
import { workerBridge } from '../engine/workerBridge';
import { VirtualClockSnapshot } from '../engine/virtualClock';

export const VirtualClockTelemetryBar: React.FC = () => {
  const [snapshot, setSnapshot] = useState<VirtualClockSnapshot>(workerBridge.clock.getSnapshot());
  const [isExpanded, setIsExpanded] = useState(true);

  // Subscribe to clock updates
  useEffect(() => {
    const unsubscribe = workerBridge.clock.subscribe((snap) => {
      setSnapshot(snap);
    });
    return () => unsubscribe();
  }, []);

  // Tick ticker loop when clock is running
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = now - lastTime;
      if (!snapshot.paused) {
        const tickDuration = workerBridge.clock.getTickDurationMs();
        const effectiveInterval = tickDuration / snapshot.speedMultiplier;

        if (dt >= effectiveInterval) {
          const ticksToAdvance = Math.max(1, Math.floor(dt / effectiveInterval));
          workerBridge.clock.advanceTicks(ticksToAdvance);
          lastTime = now;
        }
      } else {
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [snapshot.paused, snapshot.speedMultiplier]);

  const handleTogglePlay = () => {
    workerBridge.clock.togglePlayPause();
  };

  const handleStepOnce = () => {
    workerBridge.clock.pause();
    workerBridge.clock.advanceTicks(1);
  };

  const handleSetSpeed = (speed: number) => {
    workerBridge.clock.setSpeed(speed);
  };

  const handleReset = () => {
    workerBridge.clock.reset();
  };

  return (
    <div className="absolute bottom-10 right-4 z-40 select-none flex flex-col items-end">
      {/* Minimized Pill View */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="px-3 py-1.5 rounded-full bg-slate-900/95 border border-sky-500/40 text-slate-200 text-xs font-mono font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md hover:border-sky-400 transition-all cursor-pointer group"
          title="Expand Virtual Clock & Web Worker Telemetry"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Cpu className="w-3.5 h-3.5 text-sky-400 group-hover:rotate-12 transition-transform" />
          <span className="text-[11px] text-sky-300">DES Engine: {snapshot.formattedTime}</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        </button>
      ) : (
        /* Expanded Full Telemetry Bar */
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md p-3 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Top Row: Engine Status & Minimize */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-1 rounded-md border flex items-center justify-center ${
                  snapshot.engineMode === 'worker'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>DES Engine</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      snapshot.engineMode === 'worker' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                </div>
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <span>{snapshot.engineMode === 'worker' ? 'Web Worker (Async)' : 'Main Thread'}</span>
                  <span className="text-[10px] font-mono font-normal text-sky-400">
                    ({snapshot.lastComputeLatencyMs}ms)
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Collapse Telemetry"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Middle Row: Virtual Clock Readout & Controls */}
          <div className="flex items-center justify-between gap-3 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800/80">
            {/* Clock Time */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <div>
                <div className="text-[9px] text-slate-400 font-mono uppercase">Virtual Sim Time</div>
                <div className="text-sm font-mono font-extrabold text-sky-300">
                  {snapshot.formattedTime}
                </div>
              </div>
            </div>

            {/* Tick Counter */}
            <div className="text-right">
              <div className="text-[9px] text-slate-400 font-mono uppercase">Tick Clock</div>
              <div className="text-xs font-mono font-bold text-indigo-400">
                #{snapshot.currentTick}
              </div>
            </div>
          </div>

          {/* Bottom Row: Clock Transport Controls & Speed Multipliers */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {/* Play/Pause & Step Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleTogglePlay}
                className={`p-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  snapshot.paused
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                }`}
                title={snapshot.paused ? 'Resume Simulation Clock' : 'Pause Simulation Clock'}
              >
                {snapshot.paused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
              </button>

              <button
                onClick={handleStepOnce}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Step +1 Discrete Tick (+50ms)"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Reset Simulation Clock"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Speed Multiplier Chips */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
              {[0.5, 1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => handleSetSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    snapshot.speedMultiplier === spd
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
