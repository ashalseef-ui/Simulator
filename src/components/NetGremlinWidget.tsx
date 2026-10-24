import React, { useState, useEffect, useRef } from 'react';
import { useDraggable } from '../hooks/useDraggable';
import { Device, Link, DeviceConfig } from '../types/network';
import { audioEngine } from '../utils/audioEffects';
import {
  Flame,
  Zap,
  RotateCcw,
  ShieldAlert,
  CheckCircle,
  Eye,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface NetGremlinWidgetProps {
  devices: Device[];
  links: Link[];
  onUpdateDeviceConfig: (deviceId: string, config: DeviceConfig) => void;
  onToggleLinkState?: (linkId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface MischiefRecord {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  targetDeviceId: string;
  targetDeviceName: string;
  tamperType: 'interface_down' | 'vlan_scramble' | 'gateway_offset' | 'duplex_mismatch';
  resolved: boolean;
  originalValue: any;
}

export const NetGremlinWidget: React.FC<NetGremlinWidgetProps> = ({
  devices,
  links,
  onUpdateDeviceConfig,
  isOpen,
  onClose,
}) => {
  const { position, handleMouseDown } = useDraggable();
  const [isActive, setIsActive] = useState<boolean>(false);
  const [mischiefHistory, setMischiefHistory] = useState<MischiefRecord[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState<string>(
    "Hehehe! I am the Net-Gremlin. Let me loose in your topology and see if your CCNA skills can catch my pranks!"
  );
  const [gremlinMood, setGremlinMood] = useState<'idle' | 'mischief' | 'busted'>('idle');
  const [bustedCount, setBustedCount] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // Trigger a mischievous fault injection
  const triggerMischief = () => {
    if (devices.length === 0) {
      setCurrentSpeech("Hey! There aren't any devices on the canvas for me to tamper with. Place some routers or switches first!");
      return;
    }

    const availableDevices = devices.filter((d) => d.type !== 'cloud' && d.type !== 'mpls_cloud');
    if (availableDevices.length === 0) return;

    const targetDev = availableDevices[Math.floor(Math.random() * availableDevices.length)];
    const ifaceNames = Object.keys(targetDev.config.interfaces || {});
    if (ifaceNames.length === 0) return;

    const targetIfaceName = ifaceNames[Math.floor(Math.random() * ifaceNames.length)];
    const iface = targetDev.config.interfaces[targetIfaceName];

    const tamperTypes: ('interface_down' | 'vlan_scramble' | 'gateway_offset' | 'duplex_mismatch')[] = [
      'interface_down',
      'vlan_scramble',
      'gateway_offset',
      'duplex_mismatch',
    ];
    const pickedType = tamperTypes[Math.floor(Math.random() * tamperTypes.length)];

    let record: MischiefRecord | null = null;
    const now = new Date().toLocaleTimeString();

    if (pickedType === 'interface_down') {
      const origStatus = iface.status;
      const updatedIfaces = {
        ...targetDev.config.interfaces,
        [targetIfaceName]: { ...iface, status: 'down' as const },
      };
      onUpdateDeviceConfig(targetDev.id, {
        ...targetDev.config,
        interfaces: updatedIfaces,
      });

      record = {
        id: `gremlin_${Date.now()}`,
        timestamp: now,
        title: `Interface Shut Down`,
        description: `I administratively shut down port ${targetIfaceName} on ${targetDev.name}!`,
        targetDeviceId: targetDev.id,
        targetDeviceName: targetDev.name,
        tamperType: 'interface_down',
        resolved: false,
        originalValue: origStatus,
      };
      setCurrentSpeech(`Mwahaha! I stealthily pulled the plug on ${targetIfaceName} on ${targetDev.name}! Can you bring it back up?`);
    } else if (pickedType === 'vlan_scramble') {
      const origVlan = iface.accessVlan || 1;
      const bogusVlan = origVlan === 10 ? 99 : 666;
      const updatedIfaces = {
        ...targetDev.config.interfaces,
        [targetIfaceName]: { ...iface, accessVlan: bogusVlan },
      };
      onUpdateDeviceConfig(targetDev.id, {
        ...targetDev.config,
        interfaces: updatedIfaces,
      });

      record = {
        id: `gremlin_${Date.now()}`,
        timestamp: now,
        title: `VLAN Swapped`,
        description: `I moved port ${targetIfaceName} on ${targetDev.name} from VLAN ${origVlan} to VLAN ${bogusVlan}!`,
        targetDeviceId: targetDev.id,
        targetDeviceName: targetDev.name,
        tamperType: 'vlan_scramble',
        resolved: false,
        originalValue: origVlan,
      };
      setCurrentSpeech(`Hehe! Port ${targetIfaceName} on ${targetDev.name} is now on rogue VLAN ${bogusVlan}! Broadcast domain fractured!`);
    } else if (pickedType === 'gateway_offset') {
      const origGw = targetDev.config.defaultGateway || '192.168.1.1';
      // Invert last octet
      const parts = origGw.split('.');
      const bogusGw = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.${(parseInt(parts[3], 10) + 120) % 254 + 1}` : '10.254.254.254';

      onUpdateDeviceConfig(targetDev.id, {
        ...targetDev.config,
        defaultGateway: bogusGw,
      });

      record = {
        id: `gremlin_${Date.now()}`,
        timestamp: now,
        title: `Default Gateway Hijacked`,
        description: `I pointed the default gateway of ${targetDev.name} to bogus IP ${bogusGw}!`,
        targetDeviceId: targetDev.id,
        targetDeviceName: targetDev.name,
        tamperType: 'gateway_offset',
        resolved: false,
        originalValue: origGw,
      };
      setCurrentSpeech(`Snicker! Changed the default gateway on ${targetDev.name} to ${bogusGw}! Good luck reaching outside the subnet!`);
    } else {
      // Duplex Mismatch (Half Duplex)
      const origDuplex = iface.duplex || 'auto';
      const bogusDuplex: 'half' = 'half';
      const updatedIfaces = {
        ...targetDev.config.interfaces,
        [targetIfaceName]: { ...iface, duplex: bogusDuplex },
      };
      onUpdateDeviceConfig(targetDev.id, {
        ...targetDev.config,
        interfaces: updatedIfaces,
      });

      record = {
        id: `gremlin_${Date.now()}`,
        timestamp: now,
        title: `Duplex Mismatch (Half-Duplex)`,
        description: `I forced port ${targetIfaceName} (${targetDev.name}) into Half-Duplex! Late collisions imminent!`,
        targetDeviceId: targetDev.id,
        targetDeviceName: targetDev.name,
        tamperType: 'duplex_mismatch',
        resolved: false,
        originalValue: origDuplex,
      };
      setCurrentSpeech(`Giggles! Forced port ${targetIfaceName} into Half-Duplex! Late collisions and CRC errors incoming!`);
    }

    if (record) {
      setMischiefHistory((prev) => [record!, ...prev.slice(0, 19)]);
      setGremlinMood('mischief');
      audioEngine.playGremlinChirp();

      setTimeout(() => {
        setGremlinMood('idle');
      }, 4000);
    }
  };

  // Automated background prank timer when active
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        triggerMischief();
      }, 45000); // Trigger every 45s
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, devices]);

  // Check if player has resolved an active mischief
  const checkResolution = (rec: MischiefRecord) => {
    const dev = devices.find((d) => d.id === rec.targetDeviceId);
    if (!dev) return false;

    if (rec.tamperType === 'interface_down') {
      const ifaces = dev.config.interfaces || {};
      for (const iface of Object.values(ifaces)) {
        if (iface.status === 'up') return true;
      }
    } else if (rec.tamperType === 'vlan_scramble') {
      const ifaces = dev.config.interfaces || {};
      for (const iface of Object.values(ifaces)) {
        if (iface.accessVlan === rec.originalValue) return true;
      }
    } else if (rec.tamperType === 'gateway_offset') {
      if (dev.config.defaultGateway === rec.originalValue) return true;
    } else if (rec.tamperType === 'duplex_mismatch') {
      const ifaces = dev.config.interfaces || {};
      for (const iface of Object.values(ifaces)) {
        if ((iface.duplex || 'auto') === (rec.originalValue || 'auto') || iface.duplex === 'full') return true;
      }
    }
    return false;
  };

  const handleInspectPrank = (rec: MischiefRecord) => {
    const isNowFixed = checkResolution(rec);
    if (isNowFixed) {
      setMischiefHistory((prev) =>
        prev.map((m) => (m.id === rec.id ? { ...m, resolved: true } : m))
      );
      setBustedCount((c) => c + 1);
      setGremlinMood('busted');
      audioEngine.playVictoryFanfare();
      setCurrentSpeech(`NOOOOO! You caught and fixed my prank on ${rec.targetDeviceName}! You're too sharp for me!`);
    } else {
      setCurrentSpeech(`Nice try! My prank on ${rec.targetDeviceName} is still active! Check "${rec.title}" - ${rec.description}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      className="fixed bottom-14 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-slate-900/95 border border-amber-500/50 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col select-none animate-in fade-in slide-in-from-bottom-4 duration-200"
    >
      {/* Gremlin Header */}
      <div
        onMouseDown={handleMouseDown}
        className="p-3 bg-gradient-to-r from-amber-950/80 via-slate-950 to-slate-900 border-b border-amber-500/30 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg shadow-inner">
            {gremlinMood === 'mischief' ? '😈' : gremlinMood === 'busted' ? '😵' : '👹'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-amber-300">Chaos Net-Gremlin</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Sandbox Mode
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Live Network Fault Tamperer & CCNA Reflex Trainer
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => audioEngine.toggleMute()}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title={audioEngine.getMuted() ? 'Unmute Audio' : 'Mute Audio'}
          >
            {audioEngine.getMuted() ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Gremlin Speech & Mood Card */}
      <div className="p-3 bg-amber-950/20 border-b border-slate-800 flex items-start gap-3">
        <div className="text-3xl shrink-0 mt-1 select-none animate-bounce">
          {gremlinMood === 'mischief' ? '😈' : gremlinMood === 'busted' ? '💫' : '👾'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-amber-200 leading-snug bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/30 relative">
            {currentSpeech}
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
            <span>
              Busted Pranks: <strong className="text-emerald-400">{bustedCount}</strong>
            </span>
            <span>
              Active Status:{' '}
              <strong className={isActive ? 'text-amber-400' : 'text-slate-400'}>
                {isActive ? 'Patrolling Every 45s' : 'Asleep'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Control Actions */}
      <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2">
        <button
          onClick={() => {
            const next = !isActive;
            setIsActive(next);
            if (next) {
              setCurrentSpeech("I'm awake and stalking your cables! Expect random glitches every 45 seconds!");
              audioEngine.playGremlinChirp();
            } else {
              setCurrentSpeech("Aww, calling off the hunt? I'll take a nap in the patch panel.");
            }
          }}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
            isActive
              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>{isActive ? 'Put Gremlin to Sleep' : 'Unleash Gremlin 👹'}</span>
        </button>

        <button
          onClick={triggerMischief}
          className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
          title="Instantly inject a random network fault"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Strike Now</span>
        </button>
      </div>

      {/* Mischief History List */}
      <div className="p-3 flex-1 max-h-56 overflow-y-auto space-y-2 custom-scrollbar bg-slate-950/30">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
          <span>Prank Log</span>
          <span>{mischiefHistory.length} Recorded</span>
        </div>

        {mischiefHistory.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs italic">
            No pranks pulled yet. Click "Strike Now" or toggle "Unleash Gremlin"!
          </div>
        ) : (
          mischiefHistory.map((rec) => (
            <div
              key={rec.id}
              className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1 transition-all ${
                rec.resolved
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-900/80 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold">
                  {rec.resolved ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{rec.title}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{rec.timestamp}</span>
              </div>

              <div className="text-[11px] text-slate-400 leading-snug">{rec.description}</div>

              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800/60">
                <span className="text-[10px] text-slate-400">Target: {rec.targetDeviceName}</span>
                {!rec.resolved ? (
                  <button
                    onClick={() => handleInspectPrank(rec)}
                    className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-bold flex items-center gap-1 border border-sky-500/30 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    Verify Fix
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-400">Resolved & Busted!</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
