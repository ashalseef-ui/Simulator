import React from 'react';
import { Device, DeviceConfig, NetworkOsType } from '../../types/network';
import { CliSession, getPrompt, generateRunningConfig } from '../../engine/cliEngine';
import { VENDOR_OS_PROFILES } from '../../engine/cli/multiVendorEngines';
import { Tv, Sparkles, BookOpen, Copy, Trash2, Loader2, X } from 'lucide-react';

interface CliTerminalTabProps {
  device: Device;
  cliSession: CliSession;
  terminalThemeMode: 'vendor' | 'matrix' | 'amber' | 'cyber' | 'c64';
  setTerminalThemeMode: (mode: 'vendor' | 'matrix' | 'amber' | 'cyber' | 'c64') => void;
  showScanlines: boolean;
  setShowScanlines: (v: boolean | ((prev: boolean) => boolean)) => void;
  terminalOutput: string[];
  setTerminalOutput: React.Dispatch<React.SetStateAction<string[]>>;
  cliInput: string;
  setCliInput: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  terminalEndRef: React.RefObject<HTMLDivElement | null>;
  onUpdateDeviceConfig: (deviceId: string, config: DeviceConfig) => void;
  onOpenCommandReference: () => void;
  onRequestAiAudit: () => void;
  isAdvisorLoading: boolean;
  aiAdvisorTip: string | null;
  onDismissAiAdvisorTip: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const CliTerminalTab: React.FC<CliTerminalTabProps> = ({
  device,
  cliSession,
  terminalThemeMode,
  setTerminalThemeMode,
  showScanlines,
  setShowScanlines,
  terminalOutput,
  setTerminalOutput,
  cliInput,
  setCliInput,
  inputRef,
  terminalEndRef,
  onUpdateDeviceConfig,
  onOpenCommandReference,
  onRequestAiAudit,
  isAdvisorLoading,
  aiAdvisorTip,
  onDismissAiAdvisorTip,
  onSubmit,
  onKeyDown,
}) => {
  const currentOs: NetworkOsType = device.config.networkOs || 'cisco-ios';
  const defaultThemes: Record<NetworkOsType, { text: string; prompt: string; bg: string }> = {
    'cisco-ios': { text: 'text-emerald-300', prompt: 'text-emerald-400', bg: 'bg-black' },
    'juniper-junos': { text: 'text-teal-200', prompt: 'text-teal-400', bg: 'bg-slate-950' },
    'arista-eos': { text: 'text-sky-200', prompt: 'text-sky-400', bg: 'bg-black' },
    'linux-vyos': { text: 'text-amber-200', prompt: 'text-amber-400', bg: 'bg-black' },
    'mikrotik-routeros': { text: 'text-rose-200', prompt: 'text-rose-400', bg: 'bg-neutral-950' },
  };

  let theme = defaultThemes[currentOs] || defaultThemes['cisco-ios'];
  if (terminalThemeMode === 'matrix') {
    theme = { text: 'text-green-400 drop-shadow-[0_0_3px_rgba(34,197,94,0.4)]', prompt: 'text-green-300 font-bold', bg: 'bg-black' };
  } else if (terminalThemeMode === 'amber') {
    theme = { text: 'text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.35)]', prompt: 'text-amber-300 font-bold', bg: 'bg-[#0a0802]' };
  } else if (terminalThemeMode === 'cyber') {
    theme = { text: 'text-cyan-300 drop-shadow-[0_0_3px_rgba(6,182,212,0.35)]', prompt: 'text-pink-400 font-bold', bg: 'bg-[#050811]' };
  } else if (terminalThemeMode === 'c64') {
    theme = { text: 'text-indigo-200', prompt: 'text-indigo-300 font-bold', bg: 'bg-[#1b1c4b]' };
  }

  return (
    <div
      className={`flex-1 flex flex-col p-3 font-mono text-xs overflow-hidden relative ${theme.bg} ${theme.text}`}
      onClick={() => inputRef.current?.focus()}
    >
      {showScanlines && (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] opacity-40 z-10" />
      )}
      {/* Terminal Mini Action Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-900 select-none relative z-20">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
          {/* Multi-Vendor NOS Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold">NOS:</span>
            <select
              value={currentOs}
              onChange={(e) => {
                const newOs = e.target.value as NetworkOsType;
                const updated = { ...device.config, networkOs: newOs };
                onUpdateDeviceConfig(device.id, updated);
                const prof = VENDOR_OS_PROFILES[newOs];
                setTerminalOutput((prev) => [
                  ...prev,
                  `\n[System: Switching Network OS Dialect to ${prof.name}]`,
                  prof.banner,
                  ``,
                ]);
              }}
              className="bg-transparent text-[10px] font-bold text-sky-400 outline-none cursor-pointer"
            >
              <option value="cisco-ios" className="bg-slate-900 text-white">Cisco IOS / IOS-XE</option>
              <option value="juniper-junos" className="bg-slate-900 text-white">Juniper Junos OS</option>
              <option value="arista-eos" className="bg-slate-900 text-white">Arista EOS</option>
              <option value="linux-vyos" className="bg-slate-900 text-white">Linux / VyOS</option>
              <option value="mikrotik-routeros" className="bg-slate-900 text-white">MikroTik RouterOS</option>
            </select>
          </div>

          {/* Theme Selector */}
          <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold">Theme:</span>
            <select
              value={terminalThemeMode}
              onChange={(e) => setTerminalThemeMode(e.target.value as any)}
              className="bg-transparent text-[10px] font-bold text-amber-400 outline-none cursor-pointer"
            >
              <option value="vendor" className="bg-slate-900 text-white">Native Vendor</option>
              <option value="matrix" className="bg-slate-900 text-green-400">Matrix Phosphor</option>
              <option value="amber" className="bg-slate-900 text-amber-400">VT220 Amber</option>
              <option value="cyber" className="bg-slate-900 text-cyan-400">Cyberpunk Cyan</option>
              <option value="c64" className="bg-slate-900 text-indigo-300">Commodore 64</option>
            </select>
          </div>

          {/* CRT Scanline Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowScanlines(!showScanlines);
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
              showScanlines
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle Retro CRT Scanlines Effect"
          >
            <Tv className="w-3 h-3" />
            <span>CRT</span>
          </button>

          <span className="text-slate-600">|</span>
          <span>{device.config.hostname || device.name}</span>
          {cliSession.debugFlags?.icmp && (
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
              DEBUG: ICMP ON
            </span>
          )}
          {cliSession.debugFlags?.ospfEvents && (
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
              DEBUG: OSPF ON
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestAiAudit();
            }}
            disabled={isAdvisorLoading}
            className="px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] font-bold flex items-center gap-1 border border-indigo-500/40 cursor-pointer disabled:opacity-50"
            title="Ask Gemini TAC to audit this device configuration"
          >
            {isAdvisorLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 text-indigo-400" />
            )}
            AI TAC Assist
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenCommandReference();
            }}
            className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-bold flex items-center gap-1 border border-sky-500/40 cursor-pointer"
            title="Open Multi-Vendor CLI Rosetta Stone & Command Reference"
          >
            <BookOpen className="w-3 h-3 text-sky-400" />
            CLI Matrix
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              const cfg = generateRunningConfig(device);
              navigator.clipboard.writeText(cfg);
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-900 cursor-pointer"
            title="Copy Running Configuration"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              const prof = VENDOR_OS_PROFILES[currentOs];
              setTerminalOutput([prof.banner, '']);
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-900 cursor-pointer"
            title="Clear Terminal Screen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* AI Advisor Response Drawer */}
      {aiAdvisorTip && (
        <div className="mb-2 p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-[11px] leading-relaxed relative font-sans">
          <div className="flex items-center justify-between mb-1 font-bold text-indigo-300 flex items-center gap-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              AI TAC Diagnostic Advice
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismissAiAdvisorTip();
              }}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="whitespace-pre-wrap">{aiAdvisorTip}</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
        {terminalOutput.map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap leading-tight">
            {line}
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>

      {/* Input Line with Realistic Multi-Vendor Prompt */}
      <form onSubmit={onSubmit} className="flex items-center mt-2 pt-1 border-t border-slate-900">
        <span className={`${theme.prompt} font-bold mr-1.5 select-none whitespace-pre`}>
          {getPrompt(device, cliSession)}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={cliInput}
          onChange={(e) => setCliInput(e.target.value)}
          onKeyDown={onKeyDown}
          className={`flex-1 bg-transparent ${theme.text} outline-none font-mono text-xs`}
          autoFocus
          spellCheck={false}
        />
      </form>
    </div>
  );
};
