import React, { useState, useEffect, useRef } from 'react';
import { Device, Link } from '../types/network';
import { createDevice } from '../engine/deviceSpecs';
import { audioEngine } from '../utils/audioEffects';
import {
  Timer,
  Trophy,
  RotateCcw,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Zap,
  Award,
  X,
  Share2,
  Check,
} from 'lucide-react';

export interface SpeedrunChallenge {
  id: string;
  title: string;
  category: string;
  description: string;
  goldTime: number; // seconds
  silverTime: number;
  bronzeTime: number;
  initialTopology: () => { devices: Device[]; links: Link[] };
  validate: (devices: Device[], links: Link[]) => { passed: boolean; completedGoals: string[]; remainingGoals: string[] };
}

export const SPEEDRUN_CHALLENGES: SpeedrunChallenge[] = [
  {
    id: 'speedrun_gw_ping',
    title: 'Gateway Sprint (Ping in 25s)',
    category: 'IP Addressing & ICMP',
    description: 'Configure PC0 IP (192.168.1.50/24), default gateway (192.168.1.1), bring up R1 Gi0/0, and establish connectivity!',
    goldTime: 25,
    silverTime: 45,
    bronzeTime: 90,
    initialTopology: () => {
      const pc = createDevice('pc', 'PC0', 200, 280);
      pc.id = 'speed_pc0';
      const router = createDevice('router', 'R1', 520, 280);
      router.id = 'speed_r1';
      router.config.interfaces['GigabitEthernet0_0'] = {
        name: 'GigabitEthernet0/0',
        ip: '192.168.1.1',
        mask: '255.255.255.0',
        mac: '0001.9654.1111',
        status: 'down',
        speed: 1000,
      };

      const link: Link = {
        id: 'link_speed_1',
        fromDevice: 'speed_pc0',
        fromPort: 'FastEthernet0',
        toDevice: 'speed_r1',
        toPort: 'GigabitEthernet0/0',
        cable: 'straight',
      };

      return { devices: [pc, router], links: [link] };
    },
    validate: (devices) => {
      const pc = devices.find((d) => d.id === 'speed_pc0' || d.name === 'PC0');
      const r1 = devices.find((d) => d.id === 'speed_r1' || d.name === 'R1');
      const completed: string[] = [];
      const remaining: string[] = [];

      // Goal 1: PC0 IP
      const pcIface = pc?.config.interfaces?.FastEthernet0;
      if (pcIface?.ip === '192.168.1.50' && pcIface?.mask === '255.255.255.0') {
        completed.push('PC0 configured with 192.168.1.50 /24');
      } else {
        remaining.push('Configure PC0 IP to 192.168.1.50 255.255.255.0');
      }

      // Goal 2: PC0 Default Gateway
      if (pc?.config.defaultGateway === '192.168.1.1') {
        completed.push('PC0 Default Gateway set to 192.168.1.1');
      } else {
        remaining.push('Set PC0 Default Gateway to 192.168.1.1');
      }

      // Goal 3: R1 Gi0/0 up
      const r1Iface = r1?.config.interfaces?.GigabitEthernet0_0;
      if (r1Iface?.status === 'up') {
        completed.push('R1 GigabitEthernet0/0 interface is UP');
      } else {
        remaining.push('Bring up R1 GigabitEthernet0/0 (no shutdown)');
      }

      return {
        passed: remaining.length === 0,
        completedGoals: completed,
        remainingGoals: remaining,
      };
    },
  },
  {
    id: 'speedrun_trunk_vlan',
    title: '802.1Q Trunk Sprint (35s)',
    category: 'VLANs & Layer 2',
    description: 'Configure SW1 Gi0/1 into 802.1Q Trunk mode, allow VLANs 10 and 20, and set Native VLAN to 99!',
    goldTime: 35,
    silverTime: 60,
    bronzeTime: 120,
    initialTopology: () => {
      const sw1 = createDevice('switch', 'SW1', 280, 280);
      sw1.id = 'speed_sw1';
      sw1.config.vlans = [
        { id: 1, name: 'default' },
        { id: 10, name: 'Engineering' },
        { id: 20, name: 'Sales' },
        { id: 99, name: 'NativeMgmt' },
      ];
      sw1.config.interfaces['GigabitEthernet0_1'] = {
        name: 'GigabitEthernet0/1',
        mac: '0011.2233.4455',
        status: 'up',
        speed: 1000,
        mode: 'access',
        accessVlan: 1,
      };

      const sw2 = createDevice('switch', 'SW2', 540, 280);
      sw2.id = 'speed_sw2';
      sw2.config.vlans = [
        { id: 1, name: 'default' },
        { id: 10, name: 'Engineering' },
        { id: 20, name: 'Sales' },
        { id: 99, name: 'NativeMgmt' },
      ];
      sw2.config.interfaces['GigabitEthernet0_1'] = {
        name: 'GigabitEthernet0/1',
        mac: '0011.2233.4466',
        status: 'up',
        speed: 1000,
        mode: 'trunk',
        trunkAllowedVlans: [10, 20, 99],
        nativeVlan: 99,
      };

      const link: Link = {
        id: 'link_speed_trunk',
        fromDevice: 'speed_sw1',
        fromPort: 'GigabitEthernet0_1',
        toDevice: 'speed_sw2',
        toPort: 'GigabitEthernet0_1',
        cable: 'straight',
      };

      return { devices: [sw1, sw2], links: [link] };
    },
    validate: (devices) => {
      const sw1 = devices.find((d) => d.id === 'speed_sw1' || d.name === 'SW1');
      const completed: string[] = [];
      const remaining: string[] = [];

      const iface = sw1?.config.interfaces?.GigabitEthernet0_1;

      if (iface?.mode === 'trunk') {
        completed.push('SW1 Gi0/1 configured in trunk mode');
      } else {
        remaining.push('Set SW1 Gi0/1 switchport mode trunk');
      }

      if (iface?.nativeVlan === 99) {
        completed.push('SW1 Gi0/1 native VLAN set to 99');
      } else {
        remaining.push('Set SW1 Gi0/1 switchport trunk native vlan 99');
      }

      if (iface?.trunkAllowedVlans?.includes(10) && iface?.trunkAllowedVlans?.includes(20)) {
        completed.push('SW1 Gi0/1 allows VLANs 10,20');
      } else {
        remaining.push('Configure allowed VLANs on SW1 Gi0/1 (10, 20)');
      }

      return {
        passed: remaining.length === 0,
        completedGoals: completed,
        remainingGoals: remaining,
      };
    },
  },
  {
    id: 'speedrun_ospf_sprint',
    title: 'OSPF Area 0 Adjacency Sprint (40s)',
    category: 'Routing Protocols',
    description: 'Configure OSPF Process 1 on R1 and R2 across subnet 10.0.0.0/30 in Area 0 to establish adjacency!',
    goldTime: 40,
    silverTime: 75,
    bronzeTime: 140,
    initialTopology: () => {
      const r1 = createDevice('router', 'R1', 250, 280);
      r1.id = 'speed_ospf_r1';
      r1.config.interfaces['GigabitEthernet0_0'] = {
        name: 'GigabitEthernet0/0',
        ip: '10.0.0.1',
        mask: '255.255.255.252',
        mac: '0001.1111.0001',
        status: 'up',
        speed: 1000,
      };

      const r2 = createDevice('router', 'R2', 550, 280);
      r2.id = 'speed_ospf_r2';
      r2.config.interfaces['GigabitEthernet0_0'] = {
        name: 'GigabitEthernet0/0',
        ip: '10.0.0.2',
        mask: '255.255.255.252',
        mac: '0001.2222.0002',
        status: 'up',
        speed: 1000,
      };

      const link: Link = {
        id: 'link_speed_ospf',
        fromDevice: 'speed_ospf_r1',
        fromPort: 'GigabitEthernet0/0',
        toDevice: 'speed_ospf_r2',
        toPort: 'GigabitEthernet0/0',
        cable: 'straight',
      };

      return { devices: [r1, r2], links: [link] };
    },
    validate: (devices) => {
      const r1 = devices.find((d) => d.id === 'speed_ospf_r1' || d.name === 'R1');
      const r2 = devices.find((d) => d.id === 'speed_ospf_r2' || d.name === 'R2');
      const completed: string[] = [];
      const remaining: string[] = [];

      const r1Ospf = r1?.config.ospf;
      const r2Ospf = r2?.config.ospf;

      if (r1Ospf && r1Ospf.networks?.some((n: { network: string; wildcard: string; area: number }) => n.network.startsWith('10.0.0.') && n.area === 0)) {
        completed.push('R1 OSPF Process advertising 10.0.0.0 in Area 0');
      } else {
        remaining.push('Configure OSPF network 10.0.0.0 0.0.0.3 area 0 on R1');
      }

      if (r2Ospf && r2Ospf.networks?.some((n: { network: string; wildcard: string; area: number }) => n.network.startsWith('10.0.0.') && n.area === 0)) {
        completed.push('R2 OSPF Process advertising 10.0.0.0 in Area 0');
      } else {
        remaining.push('Configure OSPF network 10.0.0.0 0.0.0.3 area 0 on R2');
      }

      return {
        passed: remaining.length === 0,
        completedGoals: completed,
        remainingGoals: remaining,
      };
    },
  },
];

