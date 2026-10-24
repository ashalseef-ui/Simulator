import React from 'react';
import { Device, DeviceWindowState } from '../types/network';
import { Terminal, Minus, Scale } from 'lucide-react';

interface WindowManagerBarProps {
  windows: Record<string, DeviceWindowState>;
  devices: Device[];
  onToggleWindow: (id: string) => void;
  onMinimizeAll: () => void;
  onOpenLegal?: () => void;
}

export const WindowManagerBar: React.FC<WindowManagerBarProps> = ({
  windows,
  devices,
  onToggleWindow,
  onMinimizeAll,
  onOpenLegal,
}) => {
  const windowList = Object.values(windows);

  return (
    <footer className="h-8.5 bg-slate-950 border-t border-white/5 px-3 flex items-center justify-between select-none z-30 shrink-0">
      {/* Open Windows Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
        {windowList.length === 0 ? (
          <span className="text-[11px] text-slate-500 font-normal flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            Double-click any device to open CLI / configuration console
          </span>
        ) : (
          windowList.map((win) => {
            const dev = devices.find((d) => d.id === win.deviceId);
            if (!dev) return null;
            const isMin = win.minimized;

            return (
              <button
                key={win.id}
                onClick={() => onToggleWindow(win.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                  !isMin
                    ? 'bg-white/10 border-sky-400/50 text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    !isMin ? 'bg-sky-400' : 'bg-slate-600'
                  }`}
                />
                <span className="truncate max-w-[130px] font-mono text-[11px]">
                  {dev.config.hostname || dev.name}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Right Controls: Window Actions & Info */}
      <div className="flex items-center gap-3 shrink-0">
        {windowList.length > 0 && (
          <button
            onClick={onMinimizeAll}
            title="Minimize All Windows"
            className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 hover:bg-white/5 rounded transition-colors cursor-pointer flex items-center gap-1"
          >
            <Minus className="w-3 h-3" />
            <span>Minimize All</span>
          </button>
        )}

        <div className="text-[11px] text-slate-500 font-mono hidden sm:inline">
          {devices.length} {devices.length === 1 ? 'device' : 'devices'}
        </div>

        {onOpenLegal && (
          <button
            onClick={onOpenLegal}
            title="View Educational & Trademark Disclaimer"
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Educational Simulator</span>
            <span className="text-slate-700">·</span>
            <span className="hidden md:inline">Legal Disclaimer</span>
          </button>
        )}
      </div>
    </footer>
  );
};
