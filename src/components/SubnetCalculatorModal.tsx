import React, { useState } from 'react';
import {
  getSubnetDetails,
  cidrToMask,
  calculateVlsmSubnets,
  VlsmRequirement,
} from '../utils/ipUtils';
import {
  X,
  Binary,
  Award,
  CheckCircle,
  XCircle,
  RotateCcw,
  Sliders,
  Table,
  Plus,
  Trash2,
  Copy,
  Check,
  HelpCircle,
} from 'lucide-react';

interface SubnetCalculatorModalProps {
  onClose: () => void;
}

export const SubnetCalculatorModal: React.FC<SubnetCalculatorModalProps> = ({
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'calc' | 'vlsm' | 'matrix' | 'quiz'>('calc');

  // 1. IPv4 Calculator State
  const [inputIp, setInputIp] = useState('192.168.1.50');
  const [cidr, setCidr] = useState(24);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 2. VLSM Planner State
  const [vlsmBaseIp, setVlsmBaseIp] = useState('10.0.0.0');
  const [vlsmBaseCidr, setVlsmBaseCidr] = useState(16);
  const [vlsmReqs, setVlsmReqs] = useState<VlsmRequirement[]>([
    { name: 'HQ-DataCenter', neededHosts: 200 },
    { name: 'Branch-Sales', neededHosts: 60 },
    { name: 'Branch-VoIP', neededHosts: 30 },
    { name: 'WAN-P2P-Link1', neededHosts: 2 },
  ]);
  const [newReqName, setNewReqName] = useState('');
  const [newReqHosts, setNewReqHosts] = useState('');

  // 3. Matrix Search State
  const [matrixSearch, setMatrixSearch] = useState('');

  // 4. Quiz State
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizQuestion, setQuizQuestion] = useState(() => generateQuizQuestion());
  const [userAnswer, setUserAnswer] = useState('');
  const [quizFeedback, setQuizFeedback] = useState<{
    submitted: boolean;
    correct: boolean;
    explanation: string;
  } | null>(null);

  const subnet = getSubnetDetails(inputIp, cidr);

  // Determine Class A/B/C/D/E and Private/Public
  const firstOctet = parseInt(inputIp.split('.')[0] || '0', 10);
  let ipClass = 'Class C';
  if (firstOctet >= 1 && firstOctet <= 126) ipClass = 'Class A';
  else if (firstOctet === 127) ipClass = 'Class A (Loopback)';
  else if (firstOctet >= 128 && firstOctet <= 191) ipClass = 'Class B';
  else if (firstOctet >= 192 && firstOctet <= 223) ipClass = 'Class C';
  else if (firstOctet >= 224 && firstOctet <= 239) ipClass = 'Class D (Multicast)';
  else if (firstOctet >= 240 && firstOctet <= 255) ipClass = 'Class E (Experimental)';

  const isPrivate =
    (firstOctet === 10) ||
    (firstOctet === 172 && parseInt(inputIp.split('.')[1] || '0', 10) >= 16 && parseInt(inputIp.split('.')[1] || '0', 10) <= 31) ||
    (firstOctet === 192 && parseInt(inputIp.split('.')[1] || '0', 10) === 168);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // VLSM Calculation
  const vlsmResult = calculateVlsmSubnets(vlsmBaseIp, vlsmBaseCidr, vlsmReqs);

  const handleAddVlsmReq = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseInt(newReqHosts, 10);
    if (!newReqName.trim() || isNaN(h) || h <= 0) return;
    setVlsmReqs([...vlsmReqs, { name: newReqName.trim(), neededHosts: h }]);
    setNewReqName('');
    setNewReqHosts('');
  };

  const handleRemoveVlsmReq = (index: number) => {
    setVlsmReqs(vlsmReqs.filter((_, i) => i !== index));
  };

  // Quiz Question Generator
  function generateQuizQuestion() {
    const types = ['hosts', 'network', 'broadcast', 'wildcard'] as const;
    const type = types[Math.floor(Math.random() * types.length)];
    const randomOctet = () => Math.floor(Math.random() * 254) + 1;
    const cidrs = [24, 25, 26, 27, 28, 29, 30];
    const qCidr = cidrs[Math.floor(Math.random() * cidrs.length)];
    const qIp = `192.168.${randomOctet()}.${randomOctet()}`;
    const details = getSubnetDetails(qIp, qCidr);

    if (type === 'hosts') {
      return {
        prompt: `How many usable host IP addresses are available in a /${qCidr} subnet?`,
        answer: String(details.usableHosts),
        explanation: `A /${qCidr} has ${32 - qCidr} host bits: 2^${32 - qCidr} - 2 = ${details.usableHosts} usable hosts.`,
      };
    } else if (type === 'network') {
      return {
        prompt: `What is the network address for ${qIp}/${qCidr}?`,
        answer: details.networkAddress,
        explanation: `Bitwise AND of ${qIp} and mask ${details.mask} yields network address ${details.networkAddress}.`,
      };
    } else if (type === 'broadcast') {
      return {
        prompt: `What is the broadcast address for ${qIp}/${qCidr}?`,
        answer: details.broadcastAddress,
        explanation: `Setting all host bits to 1 in ${details.networkAddress}/${qCidr} gives broadcast ${details.broadcastAddress}.`,
      };
    } else {
      return {
        prompt: `What is the wildcard mask for subnet mask ${details.mask}?`,
        answer: details.wildcard,
        explanation: `Inverting mask ${details.mask} (255.255.255.255 - ${details.mask}) gives wildcard ${details.wildcard}.`,
      };
    }
  }

  const handleCheckQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAnswer.trim()) return;

    const isCorrect = userAnswer.trim().toLowerCase() === quizQuestion.answer.toLowerCase();
    if (isCorrect) {
      setQuizScore((s) => s + 10);
      setQuizStreak((st) => st + 1);
    } else {
      setQuizStreak(0);
    }

    setQuizFeedback({
      submitted: true,
      correct: isCorrect,
      explanation: quizQuestion.explanation,
    });
  };

  const handleNextQuestion = () => {
    setQuizQuestion(generateQuizQuestion());
    setUserAnswer('');
    setQuizFeedback(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Binary className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                Subnetting & CIDR Studio
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-mono">
                  IPv4 / VLSM / CCNA
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Bitmask Visualizer, VLSM Subnet Planner & CCNA Quiz
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 gap-0.5">
              <button
                onClick={() => setActiveTab('calc')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'calc'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Calculator
              </button>
              <button
                onClick={() => setActiveTab('vlsm')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                  activeTab === 'vlsm'
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                VLSM Planner
              </button>
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                  activeTab === 'matrix'
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                CIDR Matrix
              </button>
              <button
                onClick={() => setActiveTab('quiz')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                  activeTab === 'quiz'
                    ? 'bg-purple-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Quiz
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 ml-1 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar text-xs">
          {/* TAB 1: CALCULATOR */}
          {activeTab === 'calc' && (
            <div className="space-y-3.5">
              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    IPv4 Address
                  </label>
                  <input
                    type="text"
                    value={inputIp}
                    onChange={(e) => setInputIp(e.target.value)}
                    placeholder="192.168.1.50"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                  <div className="flex items-center gap-2 mt-2 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {ipClass}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        isPrivate
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {isPrivate ? 'RFC 1918 Private IP' : 'Public IP Space'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      CIDR Prefix (/{cidr})
                    </label>
                    <span className="font-mono text-xs text-sky-400 font-bold">
                      {cidrToMask(cidr)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="32"
                    value={cidr}
                    onChange={(e) => setCidr(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-500 cursor-pointer mt-2"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                    <span>/1 (2B Hosts)</span>
                    <span>/24 (254 Hosts)</span>
                    <span>/32 (Host)</span>
                  </div>
                </div>
              </div>

              {/* 32-Bit Binary Visualizer */}
              <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Binary className="w-3.5 h-3.5 text-sky-400" />
                    32-Bit Binary Bitmask Boundary
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-sky-400 font-mono text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      Network Bits ({cidr})
                    </span>
                    <span className="flex items-center gap-1 text-purple-400 font-mono text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      Host Bits ({32 - cidr})
                    </span>
                  </div>
                </div>

                {/* Binary Bits Render */}
                <div className="p-3 bg-black rounded-lg border border-slate-900 font-mono text-xs flex justify-between tracking-widest overflow-x-auto">
                  {Array.from({ length: 4 }).map((_, octetIdx) => {
                    const startBit = octetIdx * 8;
                    const octetBits = subnet.ipBinary.slice(startBit, startBit + 8);

                    return (
                      <div key={octetIdx} className="flex items-center gap-0.5">
                        {octetBits.split('').map((bit, bitIdx) => {
                          const globalBitIdx = startBit + bitIdx;
                          const isNetworkBit = globalBitIdx < cidr;
                          return (
                            <span
                              key={bitIdx}
                              className={`px-1 py-0.5 rounded font-bold transition-all ${
                                isNetworkBit
                                  ? 'text-sky-400 bg-sky-950/70 border border-sky-500/30'
                                  : 'text-purple-400 bg-purple-950/70 border border-purple-500/30'
                              }`}
                            >
                              {bit}
                            </span>
                          );
                        })}
                        {octetIdx < 3 && <span className="text-slate-600 font-bold mx-1.5">.</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calculated Range & Addressing Results */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                {[
                  { label: 'Network Address', val: subnet.networkAddress, color: 'text-sky-400' },
                  { label: 'Broadcast Address', val: subnet.broadcastAddress, color: 'text-purple-400' },
                  { label: 'First Usable Host', val: subnet.firstUsable, color: 'text-emerald-400' },
                  { label: 'Last Usable Host', val: subnet.lastUsable, color: 'text-emerald-400' },
                  { label: 'Subnet Mask', val: subnet.mask, color: 'text-slate-200' },
                  { label: 'Wildcard Mask', val: subnet.wildcard, color: 'text-amber-400' },
                  { label: 'Usable Hosts', val: subnet.usableHosts.toLocaleString(), color: 'text-slate-100' },
                  { label: 'Total Addresses', val: subnet.totalHosts.toLocaleString(), color: 'text-slate-400' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center group hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <span className="text-slate-500 text-[10px] block">{item.label}</span>
                      <span className={`${item.color} font-bold text-xs`}>{item.val}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(item.val, item.label)}
                      className="p-1 text-slate-600 group-hover:text-slate-300 hover:text-white rounded cursor-pointer"
                      title="Copy to clipboard"
                    >
                      {copiedField === item.label ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: VLSM PLANNER */}
          {activeTab === 'vlsm' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Major Base Network IP
                  </label>
                  <input
                    type="text"
                    value={vlsmBaseIp}
                    onChange={(e) => setVlsmBaseIp(e.target.value)}
                    placeholder="10.0.0.0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Base Prefix (/{vlsmBaseCidr})
                  </label>
                  <select
                    value={vlsmBaseCidr}
                    onChange={(e) => setVlsmBaseCidr(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200"
                  >
                    {Array.from({ length: 30 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        /{i + 1} ({cidrToMask(i + 1)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Subnet Add Form
                  </label>
                  <form onSubmit={handleAddVlsmReq} className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Name (e.g. Sales)"
                      value={newReqName}
                      onChange={(e) => setNewReqName(e.target.value)}
                      className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                    />
                    <input
                      type="number"
                      placeholder="Hosts"
                      value={newReqHosts}
                      onChange={(e) => setNewReqHosts(e.target.value)}
                      className="w-1/3 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200"
                    />
                    <button
                      type="submit"
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer"
                      title="Add Subnet Requirement"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>

              {/* Requirements & Allocation Table */}
              {vlsmResult.error && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/50 text-rose-300 rounded-xl text-xs font-semibold">
                  ⚠️ {vlsmResult.error}
                </div>
              )}

              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-sans">
                    <tr>
                      <th className="p-2.5">Subnet Name</th>
                      <th className="p-2.5">Needed Hosts</th>
                      <th className="p-2.5">Allocated Subnet</th>
                      <th className="p-2.5">Mask</th>
                      <th className="p-2.5">Usable Host Range</th>
                      <th className="p-2.5">Broadcast</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {vlsmResult.allocated.map((alloc, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="p-2.5 font-bold font-sans text-slate-100">{alloc.name}</td>
                        <td className="p-2.5 text-slate-400">{alloc.neededHosts}</td>
                        <td className="p-2.5 text-sky-400 font-bold">
                          {alloc.networkAddress}/{alloc.cidr}
                        </td>
                        <td className="p-2.5 text-slate-300">{alloc.mask}</td>
                        <td className="p-2.5 text-emerald-400">
                          {alloc.firstUsable} - {alloc.lastUsable}
                        </td>
                        <td className="p-2.5 text-purple-400">{alloc.broadcastAddress}</td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleRemoveVlsmReq(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {vlsmResult.allocated.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-500 font-sans">
                          No subnet requirements added yet. Use the form above to plan VLSM allocations.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: CIDR REFERENCE MATRIX */}
          {activeTab === 'matrix' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <input
                  type="text"
                  placeholder="Filter prefix (e.g. /24 or 255.255)..."
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 w-64"
                />
                <span className="text-[11px] text-slate-400 font-mono">
                  Showing 32 IPv4 Prefix Masks
                </span>
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden max-h-[380px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 sticky top-0 font-sans">
                    <tr>
                      <th className="p-2">Prefix</th>
                      <th className="p-2">Subnet Mask</th>
                      <th className="p-2">Wildcard Mask</th>
                      <th className="p-2">Usable Hosts</th>
                      <th className="p-2">Total Addresses</th>
                      <th className="p-2">Class / Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {Array.from({ length: 32 }).map((_, i) => {
                      const pfx = i + 1;
                      const det = getSubnetDetails('10.0.0.0', pfx);
                      const strToMatch = `/${pfx} ${det.mask} ${det.wildcard}`.toLowerCase();
                      if (matrixSearch && !strToMatch.includes(matrixSearch.toLowerCase())) {
                        return null;
                      }

                      return (
                        <tr
                          key={pfx}
                          className={`hover:bg-slate-900/50 ${
                            pfx === 24 ? 'bg-sky-950/30 text-sky-300 font-bold' : ''
                          }`}
                        >
                          <td className="p-2 text-sky-400 font-bold">/{pfx}</td>
                          <td className="p-2">{det.mask}</td>
                          <td className="p-2 text-amber-400">{det.wildcard}</td>
                          <td className="p-2 text-emerald-400">{det.usableHosts.toLocaleString()}</td>
                          <td className="p-2 text-slate-400">{det.totalHosts.toLocaleString()}</td>
                          <td className="p-2 font-sans text-slate-400">
                            {pfx === 30 ? 'P2P WAN Link' : pfx === 32 ? 'Single Host Loopback' : pfx <= 8 ? 'Class A Block' : pfx <= 16 ? 'Class B Block' : 'Class C Subnet'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: GAMIFIED QUIZ */}
          {activeTab === 'quiz' && (
            <div className="space-y-4">
              {/* Score & Streak Bar */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                    <Award className="w-4 h-4" />
                    Score: {quizScore}
                  </div>
                  <div className="text-slate-400 text-xs">
                    Streak: <span className="text-emerald-400 font-bold font-mono">{quizStreak}</span> 🔥
                  </div>
                </div>
                <button
                  onClick={() => {
                    setQuizScore(0);
                    setQuizStreak(0);
                    handleNextQuestion();
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>

              {/* Question Card */}
              <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                <div className="text-sm font-semibold text-slate-100 leading-snug flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>{quizQuestion.prompt}</span>
                </div>

                <form onSubmit={handleCheckQuiz} className="flex gap-2">
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Enter answer (e.g. 192.168.1.0 or 62)"
                    disabled={!!quizFeedback}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                    autoFocus
                  />
                  {!quizFeedback ? (
                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Submit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Next Question
                    </button>
                  )}
                </form>

                {/* Feedback */}
                {quizFeedback && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                      quizFeedback.correct
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    }`}
                  >
                    {quizFeedback.correct ? (
                      <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold text-xs mb-1">
                        {quizFeedback.correct
                          ? 'Correct! Excellent job.'
                          : `Incorrect. Expected: ${quizQuestion.answer}`}
                      </div>
                      <div className="text-[11px] opacity-90 leading-relaxed font-sans">
                        {quizFeedback.explanation}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
          <div>Built-in Subnetting Tool for CCNA & Network Architecture</div>
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
