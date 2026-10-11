import React, { useRef, useState } from 'react';
import {
  Network,
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
} from 'lucide-react';
import { Tooltip } from './Tooltip';

interface TopBarProps {
  canUndo: boolean;
  canRedo: boolean;
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
  onTileWindows: () => void;
  onCascadeWindows: () => void;
  onExportLab: () => void;
  onImportLab: (event: React.ChangeEvent<HTMLInputElement>) => void;
  simulationStepCount: number;
  activeIncidentTitle?: string | null;
  activeLabTitle?: string | null;
  activeLabScore?: number;
  onToggleLabHud?: () => void;
  onOpenLegal?: () => void;
  onOpenMascot?: () => void;
  onOpenChaos?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  canUndo,
  canRedo,
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
  onTileWindows,
  onCascadeWindows,
  onExportLab,
  onImportLab,
  simulationStepCount,
  activeIncidentTitle,
  activeLabTitle,
  activeLabScore = 0,
  onToggleLabHud,
  onOpenLegal,
  onOpenMascot,
  onOpenChaos,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);

  return (
    <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between select-none z-30">
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={(e) => {
          onImportLab(e);
          if (fileInputRef.current) fileInputRef.current.value = '';
          setIsFileMenuOpen(false);
        }}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        {/* Logo/Title */}
        <div className="flex items-center gap-2 mr-6 shrink-0">
          <Network className="w-5 h-5 text-sky-400 shrink-0" />
          <h1 className="text-sm font-bold text-white whitespace-nowrap hidden sm:block">NetT-Sim</h1>
        </div>

        {/* File Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            File
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>
          {isFileMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1">
              <button
                onClick={() => {
                  window.location.reload();
                  setIsFileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                New Lab
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setIsFileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Open / Import
              </button>
              <button
                onClick={() => {
                  onExportLab();
                  setIsFileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Save / Export
              </button>
            </div>
          )}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 ml-4 pl-4 border-l border-slate-800">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo Topology Action (Ctrl+Z)"
            className={`p-1.5 rounded-lg border text-slate-300 transition-colors ${
              canUndo
                ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white cursor-pointer'
                : 'border-slate-800/40 opacity-40 cursor-not-allowed text-slate-500'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo Topology Action (Ctrl+Y)"
          className={`p-1.5 rounded-lg border text-slate-300 transition-colors ${
            canRedo
              ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white cursor-pointer'
              : 'border-slate-800/40 opacity-40 cursor-not-allowed text-slate-500'
          }`}
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Feature Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenNoc}
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeIncidentTitle
              ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/20 animate-pulse'
              : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 text-amber-300'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>NOC Incidents</span>
          {activeIncidentTitle && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        <button
          onClick={onToggleLabHud || onOpenLabs}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeLabTitle
              ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200 shadow-md shadow-indigo-500/20'
              : 'bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span>{activeLabTitle ? `Lab: ${activeLabTitle.replace(/^\d+\.\s*/, '').slice(0, 16)}...` : 'CCNA Labs'}</span>
          {activeLabTitle && (
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                activeLabScore === 100
                  ? 'bg-emerald-500 text-black'
                  : 'bg-indigo-500/40 text-indigo-200'
              }`}
            >
              {activeLabScore}%
            </span>
          )}
        </button>

        <Tooltip content="Socratic AI Mentor">
          <button
            onClick={onOpenSocratic}
            className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-purple-500/10"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Socratic AI Mentor</span>
          </button>
        </Tooltip>

        <Tooltip content="Browse Network Topologies">
          <button
            onClick={onOpenPresets}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Topologies
          </button>
        </Tooltip>

        <Tooltip content="Calculate IPv4 Subnets">
          <button
            onClick={onOpenSubnetCalc}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Binary className="w-3.5 h-3.5" />
            Subnet Studio
          </button>
        </Tooltip>

        <Tooltip content="Analyze Packet Flow">
          <button
            onClick={onOpenPacketInspector}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              simulationStepCount > 0
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            PDU Inspector
            {simulationStepCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">
                {simulationStepCount}
              </span>
            )}
          </button>
        </Tooltip>

        {onOpenTextToTopology && (
          <Tooltip content="Synthesize Lab from Prompt">
            <button
              onClick={onOpenTextToTopology}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>AI Lab Architect</span>
            </button>
          </Tooltip>
        )}

        <Tooltip content="Generate Architecture Diagram">
          <button
            onClick={onOpenAiStudio}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden xl:inline">Diagram Studio</span>
          </button>
        </Tooltip>

        {onOpenMascot && (
          <Tooltip content="Meet Packet Pete">
            <button
              onClick={onOpenMascot}
              className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-sky-400 animate-bounce" />
              <span className="hidden md:inline">Packet Pete</span>
            </button>
          </Tooltip>
        )}

        {onOpenChaos && (
          <Tooltip content="Chaos Troubleshooting Challenge">
            <button
              onClick={onOpenChaos}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden xl:inline">Chaos Battle</span>
            </button>
          </Tooltip>
        )}
      </div>

      {/* Window Manager Layout Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onTileWindows}
          title="Tile Windows Side-by-Side"
          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="text-[11px] hidden sm:inline">Tile</span>
        </button>
        <button
          onClick={onCascadeWindows}
          title="Cascade Open Windows"
          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="text-[11px] hidden sm:inline">Cascade</span>
        </button>
        {onOpenLegal && (
          <button
            onClick={onOpenLegal}
            title="Legal & Trademark Disclaimers"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-sky-300 rounded-lg text-xs flex items-center gap-1 cursor-pointer ml-1 pl-2 border-l border-slate-800"
          >
            <Scale className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden lg:inline">Legal</span>
          </button>
        )}
      </div>
      </div>
    </header>
  );
};
