import React, { useState, useEffect } from 'react';
import { LAB_SCENARIOS } from '../data/labs';
import { Device, Link, LabScenario } from '../types/network';
import {
  Award,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  BookOpen,
  X,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { audioEngine } from '../utils/audioEffects';

interface LabAssessmentHudProps {
  activeLabId: string;
  devices: Device[];
  links: Link[];
  onResetLab: () => void;
  onOpenLabGuide: () => void;
  onCloseLab: () => void;
  onRequestAiHint?: (labTitle: string, failedCriteria: string[]) => void;
}

export const LabAssessmentHud: React.FC<LabAssessmentHudProps> = ({
  activeLabId,
  devices,
  links,
  onResetLab,
  onOpenLabGuide,
  onCloseLab,
  onRequestAiHint,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showHintId, setShowHintId] = useState<string | null>(null);
  const [hasCelebrated, setHasCelebrated] = useState<boolean>(false);

  const lab: LabScenario | undefined = LAB_SCENARIOS.find((l) => l.id === activeLabId);

  if (!lab) return null;

  // Run live assessment
  const validation = lab.validate(devices, links);
  const passedCount = validation.criteria.filter((c) => c.passed).length;
  const totalCount = validation.criteria.length;
  const is100Percent = validation.passed && validation.score === 100;

  // Trigger celebration banner on 100%
  useEffect(() => {
    if (is100Percent && !hasCelebrated) {
      setHasCelebrated(true);
      audioEngine.playVictoryFanfare();
    }
  }, [is100Percent, hasCelebrated]);

  return (
    <div className="absolute top-3 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] select-none">
      <div
        className={`rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 overflow-hidden ${
          is100Percent
            ? 'bg-slate-900/95 border-emerald-500/50 shadow-emerald-500/10'
            : 'bg-slate-900/95 border-indigo-500/40 shadow-indigo-500/10'
        }`}
      >
        {/* HUD Top Bar Header */}
        <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-1.5 rounded-lg border ${
                is100Percent
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
              }`}
            >
              {is100Percent ? <Award className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded uppercase bg-slate-800 text-indigo-300 border border-slate-700">
                  {lab.category}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {lab.difficulty}
                </span>
              </div>
              <h3 className="text-xs font-bold text-white truncate mt-0.5" title={lab.title}>
                {lab.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title={isExpanded ? 'Collapse HUD' : 'Expand HUD'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={onCloseLab}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Exit Active Lab"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Progress Bar Header */}
        <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="text-slate-300 text-[11px]">Lab Completion:</span>
              <span
                className={`font-mono ${
                  is100Percent
                    ? 'text-emerald-400'
                    : validation.score >= 50
                    ? 'text-sky-400'
                    : 'text-amber-400'
                }`}
              >
                {validation.score}%
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {passedCount}/{totalCount} Objectives
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                is100Percent
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : validation.score >= 50
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`}
              style={{ width: `${validation.score}%` }}
            />
          </div>
        </div>

        {/* 100% Celebration Banner */}
        {is100Percent && (
          <div className="bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-slate-900 px-4 py-2.5 border-b border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🎉</span>
              <div>
                <div className="text-xs font-bold text-emerald-300">
                  All Objectives Mastered!
                </div>
                <div className="text-[10px] text-emerald-400/80">
                  100% CCNA verified configuration
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              PASSED
            </span>
          </div>
        )}

        {/* Collapsible Task Objectives List */}
        {isExpanded && (
          <div className="p-3 space-y-2 max-h-[42vh] overflow-y-auto custom-scrollbar bg-slate-950/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Live Grading Rubric
            </div>

            {validation.criteria.map((crit, idx) => {
              const isPassed = crit.passed;
              const isHintOpen = showHintId === `hint_${idx}`;

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border text-xs transition-all ${
                    isPassed
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400/80" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-semibold ${isPassed ? 'text-emerald-300' : 'text-slate-200'}`}>
                          {crit.name}
                        </span>
                        <button
                          onClick={() => setShowHintId(isHintOpen ? null : `hint_${idx}`)}
                          className="text-slate-500 hover:text-indigo-400 text-[10px] flex items-center gap-0.5 shrink-0"
                          title="View Guidance Hint"
                        >
                          <HelpCircle className="w-3 h-3" />
                          Hint
                        </button>
                      </div>

                      {/* Hint Drawer */}
                      {isHintOpen && (
                        <div className="mt-2 p-2 rounded-lg bg-slate-950 border border-indigo-500/30 text-[11px] font-mono text-indigo-300 leading-relaxed">
                          💡 {crit.message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Quick Actions Footer */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <button
                onClick={onOpenLabGuide}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Lab Guide
              </button>

              {onRequestAiHint && !is100Percent && (
                <button
                  onClick={() => {
                    const failed = validation.criteria.filter((c) => !c.passed).map((c) => c.name);
                    onRequestAiHint(lab.title, failed);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI TAC Hint
                </button>
              )}

              <button
                onClick={onResetLab}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors ml-auto"
                title="Reset topology to initial lab state"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
