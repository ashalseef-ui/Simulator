import React, { useState } from 'react';
import {
  IncidentScenario,
  INCIDENT_SCENARIOS,
} from '../data/incidentScenarios';
import { Device, Link } from '../types/network';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  Sparkles,
  Activity,
  Lightbulb,
  Layers,
  Copy,
  Check,
  Send,
  Loader2,
  X,
  FileText,
  Compass,
  Terminal,
} from 'lucide-react';

interface NocIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  links: Link[];
  activeIncident: IncidentScenario | null;
  onDeployIncident: (incident: IncidentScenario) => void;
  onClearIncident: () => void;
  onOpenDevice: (deviceId: string) => void;
}

export const NocIncidentModal: React.FC<NocIncidentModalProps> = ({
  isOpen,
  onClose,
  devices,
  links,
  activeIncident,
  onDeployIncident,
  onClearIncident,
  onOpenDevice,
}) => {
  const [activeTab, setActiveTab] = useState<'incidents' | 'diagnostics' | 'copilot'>('incidents');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    activeIncident?.id || INCIDENT_SCENARIOS[0].id
  );
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [revealedHints, setRevealedHints] = useState<Record<string, { l1?: boolean; l2?: boolean; l3?: boolean }>>({});
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Verification results
  const [verificationResult, setVerificationResult] = useState<{
    passed: boolean;
    score: number;
    criteria: { name: string; passed: boolean; message: string }[];
  } | null>(null);

  // AI Diagnostic State
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<{
    score: number;
    summary: string;
    issues: string[];
    rootCauseAnalysis?: string;
    remediation: string[];
    verificationCommands?: string[];
    aiGenerated?: boolean;
  } | null>(null);

  // Copilot Chat State
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; content: string; time: string }[]
  >([
    {
      role: 'assistant',
      content:
        'Hello! I am your AI TAC Co-Pilot (CCIE #99999). I have full visibility into your simulator topology, interface configs, and routing tables. Ask me to diagnose a failure, suggest show commands, or explain protocol behaviors.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);

  if (!isOpen) return null;

  const currentIncident =
    INCIDENT_SCENARIOS.find((i) => i.id === selectedIncidentId) || INCIDENT_SCENARIOS[0];

  const categories = [
    'all',
    'Routing & OSPF',
    'Layer 2 & STP',
    'Inter-VLAN & Trunking',
    'Security & ACL',
    'Static Routing & Gateways',
    'Network Services & DHCP',
  ];

  const filteredIncidents =
    filterCategory === 'all'
      ? INCIDENT_SCENARIOS
      : INCIDENT_SCENARIOS.filter((i) => i.category === filterCategory);

  const handleVerify = () => {
    if (!currentIncident) return;
    const res = currentIncident.validate(devices, links);
    setVerificationResult(res);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const toggleHint = (incidentId: string, level: 'l1' | 'l2' | 'l3') => {
    setRevealedHints((prev) => ({
      ...prev,
      [incidentId]: {
        ...prev[incidentId],
        [level]: !prev[incidentId]?.[level],
      },
    }));
  };

  // Run AI Health Check & Diagnostic Audit
  const handleRunAiDiagnostics = async () => {
    setIsDiagnosing(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devices,
          links,
          currentIncident: activeIncident
            ? {
                title: activeIncident.title,
                severity: activeIncident.severity,
                description: activeIncident.summary,
                objective: activeIncident.objective,
              }
            : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDiagnosticReport(data);
      } else {
        setDiagnosticReport({
          score: 75,
          summary: data.error || 'Diagnostic completed with heuristic fallback.',
          issues: ['API temporarily offline; check interface IPs and VLANs manually.'],
          remediation: ['Review running configuration on all switches and routers.'],
          aiGenerated: false,
        });
      }
    } catch (e: any) {
      setDiagnosticReport({
        score: 70,
        summary: 'Heuristic Network Diagnostic (Offline Engine): Analyzed devices.',
        issues: ['Ensure all interfaces have valid IPs and matching subnets.'],
        remediation: ['1. Use "show ip interface brief".', '2. Use "show ip route".'],
        aiGenerated: false,
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Send Copilot Chat
  const handleSendChat = async (overridePrompt?: string) => {
    const text = (overridePrompt || chatInput).trim();
    if (!text || isChatSending) return;

    const userMsg = {
      role: 'user' as const,
      content: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!overridePrompt) setChatInput('');
    setIsChatSending(true);

    try {
      const res = await fetch('/api/ai/tac-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          topologyContext: {
            deviceCount: devices.length,
            deviceNames: devices.map((d) => d.name),
            activeIncident: activeIncident?.title || null,
          },
        }),
      });

      const data = await res.json();
      const replyMsg = {
        role: 'assistant' as const,
        content: data.reply || data.error || 'I could not process the request.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, replyMsg]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'I am currently operating in offline TAC mode. Here are the core troubleshooting steps:\n1. Check Layer 1/2 with "show ip interface brief".\n2. Verify Layer 3 route reachability with "show ip route".\n3. Use "debug ip icmp" to trace ICMP drops.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  WireCraft NOC & AI TAC Architect
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  REAL-WORLD INCIDENTS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live production outage triage, deep protocol diagnosis, and automated IOS-compatible solution verification
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab('incidents')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'incidents'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Incidents & Outages
            </button>
            <button
              onClick={() => {
                setActiveTab('diagnostics');
                if (!diagnosticReport) handleRunAiDiagnostics();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'diagnostics'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              AI Topology Auditor
            </button>
            <button
              onClick={() => setActiveTab('copilot')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'copilot'
                  ? 'bg-indigo-600 text-white font-bold shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              TAC Co-Pilot Chat
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TAB 1: INCIDENTS & OUTAGES */}
        {activeTab === 'incidents' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar list */}
            <div className="w-80 border-r border-slate-800 bg-slate-950/50 flex flex-col">
              {/* Category Filter */}
              <div className="p-3 border-b border-slate-800">
                <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                  Filter Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'all' ? 'All Incident Categories' : c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Incidents List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredIncidents.map((inc) => {
                  const isSelected = selectedIncidentId === inc.id;
                  const isActive = activeIncident?.id === inc.id;
                  return (
                    <div
                      key={inc.id}
                      onClick={() => {
                        setSelectedIncidentId(inc.id);
                        setVerificationResult(null);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5'
                          : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          {inc.ticketId}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            inc.severity.startsWith('P1')
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : inc.severity.startsWith('P2')
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {inc.severity.split(' - ')[0]}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 line-clamp-1 mb-1">
                        {inc.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {inc.summary}
                      </p>
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{inc.category}</span>
                        {isActive && (
                          <span className="flex items-center gap-1 text-amber-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                            DEPLOYED
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main Detail View */}
            <div className="flex-1 flex flex-col overflow-y-auto bg-slate-900/40 p-6">
              {/* Ticket Banner */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 mb-5 shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {currentIncident.ticketId}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {currentIncident.organization}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        SLA: {currentIncident.slaMinutes}m
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      {currentIncident.title}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {currentIncident.summary}
                    </p>
                  </div>

                  {/* Deploy or Reset Buttons */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => {
                        onDeployIncident(currentIncident);
                        setVerificationResult(null);
                        onClose();
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      Deploy Incident to Canvas
                    </button>

                    <button
                      onClick={handleVerify}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Run Solution Verification
                    </button>
                  </div>
                </div>

                {/* Topology & Symptoms */}
                <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      Reported Incident Symptoms
                    </h5>
                    <ul className="space-y-1.5">
                      {currentIncident.symptoms.map((s, idx) => (
                        <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="text-rose-400 font-bold">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h5 className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-sky-400" />
                      Target Objective
                    </h5>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      {currentIncident.objective}
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification Results Panel */}
              {verificationResult && (
                <div
                  className={`p-4 rounded-xl border mb-5 transition-all ${
                    verificationResult.passed
                      ? 'bg-emerald-950/40 border-emerald-500/40'
                      : 'bg-rose-950/40 border-rose-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {verificationResult.passed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      )}
                      <h4 className="text-sm font-bold text-white">
                        {verificationResult.passed
                          ? '🎉 Outage Remediation Successful!'
                          : '⚠️ Remediation Incomplete - Root Cause Remains'}
                      </h4>
                    </div>
                    <span
                      className={`text-xs font-bold font-mono px-2.5 py-1 rounded-md ${
                        verificationResult.passed
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      Score: {verificationResult.score}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    {verificationResult.criteria.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs bg-slate-900/60 p-2 rounded-lg border border-slate-800"
                      >
                        {c.passed ? (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className={c.passed ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>
                            {c.name}
                          </div>
                          {!c.passed && (
                            <div className="text-[11px] text-slate-400 mt-0.5">{c.message}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tiered AI Hints Accordion */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  Tiered TAC Problem-Solving Guidance
                </h4>

                <div className="space-y-2.5">
                  {/* Level 1 Hint */}
                  <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-sky-400">
                        Level 1: Triage Clue (Conceptual & OSI Layer)
                      </span>
                      <button
                        onClick={() => toggleHint(currentIncident.id, 'l1')}
                        className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
                      >
                        {revealedHints[currentIncident.id]?.l1 ? 'Hide' : 'Reveal Clue'}
                      </button>
                    </div>
                    {revealedHints[currentIncident.id]?.l1 && (
                      <p className="mt-2 text-xs text-slate-300 leading-relaxed pt-2 border-t border-slate-800">
                        {currentIncident.hints.level1}
                      </p>
                    )}
                  </div>

                  {/* Level 2 Hint */}
                  <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-400">
                        Level 2: Diagnostic Deep-Dive (Show & Debug Commands)
                      </span>
                      <button
                        onClick={() => toggleHint(currentIncident.id, 'l2')}
                        className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
                      >
                        {revealedHints[currentIncident.id]?.l2 ? 'Hide' : 'Reveal Commands'}
                      </button>
                    </div>
                    {revealedHints[currentIncident.id]?.l2 && (
                      <p className="mt-2 text-xs text-slate-300 leading-relaxed pt-2 border-t border-slate-800 font-mono">
                        {currentIncident.hints.level2}
                      </p>
                    )}
                  </div>

                  {/* Level 3 Hint */}
                  <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400">
                        Level 3: Root-Cause Remediation (Exact IOS Syntax)
                      </span>
                      <button
                        onClick={() => toggleHint(currentIncident.id, 'l3')}
                        className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
                      >
                        {revealedHints[currentIncident.id]?.l3 ? 'Hide' : 'Reveal Solution'}
                      </button>
                    </div>
                    {revealedHints[currentIncident.id]?.l3 && (
                      <div className="mt-2 pt-2 border-t border-slate-800">
                        <pre className="p-2.5 rounded bg-slate-950 font-mono text-xs text-emerald-400 overflow-x-auto">
                          {currentIncident.hints.level3}
                        </pre>
                        <button
                          onClick={() => handleCopy(currentIncident.hints.level3)}
                          className="mt-2 text-[11px] text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded cursor-pointer"
                        >
                          {copiedCmd === currentIncident.hints.level3 ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedCmd === currentIncident.hints.level3 ? 'Copied' : 'Copy Commands'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI TOPOLOGY AUDITOR & HEALTH CHECK */}
        {activeTab === 'diagnostics' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-900/40">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-white">
                  Real-Time AI Topology & Configuration Auditor
                </h3>
                <p className="text-xs text-slate-400">
                  Gemini Deep Learning inspection of interfaces, subnetting, OSPF areas, STP priorities, and ACL rules
                </p>
              </div>

              <button
                onClick={handleRunAiDiagnostics}
                disabled={isDiagnosing}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDiagnosing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <Activity className="w-4 h-4" />
                )}
                {isDiagnosing ? 'Analyzing Topology...' : 'Run Deep Health Check'}
              </button>
            </div>

            {isDiagnosing && (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-3" />
                <h4 className="text-sm font-bold text-white mb-1">
                  Inspecting Network Topology & Running Configurations...
                </h4>
                <p className="text-xs text-slate-400">
                  Evaluating {devices.length} devices, {links.length} physical links, ARP tables, and STP convergence
                </p>
              </div>
            )}

            {!isDiagnosing && diagnosticReport && (
              <div className="space-y-5">
                {/* Score & Summary Card */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex items-center gap-6">
                  <div className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl bg-slate-900 border border-slate-700/80 shrink-0">
                    <span
                      className={`text-2xl font-extrabold font-mono ${
                        diagnosticReport.score >= 85
                          ? 'text-emerald-400'
                          : diagnosticReport.score >= 60
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {diagnosticReport.score}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Health Score</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                        {diagnosticReport.aiGenerated ? 'GEMINI 3.8 FLASH TAC AUDIT' : 'HEURISTIC TAC ENGINE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      {diagnosticReport.summary}
                    </p>
                  </div>
                </div>

                {/* Detected Issues */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
                  <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Detected Architectural & Configuration Faults ({diagnosticReport.issues.length})
                  </h4>

                  <div className="space-y-2">
                    {diagnosticReport.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-slate-200 bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg flex items-start gap-2.5"
                      >
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Root Cause & Remediation */}
                {diagnosticReport.rootCauseAnalysis && (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
                    <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-400" />
                      Protocol Layer Root Cause Analysis
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      {diagnosticReport.rootCauseAnalysis}
                    </p>
                  </div>
                )}

                {/* Remediation Plan */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Step-by-Step IOS Remediation Plan
                    </h4>
                    {activeIncident && (
                      <button
                        onClick={onClearIncident}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer transition-colors"
                      >
                        Clear Active Incident Banner
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {diagnosticReport.remediation.map((step, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-lg font-mono flex items-start justify-between gap-2"
                      >
                        <span>{step}</span>
                        <button
                          onClick={() => handleCopy(step)}
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Device Jump Inspector */}
                <div className="pt-2">
                  <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3">
                    Topology Devices Quick Inspector ({devices.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {devices.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          onOpenDevice(d.id);
                          onClose();
                        }}
                        className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/50 flex items-center justify-between text-left cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-white truncate max-w-[120px]">{d.name}</div>
                          <div className="text-[10px] font-mono text-slate-400 capitalize">{d.type}</div>
                        </div>
                        <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TAC CO-PILOT CHAT */}
        {activeTab === 'copilot' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/40">
            {/* Quick Prompts Bar */}
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
              <span className="text-[11px] font-mono text-slate-400 shrink-0">Quick Queries:</span>
              <button
                onClick={() => handleSendChat('Analyze why OSPF neighbor adjacency is not forming in my topology.')}
                className="text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 shrink-0 cursor-pointer"
              >
                Why is OSPF down?
              </button>
              <button
                onClick={() => handleSendChat('Audit my Spanning Tree topology and check which switch is the root bridge.')}
                className="text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 shrink-0 cursor-pointer"
              >
                Audit STP Root Bridge
              </button>
              <button
                onClick={() => handleSendChat('Provide the exact IOS configuration template for Router-on-a-stick for VLAN 10 and VLAN 20.')}
                className="text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 shrink-0 cursor-pointer"
              >
                Router-on-a-stick Template
              </button>
              <button
                onClick={() => handleSendChat('Check if any host in this network is missing a default gateway or has mismatched subnet mask.')}
                className="text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-700 shrink-0 cursor-pointer"
              >
                Check Gateway & Masks
              </button>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl p-4 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-md'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    <div
                      className={`text-[9px] mt-1.5 font-mono ${
                        msg.role === 'user' ? 'text-indigo-200' : 'text-slate-500'
                      }`}
                    >
                      {msg.time}
                    </div>
                  </div>
                </div>
              ))}

              {isChatSending && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-xs text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    TAC Co-Pilot is analyzing configurations...
                  </div>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-slate-950 border-t border-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask TAC Co-Pilot: 'Why did ping fail?', 'Show OSPF config', 'Explain STP BPDU flow'..."
                  className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatSending}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
