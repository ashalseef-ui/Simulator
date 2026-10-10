import React, { useState } from 'react';
import {
  Wand2,
  X,
  Sparkles,
  Zap,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  WifiOff,
  Cpu,
} from 'lucide-react';
import { Device, Link } from '../types/network';
import { generateOfflineTopology, GeneratedTopologyResult } from '../engine/offlineTopologyGenerator';
import { buildTopologyFromAiResponse } from '../engine/topologyBridge';

interface TextToTopologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployTopology: (devices: Device[], links: Link[], title: string, mode: 'replace' | 'append') => void;
}

const INSPIRATION_PROMPTS = [
  {
    title: '3-Router OSPF Backbone',
    desc: '3 routers running OSPF Area 0 with loopbacks and branch LANs',
    prompt: 'Build a 3-router OSPF Area 0 backbone with loopback router IDs and branch LAN workstations',
  },
  {
    title: 'Router-on-a-Stick Inter-VLAN',
    desc: '802.1Q subinterfaces for VLAN 10 (Sales) and VLAN 20 (Engineering)',
    prompt: 'Build a Router-on-a-Stick topology routing between VLAN 10 Sales and VLAN 20 Engineering on an access switch',
  },
  {
    title: 'Perimeter Firewall & DMZ',
    desc: 'Tri-homed firewall with ISP outside, DMZ web server, and inside LAN',
    prompt: 'Build a perimeter security architecture with a firewall connecting an outside ISP, a DMZ web server, and an inside workstation',
  },
  {
    title: 'Enterprise Campus (Core & Access)',
    desc: 'Multilayer Core Switch with SVIs and dual access switches',
    prompt: 'Build an enterprise campus network with a Multilayer Core switch running SVIs, two access switches with trunks, and 4 workstations',
  },
  {
    title: 'STP Redundancy Loop',
    desc: '3 switches in a triangle with Root Bridge election and blocking port',
    prompt: 'Build a Spanning Tree redundancy triangle with 3 switches demonstrating root bridge priority and alternate blocking port',
  },
  {
    title: 'SOHO Office with DHCP Services',
    desc: 'Gateway router, central lab server with DHCP/DNS, and PC clients',
    prompt: 'Build a SOHO office network with a router gateway, a server offering DHCP and DNS, and 2 workstation clients',
  },
];

export const TextToTopologyModal: React.FC<TextToTopologyModalProps> = ({
  isOpen,
  onClose,
  onDeployTopology,
}) => {
  const [prompt, setPrompt] = useState('');
  const [forceOffline, setForceOffline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedTopologyResult | null>(null);
  const [deployMode, setDeployMode] = useState<'replace' | 'append'>('replace');

  if (!isOpen) return null;

  const handleSynthesize = async (promptText?: string) => {
    const textToRun = (promptText || prompt).trim();
    if (!textToRun) return;

    setIsLoading(true);
    setErrorMessage(null);
    setGeneratedResult(null);

    // If forced offline, run deterministic local synthesizer immediately
    if (forceOffline) {
      setTimeout(() => {
        try {
          const res = generateOfflineTopology(textToRun);
          setGeneratedResult(res);
        } catch (e: any) {
          setErrorMessage(e.message || 'Offline generator encountered an error');
        } finally {
          setIsLoading(false);
        }
      }, 180);
      return;
    }

    // Try AI endpoint with graceful offline fallback
    try {
      const response = await fetch('/api/ai/text-to-topology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToRun }),
      });

      if (!response.ok) {
        // Fall back directly to offline synthesizer
        const res = generateOfflineTopology(textToRun);
        setGeneratedResult(res);
        setIsLoading(false);
        return;
      }

      const json = await response.json();
      const result = buildTopologyFromAiResponse(json, textToRun);
      setGeneratedResult(result);
    } catch (_fetchErr) {
      // In case network is offline, run local synthesizer
      const res = generateOfflineTopology(textToRun);
      setGeneratedResult(res);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = () => {
    if (!generatedResult) return;
    onDeployTopology(
      generatedResult.devices,
      generatedResult.links,
      generatedResult.title,
      deployMode
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  AI Lab Architect (Text-to-Topology)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  NEW
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Describe a network scenario in plain English to synthesize a complete, wired, and configured lab.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Prompt Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                Prompt / Lab Description
              </label>

              {/* Offline Toggle */}
              <button
                type="button"
                onClick={() => setForceOffline(!forceOffline)}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  forceOffline
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle between AI Cloud Generation and Instant Offline Local Synthesizer"
              >
                {forceOffline ? (
                  <>
                    <WifiOff className="w-3 h-3 text-amber-400" />
                    <span>Mode: Force Offline (Instant Local)</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3 text-sky-400" />
                    <span>Mode: Smart Hybrid (AI + Offline Fallback)</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Build a 3-router OSPF Area 0 backbone with loopbacks and branch LAN workstations..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all resize-none font-mono"
            />
          </div>

          {/* Quick Inspiration Presets */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Quick Inspiration Labs
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {INSPIRATION_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(item.prompt);
                    handleSynthesize(item.prompt);
                  }}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-sky-500/50 hover:bg-slate-800/60 text-left transition-all cursor-pointer group"
                >
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-300 flex items-center justify-between">
                    <span>{item.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    {item.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Synthesize Action Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSynthesize()}
              disabled={isLoading || !prompt.trim()}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Synthesizing Topology & IP Allocations...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate Topology Now
                </>
              )}
            </button>

            {prompt && (
              <button
                onClick={() => {
                  setPrompt('');
                  setGeneratedResult(null);
                }}
                className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Clear Prompt"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Generated Result Preview Card */}
          {generatedResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/40 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">
                    {generatedResult.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      generatedResult.source === 'ai'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {generatedResult.source === 'ai' ? '🤖 AI Generated' : '⚡ Offline Synthesizer'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {generatedResult.summary}
              </p>

              {/* Topology Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs font-mono font-bold text-sky-400">
                    {generatedResult.devices.length}
                  </div>
                  <div className="text-[10px] text-slate-400">Devices</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs font-mono font-bold text-emerald-400">
                    {generatedResult.links.length}
                  </div>
                  <div className="text-[10px] text-slate-400">Cabled Links</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-xs font-mono font-bold text-indigo-400">
                    {generatedResult.devices.filter((d) => d.type === 'router' || d.type === 'l3switch').length}
                  </div>
                  <div className="text-[10px] text-slate-400">Routing Gateways</div>
                </div>
              </div>

              {/* Deployment Option */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Canvas Action:</span>
                  <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                    <button
                      onClick={() => setDeployMode('replace')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        deployMode === 'replace'
                          ? 'bg-sky-500 text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Replace Canvas
                    </button>
                    <button
                      onClick={() => setDeployMode('append')}
                      className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                        deployMode === 'append'
                          ? 'bg-sky-500 text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Append to Canvas
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleDeploy}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Deploy to Canvas & Start
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
