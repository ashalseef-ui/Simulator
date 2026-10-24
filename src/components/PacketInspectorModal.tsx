import React from 'react';
import { SimulationStep } from '../types/network';
import { X, Layers, ChevronLeft, ChevronRight } from 'lucide-react';

interface PacketInspectorModalProps {
  step: SimulationStep | null;
  allSteps?: SimulationStep[];
  currentStepIndex?: number;
  onSelectStepIndex?: (index: number) => void;
  onClose: () => void;
}

export const PacketInspectorModal: React.FC<PacketInspectorModalProps> = ({
  step,
  allSteps = [],
  currentStepIndex = 0,
  onSelectStepIndex,
  onClose,
}) => {
  if (!step) return null;

  const hasMultipleSteps = allSteps.length > 1;
  const canGoPrev = currentStepIndex > 0;
  const canGoNext = currentStepIndex < allSteps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                PDU Protocol Data Unit Inspector
                {hasMultipleSteps && (
                  <span className="text-[11px] font-normal text-slate-400">
                    ({currentStepIndex + 1} of {allSteps.length})
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Step {step.stepIndex} of {step.totalSteps}: {step.stage}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasMultipleSteps && onSelectStepIndex && (
              <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/5 mr-2">
                <button
                  onClick={() => onSelectStepIndex(currentStepIndex - 1)}
                  disabled={!canGoPrev}
                  title="Previous PDU Step"
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono px-1.5 text-sky-400 font-semibold">
                  {currentStepIndex + 1}/{allSteps.length}
                </span>
                <button
                  onClick={() => onSelectStepIndex(currentStepIndex + 1)}
                  disabled={!canGoNext}
                  title="Next PDU Step"
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Protocol Layer Dissection */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-xs">
          {/* Summary Banner */}
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <span className="font-semibold text-slate-300">{step.message}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-sky-500/20 text-sky-400 border border-sky-500/30">
              {step.type}
            </span>
          </div>

          {/* LAYER 2: ETHERNET II FRAME */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            <div className="px-3.5 py-2 bg-slate-800/60 border-b border-slate-800 font-bold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              OSI Layer 2: Ethernet II Frame
            </div>
            <div className="p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 text-[10px] block">Preamble</span>
                <span className="text-slate-200 font-bold">{step.l2Frame.preamble}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Source MAC</span>
                <span className="text-sky-400 font-bold">{step.l2Frame.srcMac}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Destination MAC</span>
                <span className="text-amber-400 font-bold">{step.l2Frame.dstMac}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">EtherType</span>
                <span className="text-emerald-400 font-bold">{step.l2Frame.type}</span>
              </div>
            </div>
          </div>

          {/* LAYER 3: IPv4 PACKET HEADER */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            <div className="px-3.5 py-2 bg-slate-800/60 border-b border-slate-800 font-bold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              OSI Layer 3: Internet Protocol Version 4 (IPv4)
            </div>
            <div className="p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 text-[10px] block">Version / IHL</span>
                <span className="text-slate-200">IPv{step.l3Packet.version}, {step.l3Packet.ihl * 4} Bytes</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Total Length</span>
                <span className="text-slate-200">{step.l3Packet.totalLength} Octets</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">TTL (Time to Live)</span>
                <span className="text-amber-400 font-bold">{step.l3Packet.ttl} hops</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Protocol</span>
                <span className="text-emerald-400 font-bold">{step.l3Packet.protocol}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 text-[10px] block">Source IP</span>
                <span className="text-sky-400 font-bold">{step.l3Packet.srcIp}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 text-[10px] block">Destination IP</span>
                <span className="text-purple-400 font-bold">{step.l3Packet.dstIp}</span>
              </div>
            </div>
          </div>

          {/* LAYER 4: TRANSPORT & PAYLOAD */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            <div className="px-3.5 py-2 bg-slate-800/60 border-b border-slate-800 font-bold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              OSI Layer 4 / Payload: {step.l4Payload.protocol}
            </div>
            <div className="p-3.5 space-y-2">
              <div className="text-slate-300 font-semibold text-xs">
                {step.l4Payload.summary}
              </div>
              <div className="p-2.5 rounded-lg bg-black/60 border border-slate-900 font-mono text-[11px] text-slate-400 space-y-1">
                {Object.entries(step.l4Payload.details).map(([key, val]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-slate-500">{key}:</span>
                    <span className="text-slate-200 font-semibold">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
