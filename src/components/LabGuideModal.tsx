import React, { useState } from 'react';
import { LAB_SCENARIOS } from '../data/labs';
import { Device, Link } from '../types/network';
import {
  X,
  BookOpen,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
  Code,
  Copy,
  Check,
  HelpCircle,
} from 'lucide-react';

interface LabGuideModalProps {
  devices: Device[];
  links: Link[];
  onLoadTopology: (devices: Device[], links: Link[], labId?: string) => void;
  onClose: () => void;
}

export const LabGuideModal: React.FC<LabGuideModalProps> = ({
  devices,
  links,
  onLoadTopology,
  onClose,
}) => {
  const [selectedLabId, setSelectedLabId] = useState<string>(LAB_SCENARIOS[0].id);
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [copiedDevice, setCopiedDevice] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    passed: boolean;
    score: number;
    criteria: { name: string; passed: boolean; message: string }[];
  } | null>(null);

  const lab = LAB_SCENARIOS.find((l) => l.id === selectedLabId) || LAB_SCENARIOS[0];

  const handleValidate = () => {
    const res = lab.validate(devices, links);
    setValidationResult(res);
  };

  const handleLoadLab = () => {
    const topo = lab.initialTopology();
    onLoadTopology(topo.devices, topo.links, lab.id);
    setValidationResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                Guided Hands-on Practice Labs (Multi-Vendor & Enterprise Networking)
              </div>
              <div className="text-[11px] text-slate-400">
                10 Real-world Scenarios with Automated Goal Verification
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

        {/* Content: 2-Column Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Labs List */}
          <div className="w-72 border-r border-slate-800 bg-slate-950/60 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
            {LAB_SCENARIOS.map((l, index) => {
              const isSelected = l.id === lab.id;
              return (
                <button
                  key={l.id}
                  onClick={() => {
                    setSelectedLabId(l.id);
                    setValidationResult(null);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-400/80 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="font-mono text-xs font-bold text-indigo-400 mt-0.5">
                    {index + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-200 truncate">
                      {l.title.replace(/^\d+\.\s*/, '')}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400">
                        {l.category}
                      </span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                          l.difficulty === 'Beginner'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : l.difficulty === 'Intermediate'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {l.difficulty}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Lab Detail & Instructions */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 custom-scrollbar bg-slate-900">
            {/* Header / Info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {lab.category}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                  {lab.difficulty}
                </span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {lab.title}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lab.summary}
              </p>
            </div>

            {/* Objective Banner */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                Core Objective
              </span>
              <p className="text-xs text-slate-200 font-medium">
                {lab.objective}
              </p>
            </div>

            {/* Action Bar: Load Lab Topology & Verify */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleLoadLab}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Load Initial Topology
              </button>

              <button
                onClick={handleValidate}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Verify Configuration
              </button>
            </div>

            {/* View Mode Toggle: Instructions vs Solution Cheat-Sheet */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setShowSolution(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !showSolution
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Instructions & Tasks
              </button>
              <button
                onClick={() => setShowSolution(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  showSolution
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Solution & CLI Commands
              </button>
            </div>

            {!showSolution ? (
              <>
                {/* Step-by-Step Instructions */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Step-by-Step Instructions
                  </span>
                  <div className="space-y-2">
                    {lab.instructions.map((inst, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3"
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs text-slate-200 leading-relaxed font-mono">
                          {inst}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Helpful Tips */}
                {lab.tips && lab.tips.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200/90 text-xs space-y-1">
                    <span className="font-bold block">💡 CCNA Exam Tip:</span>
                    {lab.tips.map((t, idx) => (
                      <div key={idx}>• {t}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {/* Hints */}
                {lab.solutionHints && lab.solutionHints.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                    <span className="font-bold flex items-center gap-1.5 text-amber-300">
                      <HelpCircle className="w-3.5 h-3.5" /> Configuration Strategy Hints:
                    </span>
                    {lab.solutionHints.map((hint, idx) => (
                      <div key={idx} className="text-slate-300">• {hint}</div>
                    ))}
                  </div>
                )}

                {/* Device Commands */}
                {lab.solutionCommands ? (
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Target Device Commands & Settings
                    </span>
                    {Object.entries(lab.solutionCommands).map(([deviceKey, cmds]) => (
                      <div
                        key={deviceKey}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden"
                      >
                        <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-indigo-400">
                            {deviceKey}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(cmds.join('\n'));
                              setCopiedDevice(deviceKey);
                              setTimeout(() => setCopiedDevice(null), 1500);
                            }}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            {copiedDevice === deviceKey ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-3 text-[11px] font-mono text-emerald-300/90 overflow-x-auto whitespace-pre leading-relaxed select-text">
                          {cmds.join('\n')}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950 text-center text-xs text-slate-400">
                    No explicit solution commands defined for this scenario.
                  </div>
                )}
              </div>
            )}

            {/* Automated Validation Results */}
            {validationResult && (
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  validationResult.passed
                    ? 'bg-emerald-950/30 border-emerald-500/50'
                    : 'bg-slate-950 border-amber-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {validationResult.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Award className="w-5 h-5 text-amber-400" />
                    )}
                    <span className="text-sm font-bold text-white">
                      {validationResult.passed
                        ? 'Lab Completed Successfully!'
                        : 'Validation in Progress'}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-black/60 font-mono text-xs font-bold text-sky-400 border border-slate-800">
                    Score: {validationResult.score}%
                  </span>
                </div>

                {/* Criteria Checklist */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  {validationResult.criteria.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1"
                    >
                      <span className="flex items-center gap-2 text-slate-300">
                        {c.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        {c.name}
                      </span>
                      {!c.passed && (
                        <span className="text-[10px] text-slate-500 italic max-w-xs truncate">
                          {c.message}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
