import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Cpu,
  Clock,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  RotateCw,
} from 'lucide-react';
import { workerBridge } from '../engine/workerBridge';
import { VirtualClockSnapshot } from '../engine/virtualClock';

const STORAGE_KEY = 'netsim_worker_hud_pos_v2';

export const VirtualClockTelemetryBar: React.FC = () => {
  const [snapshot, setSnapshot] = useState<VirtualClockSnapshot>(workerBridge.clock.getSnapshot());
  const [isExpanded, setIsExpanded] = useState(true);

  // Position state (null = calculate safe initial position avoiding zoom HUD)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  const panelRef = useRef<HTMLDivElement>(null);

  // Calculate default safe position at top-right (well clear of bottom-right zoom controls and bottom-left link legend)
  const getDefaultPosition = useCallback(() => {
    if (typeof window === 'undefined') return { x: 500, y: 64 };
    const width = isExpanded ? 340 : 270;
    const x = Math.max(16, window.innerWidth - width - 20);
    const y = 64; // Safely below topbar
    return { x, y };
  }, [isExpanded]);

  // Set default position on mount if none saved or if out of bounds
  useEffect(() => {
    if (!position) {
      setPosition(getDefaultPosition());
    } else {
      // Ensure existing saved position is still within visible viewport
      const clampedX = Math.max(10, Math.min(window.innerWidth - 120, position.x));
      const clampedY = Math.max(50, Math.min(window.innerHeight - 80, position.y));
      if (clampedX !== position.x || clampedY !== position.y) {
        setPosition({ x: clampedX, y: clampedY });
      }
    }
  }, [getDefaultPosition]);

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

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with primary pointer button
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't drag if clicking interactive controls inside the panel
    if (target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }

    e.preventDefault();
    setIsDragging(true);

    const currentPos = position || getDefaultPosition();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: currentPos.x,
      initY: currentPos.y,
    };

    const handlePointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - dragRef.current.startX;
      const dy = moveEv.clientY - dragRef.current.startY;

      const panelWidth = panelRef.current?.offsetWidth || (isExpanded ? 340 : 270);
      const panelHeight = panelRef.current?.offsetHeight || (isExpanded ? 200 : 44);

      // Safe bounds: below topbar (48px), above window manager bar (44px from bottom)
      const maxX = Math.max(10, window.innerWidth - panelWidth - 10);
      const maxY = Math.max(50, window.innerHeight - panelHeight - 48);

      const nextX = Math.max(10, Math.min(maxX, dragRef.current.initX + dx));
      const nextY = Math.max(50, Math.min(maxY, dragRef.current.initY + dy));

      const newPos = { x: nextX, y: nextY };
      setPosition(newPos);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPos));
      } catch {
        // ignore
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleResetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    const def = getDefaultPosition();
    setPosition(def);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(def));
    } catch {
      // ignore
    }
  };

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

  const currentPos = position || getDefaultPosition();

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${currentPos.x}px`,
        top: `${currentPos.y}px`,
      }}
      className={`z-40 select-none flex flex-col items-end ${
        isDragging ? 'opacity-95 ring-2 ring-sky-500/50 shadow-2xl scale-[1.01]' : ''
      }`}
    >
      {/* Minimized Pill View */}
      {!isExpanded ? (
        <div
          onPointerDown={handlePointerDown}
          className="px-3 py-1.5 rounded-full bg-slate-900/95 border border-sky-500/40 text-slate-200 text-xs font-mono font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md hover:border-sky-400 transition-all cursor-grab active:cursor-grabbing group"
          title="Web Worker Telemetry • Drag to reposition freely or click expand"
        >
          <GripHorizontal className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Cpu className="w-3.5 h-3.5 text-sky-400 group-hover:rotate-12 transition-transform" />
          <span className="text-[11px] text-sky-300">DES Engine: {snapshot.formattedTime}</span>
          <button
            onClick={() => setIsExpanded(true)}
            className="p-0.5 hover:text-white text-slate-400 cursor-pointer"
            title="Expand Web Worker Telemetry"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Expanded Full Telemetry Bar */
        <div
          className="w-80 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Top Row: Drag Handle Header, Engine Status & Controls */}
          <div
            onPointerDown={handlePointerDown}
            className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2 cursor-grab active:cursor-grabbing group"
            title="Click and drag to move Web Worker window freely"
          >
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
                  <GripHorizontal className="w-3 h-3 text-slate-500 group-hover:text-sky-400 transition-colors" />
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

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetPosition}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Reset window position"
              >
                <RotateCw className="w-3 h-3" />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Collapse Telemetry"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
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
