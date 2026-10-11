import React from 'react';
import {
  Flame,
  X,
  Play,
  RotateCcw,
  Clock,
  Award,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Sparkles,
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
    description: 'An upstream branch router has an incorrect OSPF wildcard mask preventing Area 0 adjacency from forming. Inspect OSPF config and fix the network statement.',
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
        networks: [{ network: '192.168.1.0', wildcard: '0.0.255.255', area: 0 }], // Faulty network statement
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
    faultInjector: (_devices) =>
      'OSPF Area 0 adjacency broken between R1-HQ and R2-Branch due to missing network statement on R2-Branch for subnet 10.0.0.0 0.0.0.3.',
    validator: (devices) => {
      const r2 = devices.find((d) => d.name === 'R2-Branch');
      const net = r2?.config.ospf?.networks.find(
        (n) => n.network === '10.0.0.0' || n.network === '0.0.0.0'
      );
      return !!(net && (net.wildcard === '0.0.0.3' || net.wildcard === '0.0.0.255'));
    },
    successMessage:
      'Successfully corrected OSPF network wildcard mask! Adjacency formed and routes synchronized across Area 0.',
  },
  {
    id: 'shutdown-trunk',
    title: 'Silenced Trunk Uplink',
    difficulty: 'Senior',
    description:
      'An accidental administrative wipe shut down the trunk uplink between Access Switch and Core Switch, and misconfigured the mode.',
    initialTopology: () => {
      const swCore = createDevice('switch', 'SW-Core', 350, 160);
      const swAcc = createDevice('switch', 'SW-Access', 550, 160);
      const pc1 = createDevice('pc', 'PC-Sales', 550, 360);

      swCore.config.interfaces['Gi0/1'].mode = 'trunk';
      swCore.config.interfaces['Gi0/1'].status = 'up';

      swAcc.config.interfaces['Gi0/1'].mode = 'access'; // Faulty mode
      swAcc.config.interfaces['Gi0/1'].status = 'down'; // Administratively shutdown
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
    faultInjector: (_devices) =>
      'Switch uplink port Gi0/1 on SW-Access is administratively down and set to access mode instead of trunk.',
    validator: (devices) => {
      const swAcc = devices.find((d) => d.name === 'SW-Access');
      const iface = swAcc?.config.interfaces['Gi0/1'];
      return !!(iface && iface.status === 'up' && iface.mode === 'trunk');
    },
    successMessage:
      'Trunk link re-enabled (`no shutdown`) and mode set back to `switchport mode trunk`! 802.1Q tagged traffic restored.',
  },
  {
    id: 'missing-gateway',
    title: 'Default Gateway Mismatch',
    difficulty: 'Junior',
    description:
      'Workstation clients cannot reach external subnets because their static IP default gateway was pointed to an unassigned IP.',
    initialTopology: () => {
      const r1 = createDevice('router', 'R1-Gateway', 300, 180);
      const sw1 = createDevice('switch', 'SW-Office', 500, 180);
      const pc1 = createDevice('pc', 'Client-PC', 500, 360);

      r1.config.interfaces['Gi0/0'].ip = '192.168.1.1';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r1.config.interfaces['Gi0/0'].status = 'up';

      pc1.config.interfaces['Fa0/0'].ip = '192.168.1.50';
      pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';
      pc1.config.defaultGateway = '192.168.1.254'; // Faulty gateway

      return {
        devices: [r1, sw1, pc1],
        links: [
          { id: 'l1', fromDevice: r1.id, fromPort: 'Gi0/0', toDevice: sw1.id, toPort: 'Gi0/1', cable: 'straight' },
          { id: 'l2', fromDevice: sw1.id, fromPort: 'Fa0/1', toDevice: pc1.id, toPort: 'Fa0/0', cable: 'straight' },
        ],
      };
    },
    faultInjector: (_devices) =>
      'Client-PC default gateway points to 192.168.1.254 instead of the actual router default gateway 192.168.1.1.',
    validator: (devices) => {
      const pc = devices.find((d) => d.name === 'Client-PC');
      return pc?.config.defaultGateway === '192.168.1.1';
    },
    successMessage:
      'Default gateway on Client-PC corrected to 192.168.1.1! Next-hop routing operational.',
  },
  {
    id: 'vlan-access-mismatch',
    title: 'VLAN Access Port Isolation',
    difficulty: 'Senior',
    description:
      'Finance workstation was plugged into port Fa0/2 which is assigned to the wrong VLAN (VLAN 20 instead of VLAN 10).',
    initialTopology: () => {
      const sw = createDevice('switch', 'SW-Finance', 450, 180);
      const pc1 = createDevice('pc', 'Finance-PC', 300, 360);
      const srv = createDevice('server', 'Finance-DB', 600, 360);

      sw.config.vlans = {
        1: { id: 1, name: 'default' },
        10: { id: 10, name: 'Finance' },
        20: { id: 20, name: 'Guest' },
      };
      sw.config.interfaces['Fa0/1'].accessVlan = 10;
      sw.config.interfaces['Fa0/2'].accessVlan = 20; // Faulty VLAN

      pc1.config.interfaces['Fa0/0'].ip = '10.10.10.50';
      pc1.config.interfaces['Fa0/0'].mask = '255.255.255.0';

      srv.config.interfaces['Fa0/0'].ip = '10.10.10.10';
      srv.config.interfaces['Fa0/0'].mask = '255.255.255.0';

      return {
        devices: [sw, pc1, srv],
        links: [
          { id: 'l1', fromDevice: sw.id, fromPort: 'Fa0/2', toDevice: pc1.id, toPort: 'Fa0/0', cable: 'straight' },
          { id: 'l2', fromDevice: sw.id, fromPort: 'Fa0/1', toDevice: srv.id, toPort: 'Fa0/0', cable: 'straight' },
        ],
      };
    },
    faultInjector: (_devices) =>
      'Finance-PC connected to SW-Finance port Fa0/2 is tagged in VLAN 20, isolating it from the Finance Server in VLAN 10.',
    validator: (devices) => {
      const sw = devices.find((d) => d.name === 'SW-Finance');
      return sw?.config.interfaces['Fa0/2']?.accessVlan === 10;
    },
    successMessage:
      'Port Fa0/2 reconfigured to `switchport access vlan 10`! Finance workstation can now communicate with Finance-DB.',
  },
  {
    id: 'static-route-blackhole',
    title: 'Static Route Next-Hop Blackhole',
    difficulty: 'TAC Architect',
    description:
      'Edge router R1 has a static route for branch subnet 192.168.20.0/24 pointing to an unreachable next-hop IP, blackholing all egress traffic.',
    initialTopology: () => {
      const r1 = createDevice('router', 'R1-Edge', 300, 180);
      const r2 = createDevice('router', 'R2-Branch', 600, 180);

      r1.config.interfaces['Gi0/0'].ip = '10.0.0.1';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.252';
      r1.config.interfaces['Gi0/0'].status = 'up';
      r1.config.routes = [
        {
          network: '192.168.20.0',
          mask: '255.255.255.0',
          nextHop: '10.0.0.9', // Non-existent blackhole!
        },
      ];

      r2.config.interfaces['Gi0/0'].ip = '10.0.0.2';
      r2.config.interfaces['Gi0/0'].mask = '255.255.255.252';
      r2.config.interfaces['Gi0/0'].status = 'up';
      r2.config.interfaces['Gi0/1'].ip = '192.168.20.1';
      r2.config.interfaces['Gi0/1'].mask = '255.255.255.0';
      r2.config.interfaces['Gi0/1'].status = 'up';

      return {
        devices: [r1, r2],
        links: [
          { id: 'l1', fromDevice: r1.id, fromPort: 'Gi0/0', toDevice: r2.id, toPort: 'Gi0/0', cable: 'straight' },
        ],
      };
    },
    faultInjector: (_devices) =>
      'R1-Edge route for 192.168.20.0/24 points to dead next-hop 10.0.0.9 instead of R2-Branch interface 10.0.0.2.',
    validator: (devices) => {
      const r1 = devices.find((d) => d.name === 'R1-Edge');
      const rt = r1?.config.routes.find((r) => r.network === '192.168.20.0');
      return rt?.nextHop === '10.0.0.2';
    },
    successMessage:
      'Static route next-hop updated to 10.0.0.2! Packets to 192.168.20.0/24 successfully route to R2-Branch.',
  },
];

