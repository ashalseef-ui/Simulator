import React, { useState, useEffect } from 'react';
import {
  Flame,
  X,
  Play,
  RotateCcw,
  AlertTriangle,
  Clock,
  Award,
  ShieldAlert,
  CheckCircle2,
  Terminal,
  Zap,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import { Device, Link } from '../types/network';
import { createDevice } from '../engine/deviceSpecs';

export interface ChaosChallenge {
  id: string;
  title: string;
  difficulty: 'Junior' | 'Senior' | 'TAC Architect';
  description: string;
  initialTopology: () => { devices: Device[]; links: Link[] };
  faultInjector: (devices: Device[]) => string;
  validator: (devices: Device[]) => boolean;
  successMessage: string;
}

export const CHAOS_CHALLENGES: ChaosChallenge[] = [
  {
    id: 'ospf-mismatch',
    title: 'OSPF Wildcard Mask Outage',
    difficulty: 'Junior',
    description: 'An upstream branch router has an incorrect OSPF wildcard mask preventing Opc/Area 0 adjacency from forming. Inspect OSPF config and fix the network statement.',
    initialTopology: () => {
      const r1 = createDevice('router', 'R1-HQ', 300, 150);
      const r2 = createDevice('router', 'R2-Branch', 600, 150);
      const sw1 = createDevice('switch', 'SW-LAN', 450, 340);
      const pc1 = createDevice('pc', 'Workstation', 450, 480);

      r1.config.interfaces['Gi0/0'].ip = '10.0.0.1';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.252';
      r1.config.interfaces['Gi0/0'].status = 'up';
      r1.config.ospf = {
        processId: 1,
        routerId: '1.1.1.1',
        networks: [{ network: '10.0.0.0', wildcard: '0.0.0.3', area: 0 }],
      };

      r2.config.interfaces['Gi0/0'].ip = '10.0.0.2';
      r2.config.interfaces['Gi0/0'].mask = '255.255.255.252';
      r2.config.interfaces['Gi0/0'].status = 'up';
      r2.config.ospf = {
        processId: 1,
        routerId: '2.2.2.2',
        networks: [{ network: '192.168.1.0', wildcard: '0.0.255.255', area: 0 }], // Faulty wildcard!
      };

      return {
        devices: [r1, r2, sw1, pc1],
        links: [
          { id: 'l1', fromDevice: r1.id, fromPort: 'Gi0/0', toDevice: r2.id, toPort: 'Gi0/0', cable: 'straight' },
          { id: 'l2', fromDevice: r1.id, fromPort: 'Gi0/1', toDevice: sw1.id, toPort: 'Gi0/1', cable: 'straight' },
          { id: 'l3', fromDevice: sw1.id, fromPort: 'Fa0/1', toDevice: pc1.id, toPort: 'Fa0/0', cable: 'straight' },
        ],
      };
    },
    faultInjector: (_devices) => 'OSPF Area 0 adjacency broken between R1-HQ and R2-Branch due to incorrect network wildcard statement.',
    validator: (devices) => {
      const r2 = devices.find((d) => d.name === 'R2-Branch');
      const net = r2?.config.ospf?.networks.find((n) => n.network === '10.0.0.0' || n.network === '0.0.0.0');
      return !!(net && (net.wildcard === '0.0.0.3' || net.wildcard === '0.0.0.255'));
    },
    successMessage: 'Successfully corrected OSPF network wildcard mask! Adjacency formed and routes synchronized.',
  },
  {
    id: 'shutdown-trunk',
    title: 'Silenced Trunk Uplink',
    difficulty: 'Senior',
    description: 'An accidental configuration wipe shut down the trunk uplink between Access Switch and Core Switch, isolating VLAN 10 & 20 traffic.',
    initialTopology: () => {
      const swCore = createDevice('switch', 'SW-Core', 350, 160);
      const swAcc = createDevice('switch', 'SW-Access', 550, 160);
      const pc1 = createDevice('pc', 'PC-Sales', 550, 360);

      swCore.config.interfaces['Gi0/1'].mode = 'trunk';
      swCore.config.interfaces['Gi0/1'].status = 'up';

      swAcc.config.interfaces['Gi0/1'].mode = 'access'; // Faulty mode!
      swAcc.config.interfaces['Gi0/1'].status = 'down'; // Shutdown!
      swAcc.config.interfaces['Fa0/1'].accessVlan = 10;

      pc1.config.interfaces['Fa0/0'].ip = '192.168.10.20';
      pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';

      return {
        devices: [swCore, swAcc, pc1],
        links: [
          { id: 'l1', fromDevice: swCore.id, fromPort: 'Gi0/1', toDevice: swAcc.id, toPort: 'Gi0/1', cable: 'crossover' },
          { id: 'l2', fromDevice: swAcc.id, fromPort: 'Fa0/1', toDevice: pc1.id, toPort: 'Fa0/0', cable: 'straight' },
        ],
      };
    },
    faultInjector: (_devices) => 'Switch trunk port Gi0/1 on SW-Access is administratively down and set to access mode.',
    validator: (devices) => {
      const swAcc = devices.find((d) => d.name === 'SW-Access');
      const iface = swAcc?.config.interfaces['Gi0/1'];
      return !!(iface && iface.status === 'up' && iface.mode === 'trunk');
    },
    successMessage: 'Trunk link re-enabled and mode configured back to trunk! VLAN traffic flowing seamlessly.',
  },
  {
    id: 'missing-gateway',
    title: 'Default Gateway Mismatch',
    difficulty: 'TAC Architect',
    description: 'Workstation clients cannot reach external subnets because their static IP default gateway was wiped or misconfigured.',
    initialTopology: () => {
      const r1 = createDevice('router', 'R1-Gateway', 300, 180);
      const sw1 = createDevice('switch', 'SW-Office', 500, 180);
      const pc1 = createDevice('pc', 'Client-PC', 500, 360);

      r1.config.interfaces['Gi0/0'].ip = '192.168.1.1';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r1.config.interfaces['Gi0/0'].status = 'up';

      pc1.config.interfaces['Fa0/0'].ip = '192.168.1.50';
      pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc1.config.defaultGateway = '192.168.1.254'; // Faulty gateway!

      return {
        devices: [r1, sw1, pc1],
        links: [
          { id: 'l1', fromDevice: r1.id, fromPort: 'Gi0/0', toDevice: sw1.id, toPort: 'Gi0/1', cable: 'straight' },
          { id: 'l2', fromDevice: sw1.id, fromPort: 'Fa0/1', toDevice: pc1.id, toPort: 'Fa0/0', cable: 'straight' },
        ],
      };
    },
    faultInjector: (_devices) => 'Client-PC default gateway points to 192.168.1.254 instead of router interface 192.168.1.1.',
    validator: (devices) => {
      const pc = devices.find((d) => d.name === 'Client-PC');
      return pc?.config.defaultGateway === '192.168.1.1';
    },
    successMessage: 'Default gateway successfully updated to 192.168.1.1! Ping response verified.',
  },
];

interface ChaosBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployChallenge: (devices: Device[], links: Link[], challengeTitle: string) => void;
}

