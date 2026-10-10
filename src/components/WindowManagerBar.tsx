import React from 'react';
import { Device, DeviceWindowState } from '../types/network';

interface WindowManagerBarProps {
  windows: Record<string, DeviceWindowState>;
  devices: Device[];
  onToggleWindow: (id: string) => void;
  onMinimizeAll: () => void;
}

export const WindowManagerBar: React.FC<WindowManagerBarProps> = ({
  windows,
  devices,
  onToggleWindow,
  onMinimizeAll,
}) => {
  const windowList = Object.values(windows);

  return (
    <footer className="h-10 bg-slate-950 border-t border-slate-800 px-3 flex items-center justify-between select-none z-30">
      {/* Open Windows Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-1">
        {windowList.length === 0 ? (
          <span className="text-[11px] text-slate-500 font-medium">
            Double-click any device on the canvas to open CLI / Configuration
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
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  !isMin
                    ? 'bg-slate-800 border-sky-500/50 text-white shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    !isMin ? 'bg-sky-400' : 'bg-slate-600'
                  }`}
                />
                <span className="truncate max-w-[120px]">
                  {dev.config.hostname || dev.name}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Quick minimize all */}
      {windowList.length > 0 && (
        <button
          onClick={onMinimizeAll}
          title="Minimize All Windows"
          className="text-[11px] text-slate-400 hover:text-white px-2 py-1 hover:bg-slate-900 rounded cursor-pointer"
        >
          Minimize All
        </button>
      )}
    </footer>
  );
};
