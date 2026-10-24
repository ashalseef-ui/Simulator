import React, { useRef } from 'react';
import { TOPOLOGY_PRESETS, TopologyPreset } from '../data/sampleTopologies';
import { Device, Link } from '../types/network';
import { X, LayoutTemplate, ArrowRight, Download, Upload, FileCode } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface PresetsModalProps {
  onLoadTopology: (devices: Device[], links: Link[]) => void;
  onExportLab?: () => void;
  onImportLab?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

export const PresetsModal: React.FC<PresetsModalProps> = ({
  onLoadTopology,
  onExportLab,
  onImportLab,
  onClose,
}) => {
  const { position, handleMouseDown } = useDraggable();
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectPreset = (preset: TopologyPreset) => {
    const topo = preset.load();
    onLoadTopology(topo.devices, topo.links);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <input
        type="file"
        ref={modalFileInputRef}
        accept=".json"
        onChange={(e) => {
          if (onImportLab) onImportLab(e);
          if (modalFileInputRef.current) modalFileInputRef.current.value = '';
          onClose();
        }}
        className="hidden"
      />
      <div
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div
          onMouseDown={handleMouseDown}
          className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <LayoutTemplate className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                Network Topologies & Lab Files (.json)
              </div>
              <div className="text-[11px] text-slate-400">
                Load ready-to-test network architectures or import/export custom lab files
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Custom JSON File Action Box */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileCode className="w-4 h-4 text-sky-400" />
            <div>
              <div className="text-xs font-bold text-slate-200">Custom Lab JSON File Manager</div>
              <div className="text-[10px] text-slate-400">Save running-configs, cabling, & layout coordinates</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onExportLab && (
              <button
                onClick={() => {
                  onExportLab();
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export (.json)
              </button>
            )}
            <button
              onClick={() => modalFileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import (.json)
            </button>
          </div>
        </div>

        {/* Presets List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {TOPOLOGY_PRESETS.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelectPreset(p)}
              className="group p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-sky-400/80 hover:bg-slate-800/60 transition-all cursor-pointer flex items-center justify-between gap-3.5"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100 group-hover:text-sky-300 transition-colors">
                    {p.name}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono uppercase bg-slate-800 text-slate-400">
                    {p.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 group-hover:border-sky-500/40 group-hover:bg-sky-500/10 transition-colors shrink-0">
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400 transition-colors" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