export interface ChaosBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  activeChallenge: ChaosChallenge | null;
  timeLeft: number;
  isCompleted: boolean;
  scoreEarned: number;
  onStartChallenge: (challenge: ChaosChallenge) => void;
  onVerifyFix: () => void;
  onResetChallenge: () => void;
  onExitChallenge: () => void;
  feedbackMessage?: { type: 'success' | 'error'; text: string } | null;
}

export const ChaosBattleModal: React.FC<ChaosBattleModalProps> = ({
  isOpen,
  onClose,
  devices,
  activeChallenge,
  timeLeft,
  isCompleted,
  scoreEarned,
  onStartChallenge,
  onVerifyFix,
  onResetChallenge,
  onExitChallenge,
  feedbackMessage,
}) => {
  const [selectedChallenge, setSelectedChallenge] = React.useState<ChaosChallenge>(
    activeChallenge || CHAOS_CHALLENGES[0]
  );

  React.useEffect(() => {
    if (activeChallenge) {
      setSelectedChallenge(activeChallenge);
    }
  }, [activeChallenge]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/50 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
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
                  GAMIFIED CCNA OUTAGES
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Troubleshoot realistic enterprise faults under simulated SLA countdown.
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
          {feedbackMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
              }`}
            >
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {activeChallenge ? (
            <div className="space-y-5">
              {/* Active SLA Countdown Banner */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Clock className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">SLA Outage Countdown</div>
                    <div
                      className={`text-xl font-mono font-extrabold ${
                        timeLeft <= 60 ? 'text-red-400 animate-pulse' : 'text-amber-400'
                      }`}
                    >
                      {formatTime(timeLeft)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold">
                    {activeChallenge.title}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Difficulty:{' '}
                    <span className="text-amber-400 font-semibold">
                      {activeChallenge.difficulty}
                    </span>
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
                  {activeChallenge.faultInjector(devices)}
                </p>
                <p className="text-xs text-slate-400">{activeChallenge.description}</p>
              </div>

              {isCompleted ? (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/20">
                    <Award className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-emerald-300">
                    Incident Remediation Successful!
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    {activeChallenge.successMessage}
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-sm font-mono font-extrabold text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                    XP Score Earned: +{scoreEarned} PTS
                  </div>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      onClick={onExitChallenge}
                      className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer"
                    >
                      Choose Another Chaos Mission
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
                    >
                      Return to Canvas
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={onVerifyFix}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Verify Configuration Fix & Resolve Incident
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                    title="Close modal and troubleshoot on canvas"
                  >
                    Troubleshoot on Canvas
                  </button>
                  <button
                    onClick={onResetChallenge}
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
                      <p className="text-xs text-slate-400 line-clamp-2">{ch.description}</p>
                    </div>

                    <button
                      onClick={() => onStartChallenge(ch)}
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