export const ChaosBattleModal: React.FC<ChaosBattleModalProps> = ({
  isOpen,
  onClose,
  onDeployChallenge,
}) => {
  const [selectedChallenge, setSelectedChallenge] = useState<ChaosChallenge>(CHAOS_CHALLENGES[0]);
  const [activeSession, setActiveSession] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes
  const [currentDevices, setCurrentDevices] = useState<Device[]>([]);
  const [currentLinks, setCurrentLinks] = useState<Link[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [scoreEarned, setScoreEarned] = useState<number>(0);

  useEffect(() => {
    let timer: any;
    if (activeSession && !isCompleted && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && activeSession && !isCompleted) {
      setActiveSession(false);
    }
    return () => clearInterval(timer);
  }, [activeSession, isCompleted, timeLeft]);

  if (!isOpen) return null;

  const handleStartChallenge = (challenge: ChaosChallenge) => {
    setSelectedChallenge(challenge);
    const topo = challenge.initialTopology();
    setCurrentDevices(topo.devices);
    setCurrentLinks(topo.links);
    challenge.faultInjector(topo.devices);
    setActiveSession(true);
    setTimeLeft(300);
    setIsCompleted(false);
    setScoreEarned(0);
    onDeployChallenge(topo.devices, topo.links, `Chaos Battle: ${challenge.title}`);
  };

  const handleVerifyFix = () => {
    const passed = selectedChallenge.validator(currentDevices);
    if (passed) {
      setIsCompleted(true);
      setActiveSession(false);
      const bonus = Math.round(timeLeft * 1.5);
      const base = selectedChallenge.difficulty === 'Junior' ? 500 : selectedChallenge.difficulty === 'Senior' ? 1000 : 2000;
      setScoreEarned(base + bonus);
    } else {
      alert('Fault still present! Inspect device configurations and CLI states.');
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/50 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-md">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">
                  Chaos Monkey Battle Mode
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  GAMIFIED CCNA TRAINER
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Survive live network faults, isolate root causes, and restore connectivity before SLA breach.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {activeSession ? (
            <div className="space-y-5">
              {/* Active SLA Countdown Banner */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Clock className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">SLA Outage Countdown</div>
                    <div className="text-lg font-mono font-extrabold text-amber-400">
                      {formatTime(timeLeft)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold">
                    {selectedChallenge.title}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Difficulty: <span className="text-amber-400 font-semibold">{selectedChallenge.difficulty}</span>
                  </div>
                </div>
              </div>

              {/* Challenge Briefing */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Active Fault Injector Report
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {selectedChallenge.faultInjector(currentDevices)}
                </p>
                <p className="text-xs text-slate-400">
                  {selectedChallenge.description}
                </p>
              </div>

              {isCompleted ? (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                    <Award className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-emerald-300">
                    Incident Remediation Successful!
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    {selectedChallenge.successMessage}
                  </p>
                  <div className="text-sm font-mono font-extrabold text-emerald-400">
                    XP Score Earned: +{scoreEarned} PTS
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveSession(false)}
                      className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer"
                    >
                      Choose Another Chaos Mission
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleVerifyFix}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Verify Configuration Fix & Resolve Incident
                  </button>
                  <button
                    onClick={() => handleStartChallenge(selectedChallenge)}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                    title="Reset Challenge"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Select Chaos Mission & Difficulty
              </span>
              <div className="space-y-3">
                {CHAOS_CHALLENGES.map((ch) => (
                  <div
                    key={ch.id}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/50 transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white group-hover:text-amber-300">
                          {ch.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            ch.difficulty === 'Junior'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : ch.difficulty === 'Senior'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {ch.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {ch.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleStartChallenge(ch)}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Start Battle
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
