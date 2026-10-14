import React, { useState } from 'react';
import {
  Bot,
  X,
  Sparkles,
  HelpCircle,
  MessageSquare,
  Wand2,
  Terminal,
  Network,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import mascotImg from '../assets/images/wirecraft_mascot_packet_pete.jpg';

interface MascotGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTextToTopology: () => void;
  onOpenLabs: () => void;
  onOpenSocratic: () => void;
  onOpenNoc: () => void;
}

const PETE_TIPS = [
  {
    title: 'Welcome to WireCraft!',
    text: "Hi there! I'm Packet Pete, your personal networking study buddy. I'll help you master CCNA concepts and design network architectures on WireCraft.",
    actionLabel: 'Explore AI Lab Architect',
    actionKey: 'topology',
  },
  {
    title: 'Instant Lab Generation',
    text: "Click 'AI Lab Architect' in the top bar and type anything like 'Build an OSPF area 0 network' to instantly synthesize a fully working lab!",
    actionLabel: 'Open AI Lab Architect',
    actionKey: 'topology',
  },
  {
    title: 'Master the IOS CLI',
    text: 'Click on any router, switch, or firewall and open its terminal. Type `enable`, `configure terminal`, and use `show ip route` to view computed Dijkstra paths!',
    actionLabel: 'View Guided Labs',
    actionKey: 'labs',
  },
  {
    title: 'Troubleshoot with TAC Co-Pilot',
    text: "Stuck on a broken network? Open the NOC Incident Triage modal or ask our Socratic AI Mentor to guide you through debugging step-by-step.",
    actionLabel: 'Ask Socratic Mentor',
    actionKey: 'socratic',
  },
];

export const MascotGuideModal: React.FC<MascotGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenTextToTopology,
  onOpenLabs,
  onOpenSocratic,
  onOpenNoc,
}) => {
  const [currentTipIdx, setCurrentTipIdx] = useState(0);

  if (!isOpen) return null;

  const currentTip = PETE_TIPS[currentTipIdx];

  const handleAction = () => {
    if (currentTip.actionKey === 'topology') {
      onClose();
      onOpenTextToTopology();
    } else if (currentTip.actionKey === 'labs') {
      onClose();
      onOpenLabs();
    } else if (currentTip.actionKey === 'socratic') {
      onClose();
      onOpenSocratic();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-sky-500/40 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header Banner */}
        <div className="relative bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={mascotImg}
                alt="Packet Pete"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-sky-400 shadow-lg shadow-sky-500/30"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Packet Pete</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  WireCraft Mascot
                </span>
              </div>
              <p className="text-xs text-slate-300">Your AI Study & Routing Companion</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tip Body */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span>{currentTip.title}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentTip.text}
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleAction}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{currentTip.actionLabel}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {PETE_TIPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentTipIdx(i)}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  i === currentTipIdx ? 'w-6 bg-sky-400' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentTipIdx((prev) => (prev > 0 ? prev - 1 : PETE_TIPS.length - 1))}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={() => setCurrentTipIdx((prev) => (prev < PETE_TIPS.length - 1 ? prev + 1 : 0))}
              className="px-3 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-semibold border border-sky-500/30 transition-colors cursor-pointer"
            >
              Next Tip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