interface SpeedrunModalProps {
  devices: Device[];
  links: Link[];
  onLoadTopology: (devices: Device[], links: Link[], labId?: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SpeedrunModal: React.FC<SpeedrunModalProps> = ({
  devices,
  links,
  onLoadTopology,
  isOpen,
  onClose,
}) => {
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(SPEEDRUN_CHALLENGES[0].id);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [personalBests, setPersonalBests] = useState<Record<string, number>>({});
  const [completedMedal, setCompletedMedal] = useState<'gold' | 'silver' | 'bronze' | null>(null);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  const challenge =
    SPEEDRUN_CHALLENGES.find((c) => c.id === selectedChallengeId) || SPEEDRUN_CHALLENGES[0];

  // Load personal bests from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('wirecraft_speedrun_bests');
      if (stored) {
        try {
          setPersonalBests(JSON.parse(stored));
        } catch {
          // Ignore
        }
      }
    }
  }, []);

  // Timer loop
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - elapsedMs;
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Live assessment poll while running
  useEffect(() => {
    if (!isRunning) return;

    const res = challenge.validate(devices, links);
    if (res.passed) {
      setIsRunning(false);
      const totalSec = elapsedMs / 1000;

      let medal: 'gold' | 'silver' | 'bronze' = 'bronze';
      if (totalSec <= challenge.goldTime) medal = 'gold';
      else if (totalSec <= challenge.silverTime) medal = 'silver';

      setCompletedMedal(medal);
      audioEngine.playVictoryFanfare();

      // Update personal best
      const prevBest = personalBests[challenge.id];
      if (!prevBest || totalSec < prevBest) {
        const nextBests = { ...personalBests, [challenge.id]: totalSec };
        setPersonalBests(nextBests);
        if (typeof window !== 'undefined') {
          localStorage.setItem('wirecraft_speedrun_bests', JSON.stringify(nextBests));
        }
      }
    }
  }, [devices, links, isRunning, elapsedMs, challenge, personalBests]);

  const handleStartChallenge = () => {
    const topo = challenge.initialTopology();
    onLoadTopology(topo.devices, topo.links);
    setElapsedMs(0);
    setCompletedMedal(null);
    setIsRunning(true);
  };

  const handleResetChallenge = () => {
    setIsRunning(false);
    setElapsedMs(0);
    setCompletedMedal(null);
    const topo = challenge.initialTopology();
    onLoadTopology(topo.devices, topo.links);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths
      .toString()
      .padStart(2, '0')}`;
  };

  const handleShareResult = () => {
    const totalSec = (elapsedMs / 1000).toFixed(2);
    const medalEmoji = completedMedal === 'gold' ? '🥇' : completedMedal === 'silver' ? '🥈' : '🥉';
    const text = `🏆 WireCraft CCNA Speedrun Record!\nChallenge: ${challenge.title}\nTime: ${totalSec}s (${medalEmoji} ${completedMedal?.toUpperCase()})\nMaster networking on WireCraft!`;
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  if (!isOpen) return null;

  const currentValidation = challenge.validate(devices, links);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-5 py-2.5 bg-gradient-to-r from-amber-950/80 via-slate-950 to-slate-900 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">CCNA Speedrun Arena</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Timed Trials
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Test your muscle memory, CLI speed, and configuration precision against the clock!
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

        {/* 2-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Challenge Selector */}
          <div className="w-72 border-r border-slate-800 bg-slate-950/60 p-2.5 space-y-1.5 overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Select Challenge
            </div>

            {SPEEDRUN_CHALLENGES.map((c) => {
              const isSelected = c.id === challenge.id;
              const pb = personalBests[c.id];

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    if (isRunning) {
                      setIsRunning(false);
                      setElapsedMs(0);
                    }
                    setSelectedChallengeId(c.id);
                    setCompletedMedal(null);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-950/60 border-amber-400/80 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">{c.title}</span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      {pb ? `${pb.toFixed(1)}s` : '--'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{c.category}</div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Active Arena */}
          <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-y-auto custom-scrollbar bg-slate-900/60">
            {/* Stopwatch HUD Banner */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between mb-3.5 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Timer className={`w-5 h-5 ${isRunning ? 'animate-pulse text-amber-300' : ''}`} />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Live Split Stopwatch
                  </div>
                  <div className="text-2xl font-mono font-bold tracking-tight text-amber-300">
                    {formatTime(elapsedMs)}
                  </div>
                </div>
              </div>

              {/* Medals Threshold */}
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/30 text-amber-300">
                  <span>🥇 Gold:</span>
                  <strong>&le;{challenge.goldTime}s</strong>
                </div>
                <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700 text-slate-300">
                  <span>🥈 Silver:</span>
                  <strong>&le;{challenge.silverTime}s</strong>
                </div>
                <div className="flex items-center gap-1 bg-amber-900/30 px-2 py-1 rounded-lg border border-amber-800/40 text-amber-400/80">
                  <span>🥉 Bronze:</span>
                  <strong>&le;{challenge.bronzeTime}s</strong>
                </div>
              </div>
            </div>

            {/* Victory Splash Card */}
            {completedMedal && (
              <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-950 to-teal-950/80 border border-emerald-500/50 shadow-lg flex items-center justify-between animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">
                    {completedMedal === 'gold' ? '🥇' : completedMedal === 'silver' ? '🥈' : '🥉'}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-emerald-300">
                      Speedrun Record Completed in {(elapsedMs / 1000).toFixed(2)}s!
                    </div>
                    <div className="text-xs text-emerald-400/80">
                      Awarded {completedMedal.toUpperCase()} Medal! Configuration 100% verified.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShareResult}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedShare ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedShare ? 'Copied!' : 'Share Record'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Challenge Info */}
            <div className="mb-4">
              <h2 className="text-base font-bold text-white">{challenge.title}</h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{challenge.description}</p>
            </div>

            {/* Objectives Checklist */}
            <div className="flex-1 space-y-2 mb-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Real-Time Objectives Verification
              </div>

              {currentValidation.completedGoals.map((g, idx) => (
                <div
                  key={`done_${idx}`}
                  className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{g}</span>
                </div>
              ))}

              {currentValidation.remainingGoals.map((g, idx) => (
                <div
                  key={`rem_${idx}`}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2 text-xs text-slate-300"
                >
                  <Clock className="w-4 h-4 text-amber-400/80 shrink-0" />
                  <span>{g}</span>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Personal Best:{' '}
                <strong className="text-amber-400 font-mono">
                  {personalBests[challenge.id] ? `${personalBests[challenge.id].toFixed(2)}s` : 'None yet'}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetChallenge}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Topology</span>
                </button>

                <button
                  onClick={handleStartChallenge}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isRunning ? 'Restart Sprint' : 'Start Speedrun'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
