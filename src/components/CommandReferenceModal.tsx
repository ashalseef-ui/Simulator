import React, { useState } from 'react';
import {
  Terminal,
  Search,
  X,
  Copy,
  Check,
  BookOpen,
  Filter,
  Globe,
  ArrowRightLeft,
} from 'lucide-react';
import {
  MULTI_VENDOR_ROSETTA_STONE,
  VENDOR_OS_PROFILES,
} from '../engine/cli/multiVendorEngines';

import { COMMAND_REFERENCE_LIST, CommandEntry } from "../data/commandReferenceData";
export { COMMAND_REFERENCE_LIST };
export type { CommandEntry };

interface CommandReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCommand?: (cmd: string) => void;
}

export const CommandReferenceModal: React.FC<CommandReferenceModalProps> = ({
  isOpen,
  onClose,
  onInsertCommand,
}) => {
  const [viewMode, setViewMode] = useState<'rosetta' | 'cisco'>('rosetta');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const ciscoCategories = [
    'All',
    'EXEC Navigation',
    'Verification',
    'CLI Output Filters',
    'IP & Interfaces',
    'IP & Routing',
    'VLANs & Layer 2',
    'Spanning Tree (STP)',
    'OSPF & Routing',
    'Security & PortSec',
    'Security & ACL',
    'EtherChannel & LACP',
    'First Hop Redundancy (FHRP)',
    'DHCP & Services',
    'Management & Lines',
    'File System & Config',
  ];

  const rosettaCategories = [
    'All',
    'Interfaces & IP',
    'Routing & Gateways',
    'VLANs & Switching',
    'Routing Protocols (OSPF)',
    'ARP & Tables',
    'Save & Commit',
    'Diagnostics & Troubleshooting',
    'System & Identity',
  ];

  const categories = viewMode === 'rosetta' ? rosettaCategories : ciscoCategories;

  const filteredCommands = COMMAND_REFERENCE_LIST.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.command.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.syntax.toLowerCase().includes(term) ||
      item.mode.toLowerCase().includes(term);
    return matchesCat && matchesSearch;
  });

  const filteredRosetta = MULTI_VENDOR_ROSETTA_STONE.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.task.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.cisco.toLowerCase().includes(term) ||
      item.juniper.toLowerCase().includes(term) ||
      item.arista.toLowerCase().includes(term) ||
      item.linux.toLowerCase().includes(term) ||
      item.mikrotik.toLowerCase().includes(term) ||
      item.note.toLowerCase().includes(term);
    return matchesCat && matchesSearch;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg border border-sky-500/40">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Universal Network CLI & Multi-Vendor Command Matrix
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  Universal Simulator Engine
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Cross-Vendor CLI Translation: Cisco IOS · Juniper Junos · Arista EOS · Linux / VyOS · MikroTik RouterOS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => {
                  setViewMode('rosetta');
                  setSelectedCategory('All');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'rosetta'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowRightLeft className="w-3 h-3" />
                Cross-Vendor Rosetta Stone
              </button>
              <button
                onClick={() => {
                  setViewMode('cisco');
                  setSelectedCategory('All');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'cisco'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3 h-3" />
                Cisco IOS Encyclopedia
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                viewMode === 'rosetta'
                  ? 'Search networking task, syntax, or command across all 5 vendors (e.g. show ip route, commit, ping, vlan)...'
                  : 'Search Cisco commands, syntax, keywords, or descriptions...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500 font-mono transition-colors"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500 font-medium cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Vendor Profile Badges Bar (Rosetta view) */}
        {viewMode === 'rosetta' && (
          <div className="px-4 py-1.5 bg-slate-950/80 border-b border-slate-800/80 text-[11px] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-semibold mr-1 text-[10px]">Supported NOS Dialects:</span>
              {Object.values(VENDOR_OS_PROFILES).map((prof) => (
                <span
                  key={prof.id}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${prof.badgeColor}`}
                >
                  {prof.badge}
                </span>
              ))}
            </div>
            <span className="text-slate-500 font-mono text-[10px]">
              Showing {filteredRosetta.length} Operations in {selectedCategory}
            </span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-3.5 custom-scrollbar space-y-2.5 bg-slate-950/40">
          {viewMode === 'rosetta' ? (
            /* ========================================================= */
            /* MULTI-VENDOR ROSETTA STONE MATRIX                         */
            /* ========================================================= */
            filteredRosetta.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Globe className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm font-semibold text-slate-400">No matching multi-vendor operations found</p>
                <p className="text-xs text-slate-500 mt-1">Try another search keyword or switch category to "All".</p>
              </div>
            ) : (
              filteredRosetta.map((entry, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-3 shadow-sm"
                >
                  {/* Task Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{entry.task}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                        {entry.category}
                      </span>
                    </div>
                  </div>

                  {/* Multi-Vendor Comparison Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
                    {/* 1. Cisco IOS */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-sky-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-sky-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          Cisco IOS / IOS-XE
                        </span>
                        <button
                          onClick={() => handleCopy(entry.cisco)}
                          title="Copy Cisco command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap leading-tight break-all">
                        {entry.cisco}
                      </pre>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(entry.cisco.split('\n')[0]);
                            onClose();
                          }}
                          className="mt-2 text-[9px] font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 py-0.5 px-1.5 rounded border border-sky-500/30 self-start cursor-pointer"
                        >
                          Insert
                        </button>
                      )}
                    </div>

                    {/* 2. Juniper Junos */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-emerald-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Juniper Junos OS
                        </span>
                        <button
                          onClick={() => handleCopy(entry.juniper)}
                          title="Copy Juniper command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-emerald-300 whitespace-pre-wrap leading-tight break-all">
                        {entry.juniper}
                      </pre>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(entry.juniper.split('\n')[0]);
                            onClose();
                          }}
                          className="mt-2 text-[9px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 py-0.5 px-1.5 rounded border border-emerald-500/30 self-start cursor-pointer"
                        >
                          Insert
                        </button>
                      )}
                    </div>

                    {/* 3. Arista EOS */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-indigo-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          Arista EOS
                        </span>
                        <button
                          onClick={() => handleCopy(entry.arista)}
                          title="Copy Arista command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-indigo-300 whitespace-pre-wrap leading-tight break-all">
                        {entry.arista}
                      </pre>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(entry.arista.split('\n')[0]);
                            onClose();
                          }}
                          className="mt-2 text-[9px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 py-0.5 px-1.5 rounded border border-indigo-500/30 self-start cursor-pointer"
                        >
                          Insert
                        </button>
                      )}
                    </div>

                    {/* 4. Linux / VyOS */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Linux / VyOS
                        </span>
                        <button
                          onClick={() => handleCopy(entry.linux)}
                          title="Copy Linux command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-amber-300 whitespace-pre-wrap leading-tight break-all">
                        {entry.linux}
                      </pre>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(entry.linux.split('\n')[0]);
                            onClose();
                          }}
                          className="mt-2 text-[9px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 py-0.5 px-1.5 rounded border border-amber-500/30 self-start cursor-pointer"
                        >
                          Insert
                        </button>
                      )}
                    </div>

                    {/* 5. MikroTik RouterOS */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-rose-500/30 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          MikroTik RouterOS
                        </span>
                        <button
                          onClick={() => handleCopy(entry.mikrotik)}
                          title="Copy MikroTik command"
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-rose-300 whitespace-pre-wrap leading-tight break-all">
                        {entry.mikrotik}
                      </pre>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(entry.mikrotik.split('\n')[0]);
                            onClose();
                          }}
                          className="mt-2 text-[9px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 py-0.5 px-1.5 rounded border border-rose-500/30 self-start cursor-pointer"
                        >
                          Insert
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Architecture & Engineering Note */}
                  <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                    <span className="text-sky-400 font-bold uppercase text-[9px] shrink-0 mt-0.5">Note:</span>
                    <span>{entry.note}</span>
                  </div>
                </div>
              ))
            )
          ) : (
            /* ========================================================= */
            /* CISCO IOS SINGLE COMMAND ENCYCLOPEDIA                     */
            /* ========================================================= */
            filteredCommands.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <BookOpen className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm font-semibold text-slate-400">No matching commands found</p>
                <p className="text-xs text-slate-500 mt-1">Try another search keyword or select "All" categories.</p>
              </div>
            ) : (
              filteredCommands.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-2 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/50">
                        {item.command}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {item.mode}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopy(item.example)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copy command to clipboard"
                      >
                        {copiedCmd === item.example ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      {onInsertCommand && (
                        <button
                          onClick={() => {
                            onInsertCommand(item.example.replace(/^.*?#\s*|.*?>\s*|.*?\(config.*?\)?#\s*/, ''));
                            onClose();
                          }}
                          className="px-2 py-1 rounded bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 text-xs font-semibold transition-colors cursor-pointer"
                          title="Send to active device CLI"
                        >
                          Insert
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/60 text-slate-400">
                      <span className="text-slate-500 text-[10px] block uppercase font-sans font-bold">Syntax</span>
                      <span className="text-amber-300/90">{item.syntax}</span>
                    </div>
                    <div className="bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/60 text-slate-400">
                      <span className="text-slate-500 text-[10px] block uppercase font-sans font-bold">Example</span>
                      <span className="text-emerald-400">{item.example}</span>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <span>WireCraft Universal Network Operating System Architecture</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400">Cisco · Juniper · Arista · Linux/VyOS · MikroTik</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors cursor-pointer"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
};

