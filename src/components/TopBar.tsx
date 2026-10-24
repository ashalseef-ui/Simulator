import React, { useRef, useState, useEffect } from 'react';
import {
  BookOpen,
  LayoutTemplate,
  Binary,
  Layers,
  Sparkles,
  Undo2,
  Redo2,
  Grid,
  ShieldAlert,
  FileText,
  ChevronDown,
  Scale,
  Wand2,
  Bot,
  Flame,
  Terminal,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
  FolderOpen,
  Save,
  Plus,
  HelpCircle,
  Cpu,
  PanelLeftClose,
  PanelLeft,
  Download,
  Camera,
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { WireCraftLogo } from './WireCraftLogo';

interface TopBarProps {
  canUndo: boolean;
  canRedo: boolean;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenSpeedrun?: () => void;
  onOpenGremlin?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenLabs: () => void;
  onOpenNoc: () => void;
  onOpenSocratic: () => void;
  onOpenPresets: () => void;
  onOpenSubnetCalc: () => void;
  onOpenPacketInspector: () => void;
  onOpenAiStudio: () => void;
  onOpenTextToTopology?: () => void;
  onOpenWhiteboardScan?: () => void;
  onTileWindows: () => void;
  onCascadeWindows: () => void;
  onExportLab: () => void;
  onExportSvg?: () => void;
  onImportLab: (event: React.ChangeEvent<HTMLInputElement>) => void;
  simulationStepCount: number;
  activeIncidentTitle?: string | null;
  activeLabTitle?: string | null;
  activeLabScore?: number;
  onToggleLabHud?: () => void;
  onOpenLegal?: () => void;
  onOpenMascot?: () => void;
  onOpenChaos?: () => void;
  onOpenCommands?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  canUndo,
  canRedo,
  isSidebarOpen = true,
  onToggleSidebar,
  onOpenSpeedrun,
  onOpenGremlin,
  isMuted = false,
  onToggleMute,
  onUndo,
  onRedo,
  onOpenLabs,
  onOpenNoc,
  onOpenSocratic,
  onOpenPresets,
  onOpenSubnetCalc,
  onOpenPacketInspector,
  onOpenAiStudio,
  onOpenTextToTopology,
  onOpenWhiteboardScan,
  onTileWindows,
  onCascadeWindows,
  onExportLab,
  onExportSvg,
  onImportLab,
  simulationStepCount,
  activeIncidentTitle,
  activeLabTitle,
  activeLabScore = 0,
  onToggleLabHud,
  onOpenLegal,
  onOpenMascot,
  onOpenChaos,
  onOpenCommands,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<'file' | 'tools' | 'ai' | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setActiveDropdown(null);
      }
    };
    if (activeDropdown) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeDropdown]);

  return (
    <header className="h-10 bg-slate-950/95 backdrop-blur-xl border-b border-white/5 px-2.5 flex items-center justify-between select-none z-30 shrink-0">
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={(e) => {
          onImportLab(e);
          if (fileInputRef.current) fileInputRef.current.value = '';
          setActiveDropdown(null);
        }}
        className="hidden"
      />

      {/* ZONE 1: BRAND, SIDEBAR TOGGLE & FILE ACTIONS */}
      <div className="flex items-center gap-1.5 shrink-0">
        {onToggleSidebar && (
          <Tooltip content={isSidebarOpen ? 'Hide Hardware Palette' : 'Show Hardware Palette'}>
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors cursor-pointer"
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4 text-sky-400" />
              )}
            </button>
          </Tooltip>
        )}

        <div className="flex items-center gap-2 pl-1 pr-2.5 border-r border-white/10">
          <WireCraftLogo size="sm" />
          <span className="text-xs font-bold tracking-tight text-white font-mono">WireCraft</span>
          <span className="text-[10px] text-slate-500 font-mono">2.4</span>
        </div>

        {/* File Dropdown */}
        <div className="relative dropdown-container">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown(activeDropdown === 'file' ? null : 'file');
            }}
            className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              activeDropdown === 'file'
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <span>File</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {activeDropdown === 'file' && (
            <div className="absolute top-full left-0 mt-1.5 w-48 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  window.location.reload();
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-400" />
                <span>New Blank Lab</span>
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>Open / Import JSON</span>
              </button>
              <button
                onClick={() => {
                  onExportLab();
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-slate-400" />
                <span>Save / Export JSON</span>
              </button>
              {onExportSvg && (
                <button
                  onClick={() => {
                    onExportSvg();
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Export Diagram (SVG)</span>
                </button>
              )}
              <div className="my-1 border-t border-slate-800" />
              <button
                onClick={() => {
                  onOpenPresets();
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-sky-400" />
                <span>Sample Topologies</span>
              </button>
            </div>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 border-l border-slate-800/80 pl-2">
          <Tooltip content="Undo (Ctrl+Z)">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1 rounded-md text-slate-400 transition-colors ${
                canUndo ? 'hover:text-white hover:bg-slate-800 cursor-pointer' : 'opacity-30 cursor-not-allowed'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Redo (Ctrl+Y)">
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1 rounded-md text-slate-400 transition-colors ${
                canRedo ? 'hover:text-white hover:bg-slate-800 cursor-pointer' : 'opacity-30 cursor-not-allowed'
              }`}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ZONE 2: SEGMENTED WORKSPACE MODES & SUITE MENUS */}
      <div className="flex items-center gap-1.5">
        {/* Sleek Segmented Modes Bar */}
        <div className="flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/5">
          {/* Guided Labs */}
          <button
            onClick={onToggleLabHud || onOpenLabs}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeLabTitle
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">
              {activeLabTitle ? `${activeLabTitle.replace(/^\d+\.\s*/, '').slice(0, 14)}...` : 'Guided Labs'}
            </span>
            {activeLabTitle ? (
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 text-indigo-200">
                {activeLabScore}%
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-500">10</span>
            )}
          </button>

          {/* NOC Incidents */}
          <button
            onClick={onOpenNoc}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeIncidentTitle
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">NOC Triage</span>
            {activeIncidentTitle && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          {/* Chaos Battle */}
          {onOpenChaos && (
            <button
              onClick={onOpenChaos}
              className="px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 text-slate-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden lg:inline">Chaos Battle</span>
            </button>
          )}

          {/* Speedrun Arena */}
          {onOpenSpeedrun && (
            <button
              onClick={onOpenSpeedrun}
              className="px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 text-slate-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span className="hidden xl:inline">Speedrun</span>
            </button>
          )}
        </div>

        {/* Tools Dropdown */}
        <div className="relative dropdown-container">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown(activeDropdown === 'tools' ? null : 'tools');
            }}
            className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 border transition-all cursor-pointer ${
              activeDropdown === 'tools'
                ? 'bg-slate-800 border-white/10 text-white'
                : 'bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Binary className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">Tools</span>
            {simulationStepCount > 0 && (
              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                {simulationStepCount}
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {activeDropdown === 'tools' && (
            <div className="absolute top-full left-0 mt-1.5 w-56 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  onOpenSubnetCalc();
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
              >
                <Binary className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <div className="font-semibold">Subnet Calculator</div>
                  <div className="text-[10px] text-slate-400">IPv4 VLSM, CIDR & wildcard helper</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenPacketInspector();
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
              >
                <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Packet Inspector</span>
                    {simulationStepCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-bold">
                        {simulationStepCount}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">Inspect frames, L3 headers & payloads</div>
                </div>
              </button>

              {onOpenCommands && (
                <button
                  onClick={() => {
                    onOpenCommands();
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
                >
                  <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold">Multi-Vendor CLI Matrix</div>
                    <div className="text-[10px] text-slate-400">Rosetta Stone: Cisco, Junos, Arista, VyOS</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* AI Suite Dropdown */}
        <div className="relative dropdown-container">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown(activeDropdown === 'ai' ? null : 'ai');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              activeDropdown === 'ai'
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-200'
                : 'bg-slate-900/60 border-slate-800 text-purple-300 hover:bg-purple-950/30 hover:border-purple-500/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden lg:inline">AI Studio</span>
            <ChevronDown className="w-3 h-3 text-purple-400/60" />
          </button>

          {activeDropdown === 'ai' && (
            <div className="absolute top-full left-0 mt-1.5 w-60 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              {onOpenTextToTopology && (
                <button
                  onClick={() => {
                    onOpenTextToTopology();
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
                >
                  <Wand2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <div className="font-semibold">AI Lab Architect</div>
                    <div className="text-[10px] text-slate-400">Generate full topologies from natural language</div>
                  </div>
                </button>
              )}

              {onOpenWhiteboardScan && (
                <button
                  onClick={() => {
                    onOpenWhiteboardScan();
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Whiteboard Scanner</span>
                      <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold border border-emerald-500/30">
                        100%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Photo OCR with Pre-Flight review</div>
                  </div>
                </button>
              )}

              <button
                onClick={() => {
                  onOpenAiStudio();
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="font-semibold">Diagram Studio</div>
                  <div className="text-[10px] text-slate-400">Architectural high-res diagram generator</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenSocratic();
                  setActiveDropdown(null);
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 flex items-center gap-2 cursor-pointer"
              >
                <Bot className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="font-semibold">Socratic AI Mentor</div>
                  <div className="text-[10px] text-slate-400">Interactive troubleshooting guidance</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ZONE 3: UTILITIES & CANVAS CONTROLS */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Net-Gremlin Toggle */}
        {onOpenGremlin && (
          <Tooltip content="Chaos Net-Gremlin (Live Sandbox Mischief)">
            <button
              onClick={onOpenGremlin}
              className="px-2 py-1 rounded-md bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden 2xl:inline">Net-Gremlin 👹</span>
            </button>
          </Tooltip>
        )}

        {/* Audio Synthesizer Toggle */}
        {onToggleMute && (
          <Tooltip content={isMuted ? 'Unmute Audio Synthesizer' : 'Mute Audio Synthesizer'}>
            <button
              onClick={onToggleMute}
              className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                isMuted
                  ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </Tooltip>
        )}

        {/* Window Layouts (Tile / Cascade) */}
        <div className="flex items-center gap-0.5 border-l border-white/10 pl-1.5">
          <Tooltip content="Tile Windows">
            <button
              onClick={onTileWindows}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-md cursor-pointer transition-colors"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Cascade Windows">
            <button
              onClick={onCascadeWindows}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-md cursor-pointer transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        {/* Packet Pete Mascot */}
        {onOpenMascot && (
          <Tooltip content="Meet Packet Pete">
            <button
              onClick={onOpenMascot}
              className="p-1.5 rounded-md text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        )}

        {/* Legal Info */}
        {onOpenLegal && (
          <Tooltip content="Educational & Trademark Disclaimer">
            <button
              onClick={onOpenLegal}
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-md cursor-pointer transition-colors"
            >
              <Scale className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        )}
      </div>
    </header>
  );
};
