import React from 'react';
import { X, ShieldCheck, Scale, AlertCircle, BookOpen } from 'lucide-react';
import { WireCraftLogo } from './WireCraftLogo';
import { useDraggable } from '../hooks/useDraggable';

interface AboutLegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutLegalModal: React.FC<AboutLegalModalProps> = ({ isOpen, onClose }) => {
  const { position, handleMouseDown } = useDraggable();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div
          onMouseDown={handleMouseDown}
          className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">About & Legal Disclaimers</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto custom-scrollbar text-sm text-slate-300">
          {/* Brand Header Banner */}
          <div className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/20 shadow-inner">
            <WireCraftLogo size="lg" showText />
            <p className="mt-1 text-xs font-mono text-cyan-400/90 tracking-wider">Virtual Network Architecture Simulator</p>
          </div>

          {/* Trademark Notice Card */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs tracking-wider uppercase">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Trademark & Nominative Fair Use Notice</span>
            </div>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong>WireCraft</strong> is an independent educational simulator developed for student learning and networking certification study.
            </p>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              WireCraft is <strong>not affiliated with, endorsed by, sponsored by, or associated with Cisco Systems, Inc., Juniper Networks, Arista Networks, or MikroTik.</strong>
            </p>
            <p className="text-xs text-amber-200/70 leading-relaxed">
              <em>Cisco, Cisco IOS, Catalyst, CCNA, and CCIE</em> are registered trademarks of Cisco Systems, Inc. All other brand names, product numbers, and model designations are used strictly for educational description and command-syntax compatibility.
            </p>
          </div>

          {/* Educational Purpose */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-white font-semibold text-xs uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>Educational Simulation Engine</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              All protocol implementations—including the 802.1D Spanning Tree calculation, OSPFv2 Dijkstra shortest-path-first algorithm, ARP table mechanics, packet step tracing, and the CLI syntax parser—are independently authored in TypeScript. No proprietary firmware, binary images, or copyrighted operating systems are bundled or distributed.
            </p>
          </div>

          {/* Open Source License */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-white font-semibold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>License & Usage Terms</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This application is distributed under the permissive <strong>MIT License</strong>. You are free to inspect, study, and run this code in accordance with open-source terms.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>WireCraft Educational Edition</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
