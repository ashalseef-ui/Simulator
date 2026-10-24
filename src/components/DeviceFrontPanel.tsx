import React from 'react';
import { Device, DeviceType } from '../types/network';

interface DeviceFrontPanelProps {
  type: DeviceType;
  mode?: 'thumbnail' | 'compact' | 'full';
  device?: Device;
  onPortClick?: (portName: string) => void;
  selectedPortName?: string | null;
  animated?: boolean;
}

/**
 * Realistic Front Panel Component for Enterprise Networking Equipment
 * Supports:
 * - 'compact' / 'thumbnail': High-fidelity mini rack faceplate for canvas cards & drawer thumbnails
 * - 'full': Full-scale realistic 1U/2U physical rack unit front panel for physical view inspection
 */
export const DeviceFrontPanel: React.FC<DeviceFrontPanelProps> = ({
  type,
  mode = 'compact',
  device,
  onPortClick,
  selectedPortName,
  animated = true,
}) => {
  // Helper to check interface status
  const getPortStatus = (portName: string): { isUp: boolean; hasCable: boolean } => {
    if (!device) return { isUp: true, hasCable: false };
    const iface = device.config.interfaces[portName];
    const isUp = iface ? iface.status === 'up' : false;
    return { isUp, hasCable: !!iface };
  };

  // -------------------------------------------------------------------------
  // COMPACT / THUMBNAIL RENDERER (Canvas Card & Drawer Thumbnails)
  // -------------------------------------------------------------------------
  if (mode === 'thumbnail' || mode === 'compact') {
    return (
      <div className="w-full flex items-center justify-center select-none pointer-events-none">
        {renderCompactFrontPanel(type, animated)}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // FULL PHYSICAL VIEW RENDERER (Physical Inspector Tab)
  // -------------------------------------------------------------------------
  return (
    <div className="w-full select-none flex flex-col items-center">
      {renderFullFrontPanel(type, device, onPortClick, selectedPortName, getPortStatus)}
    </div>
  );
};

// =========================================================================
// 1. COMPACT FRONT PANEL GRAPHICS
// =========================================================================
function renderCompactFrontPanel(type: DeviceType, animated: boolean = true) {
  const pulseClass = animated ? 'animate-pulse' : '';
  const pingClass = animated ? 'animate-ping' : '';

  switch (type) {
    // ROUTERS
    case 'router':
    case 'router4331':
    case 'router1941':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border border-slate-600/80 shadow-md p-1 flex flex-col justify-between relative overflow-hidden">
          {/* Top bezel line & screws */}
          <div className="flex items-center justify-between text-[6px] font-mono text-slate-400 leading-none">
            <span className="text-[5px] text-sky-400 font-bold tracking-tighter">
              {type === 'router4331' ? 'CISCO 4331' : type === 'router1941' ? 'CISCO 1941' : 'CISCO 2911'}
            </span>
            <div className="flex gap-0.5 items-center">
              <span className={`w-1 h-1 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 ${pulseClass}`} />
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
            </div>
          </div>
          {/* Port array and HWIC module cover */}
          <div className="flex items-center justify-between gap-1">
            {/* HWIC Bay */}
            <div className="h-3 w-5 bg-slate-950 border border-slate-700 rounded-[1px] flex items-center justify-center">
              <span className="text-[4px] text-slate-500 font-mono">HWIC</span>
            </div>
            {/* 3x Gigabit Ports with LEDs */}
            <div className="flex gap-0.5 items-center">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-0.5 h-0.5 rounded-full bg-emerald-400 mb-[1px]" />
                  <div className="w-2 h-2.5 bg-slate-950 border border-slate-700 rounded-[1px]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'juniper_vsrx':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-emerald-950 via-slate-900 to-black border border-emerald-500/40 shadow-md p-1 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-[6px] font-mono leading-none">
            <span className="text-[5px] text-emerald-400 font-bold tracking-tighter">JUNIPER vSRX</span>
            <span className={`w-1 h-1 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 ${pulseClass}`} />
          </div>
          <div className="flex gap-0.5 items-center justify-end">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-2 h-2.5 bg-slate-950 border border-emerald-800 rounded-[1px] flex flex-col items-center justify-center">
                <div className="w-0.5 h-0.5 rounded-full bg-emerald-400 mb-[1px]" />
                <div className="w-1 h-0.5 bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      );

    case 'linux_router':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-amber-950/60 via-slate-900 to-black border border-amber-500/40 shadow-md p-1 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-[6px] font-mono leading-none">
            <span className="text-[5px] text-amber-400 font-bold tracking-tighter">LINUX / VyOS</span>
            <span className={`w-1 h-1 rounded-full bg-amber-400 ${pulseClass}`} />
          </div>
          <div className="flex gap-0.5 items-center justify-end">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-2 h-2.5 bg-slate-950 border border-slate-700 rounded-[1px] flex items-center justify-center">
                <div className="w-0.5 h-0.5 rounded-full bg-amber-400" />
              </div>
            ))}
          </div>
        </div>
      );

    case 'mikrotik_router':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border border-rose-500/50 shadow-md p-1 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-[6px] font-mono leading-none text-slate-800 font-bold">
            <span className="text-[5px] text-rose-700 font-bold tracking-tighter">MikroTik CCR</span>
            <span className={`w-1 h-1 rounded-full bg-rose-500 ${pulseClass}`} />
          </div>
          <div className="flex gap-0.5 items-center justify-between">
            <div className="w-4 h-2 bg-slate-900 border border-slate-700 rounded-[0.5px] flex items-center justify-center">
              <span className="text-[3px] text-sky-400 font-mono">LCD</span>
            </div>
            <div className="flex gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="w-1.5 h-2 bg-slate-950 border border-slate-700 rounded-[0.5px] flex items-center justify-center">
                  <div className="w-0.5 h-0.5 rounded-full bg-emerald-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'arista_7050':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-indigo-950 via-slate-900 to-black border border-indigo-500/50 shadow-md p-1 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-[6px] font-mono leading-none">
            <span className="text-[5px] text-indigo-400 font-bold tracking-tighter">ARISTA 7050X</span>
            <span className={`w-1 h-1 rounded-full bg-indigo-400 ${pulseClass}`} />
          </div>
          <div className="flex gap-0.5 items-center justify-end">
            <div className="grid grid-cols-4 gap-0.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="w-1.5 h-1 bg-slate-950 border border-indigo-900 rounded-[0.5px]" />
              ))}
            </div>
          </div>
        </div>
      );

    case 'juniper_ex':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-slate-800 via-slate-900 to-black border border-emerald-500/40 shadow-md p-1 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-[6px] font-mono leading-none">
            <span className="text-[5px] text-emerald-400 font-bold tracking-tighter">JUNIPER EX4300</span>
            <span className={`w-1 h-1 rounded-full bg-emerald-400 ${pulseClass}`} />
          </div>
          <div className="grid grid-cols-6 gap-0.5 mt-0.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 bg-slate-950 border border-slate-700 rounded-[0.5px] flex items-center justify-center">
                <div className="w-0.5 h-0.5 rounded-full bg-emerald-400" />
              </div>
            ))}
          </div>
        </div>
      );

    // SWITCHES
    case 'switch':
    case 'switch3560':
    case 'l3switch':
    case 'nexus9000':
      const isL3 = type === 'l3switch' || type === 'switch3560';
      const isNexus = type === 'nexus9000';
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-slate-800 via-slate-900 to-black border border-slate-700 shadow-md p-1 flex flex-col justify-between relative overflow-hidden">
          {/* Top bezel */}
          <div className="flex items-center justify-between text-[6px] font-mono leading-none">
            <span className={`text-[5px] font-extrabold tracking-tighter ${isNexus ? 'text-cyan-400' : isL3 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isNexus ? 'NEXUS 9K' : isL3 ? 'CAT 3650' : 'CAT 2960'}
            </span>
            <div className="flex gap-0.5 items-center">
              <span className="w-1 h-1 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              <span className={`w-1 h-1 rounded-full bg-emerald-400 ${pingClass}`} />
            </div>
          </div>
          {/* High-density 24-port switch bank */}
          <div className="flex items-center justify-between gap-0.5 mt-0.5">
            <div className="flex-1 grid grid-cols-6 gap-0.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-slate-950 border border-slate-700/80 rounded-[0.5px] flex items-center justify-center">
                  <div className={`w-0.5 h-0.5 rounded-full ${i % 3 === 0 ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                </div>
              ))}
            </div>
            {/* 2x Gigabit Uplink SFP Cages */}
            <div className="flex flex-col gap-0.5 pl-0.5 border-l border-slate-800">
              <div className="w-2 h-1.5 bg-slate-950 border border-amber-500/60 rounded-[0.5px]" />
              <div className="w-2 h-1.5 bg-slate-950 border border-amber-500/60 rounded-[0.5px]" />
            </div>
          </div>
        </div>
      );

    // FIREWALLS
    case 'firewall':
    case 'firepower':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-slate-900 via-neutral-900 to-black border border-rose-500/40 shadow-md p-1 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-[6px] font-mono leading-none">
            <span className="text-[5px] text-rose-400 font-bold tracking-tighter">
              {type === 'firepower' ? 'FTD 1010' : 'ASA 5506-X'}
            </span>
            <div className="flex gap-0.5 items-center">
              <span className="w-1 h-1 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {/* Yellow Management Port */}
            <div className="w-2.5 h-2.5 bg-slate-950 border border-amber-400 rounded-[1px] flex items-center justify-center">
              <div className="w-1 h-1 bg-amber-400/80 rounded-full" />
            </div>
            {/* Gigabit Interface Array */}
            <div className="flex gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="w-2 h-2.5 bg-slate-950 border border-slate-700 rounded-[1px] flex flex-col items-center justify-center">
                  <div className="w-0.5 h-0.5 rounded-full bg-emerald-400 mb-[1px]" />
                  <div className="w-1 h-0.5 bg-slate-800" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    // WIRELESS & MOBILITY
    case 'wlc':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-slate-800 to-slate-950 border border-amber-500/40 p-1 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[5px] font-mono text-amber-400 font-bold">
            <span>WLC 3504</span>
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
          </div>
          <div className="flex gap-0.5 items-center justify-end">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-2 h-2.5 bg-slate-950 border border-slate-700 rounded-[1px] flex items-center justify-center">
                <div className="w-0.5 h-0.5 rounded-full bg-emerald-400" />
              </div>
            ))}
          </div>
        </div>
      );

    case 'ap':
      return (
        <div className="w-12 h-8 rounded-full bg-gradient-to-b from-slate-100 to-slate-300 border border-slate-400/80 shadow-md flex items-center justify-center relative">
          <div className="w-5 h-5 rounded-full border border-sky-400/80 flex items-center justify-center bg-slate-100">
            <div className={`w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 ${pulseClass}`} />
          </div>
          <span className="absolute bottom-0.5 text-[5px] font-mono text-slate-600 font-bold">AP 3702</span>
        </div>
      );

    case 'home_router':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-sky-950 via-slate-900 to-black border border-sky-600/60 p-1 flex flex-col justify-between relative">
          {/* Antennas */}
          <div className="absolute -top-1.5 left-1 w-0.5 h-2 bg-slate-400 rounded-full" />
          <div className="absolute -top-1.5 right-1 w-0.5 h-2 bg-slate-400 rounded-full" />
          <div className="flex items-center justify-between text-[5px] font-mono text-sky-300 font-bold">
            <span>SOHO GW</span>
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              <span className="w-1 h-1 rounded-full bg-sky-400" />
            </div>
          </div>
          <div className="flex gap-0.5 items-center justify-center">
            <div className="w-2 h-2 bg-amber-500/40 border border-amber-500 rounded-[1px]" />
            <div className="w-2 h-2 bg-sky-500/40 border border-sky-500 rounded-[1px]" />
            <div className="w-2 h-2 bg-sky-500/40 border border-sky-500 rounded-[1px]" />
            <div className="w-2 h-2 bg-sky-500/40 border border-sky-500 rounded-[1px]" />
          </div>
        </div>
      );

    // WAN & CLOUD
    case 'cloud':
    case 'mpls_cloud':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-sky-950 via-slate-900 to-black border border-sky-400/50 p-1 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[5px] font-mono text-sky-400 font-bold">
            <span>{type === 'mpls_cloud' ? 'MPLS WAN' : 'ISP CLOUD'}</span>
            <span className={`w-1 h-1 rounded-full bg-cyan-400 ${pulseClass}`} />
          </div>
          <div className="flex items-center justify-around">
            <div className="w-2.5 h-2 bg-cyan-950 border border-cyan-400 rounded-[1px]" />
            <div className="w-2.5 h-2 bg-cyan-950 border border-cyan-400 rounded-[1px]" />
            <div className="w-2.5 h-2 bg-pink-950 border border-pink-400 rounded-[1px]" />
          </div>
        </div>
      );

    case 'modem':
      return (
        <div className="w-6 h-8 rounded-sm bg-gradient-to-b from-slate-800 to-black border border-slate-600 p-0.5 flex flex-col justify-between items-center">
          <div className="w-full flex flex-col items-center gap-0.5 mt-0.5">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            <span className={`w-1 h-1 rounded-full bg-cyan-400 ${pulseClass}`} />
          </div>
          <span className="text-[4px] font-mono text-slate-400">DOCSIS</span>
        </div>
      );

    // END DEVICES
    case 'pc':
      return (
        <div className="w-7 h-8 rounded-sm bg-gradient-to-b from-slate-800 via-slate-900 to-black border border-slate-600 p-0.5 flex flex-col justify-between">
          <div className="w-full h-1.5 bg-slate-950 border border-slate-700 rounded-[1px]" />
          <div className="flex items-center justify-between px-0.5">
            <span className="w-1 h-1 rounded-full bg-sky-400 shadow-sm shadow-sky-400" />
            <div className="w-1 h-0.5 bg-slate-700" />
          </div>
          <div className="w-full h-2 bg-slate-950/80 rounded-[1px] flex items-center justify-center">
            <div className="w-3 h-1 bg-slate-800 border-t border-slate-700" />
          </div>
        </div>
      );

    case 'laptop':
      return (
        <div className="w-10 h-7 flex flex-col items-center justify-center">
          {/* Screen */}
          <div className="w-8 h-5 rounded-t-sm bg-slate-900 border border-slate-600 p-0.5 flex items-center justify-center">
            <div className="w-full h-full bg-sky-950/60 border border-sky-400/40 rounded-[1px]" />
          </div>
          {/* Base */}
          <div className="w-10 h-1 bg-slate-700 rounded-b-sm border-t border-slate-500 shadow-md" />
        </div>
      );

    case 'server':
      return (
        <div className="w-16 h-7 rounded-sm bg-gradient-to-b from-slate-800 via-slate-900 to-black border border-purple-500/40 p-1 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[5px] font-mono text-purple-300 font-bold">
            <span>UCS SERVER</span>
            <span className={`w-1 h-1 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 ${pulseClass}`} />
          </div>
          {/* Dual SAS Drive Caddies */}
          <div className="flex gap-1 items-center">
            <div className="flex-1 h-2.5 bg-slate-950 border border-slate-700 rounded-[1px] flex items-center px-0.5 justify-between">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              <div className="w-2 h-0.5 bg-slate-700" />
            </div>
            <div className="flex-1 h-2.5 bg-slate-950 border border-slate-700 rounded-[1px] flex items-center px-0.5 justify-between">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              <div className="w-2 h-0.5 bg-slate-700" />
            </div>
          </div>
        </div>
      );

    case 'ipphone':
      return (
        <div className="w-9 h-8 rounded-sm bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-600 p-0.5 flex flex-col justify-between items-center">
          {/* Screen */}
          <div className="w-7 h-3 bg-emerald-950 border border-emerald-600/60 rounded-[1px] flex items-center justify-center">
            <span className="text-[4px] text-emerald-400 font-mono">1001</span>
          </div>
          {/* Keypad dots */}
          <div className="w-5 grid grid-cols-3 gap-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-1 h-0.5 bg-slate-600 rounded-[0.5px]" />
            ))}
          </div>
        </div>
      );

    case 'printer':
      return (
        <div className="w-10 h-7 rounded-sm bg-gradient-to-b from-slate-200 to-slate-400 border border-slate-500 p-0.5 flex flex-col justify-between items-center">
          <div className="w-6 h-1 bg-slate-800 rounded-[0.5px]" />
          <div className="w-7 h-2 bg-slate-300 border border-slate-400 flex items-center justify-between px-0.5">
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            <div className="w-2 h-0.5 bg-slate-600" />
          </div>
          <div className="w-8 h-1 bg-slate-400 border-t border-slate-500" />
        </div>
      );

    default:
      return null;
  }
}

// =========================================================================
// 2. FULL DETAILED PHYSICAL FRONT PANEL (For Physical View Inspection)
// =========================================================================
function renderFullFrontPanel(
  type: DeviceType,
  device: Device | undefined,
  onPortClick: ((portName: string) => void) | undefined,
  selectedPortName: string | null | undefined,
  getPortStatus: (portName: string) => { isUp: boolean; hasCable: boolean }
) {
  const isRouter = type === 'router' || type === 'router4331' || type === 'router1941' || type === 'juniper_vsrx' || type === 'linux_router' || type === 'mikrotik_router';
  const isSwitch = type === 'switch' || type === 'switch2960_48' || type === 'switch3560' || type === 'switch3850' || type === 'switch9300' || type === 'l3switch' || type === 'nexus9000' || type === 'arista_7050' || type === 'juniper_ex';

  return (
    <div className="w-full max-w-4xl bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-2xl flex flex-col gap-4">
      {/* 19" Enterprise Rack Chassis Container */}
      <div className="w-full rounded-lg bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-2 border-slate-700 shadow-2xl overflow-hidden relative p-3 flex items-center justify-between">
        {/* Left Rack Mount Ear with Screw Holes */}
        <div className="w-7 h-24 bg-gradient-to-r from-slate-700 to-slate-800 border-r border-slate-600 flex flex-col justify-between items-center py-2 shrink-0 rounded-l">
          <div className="w-3 h-3 rounded-full bg-slate-950 border border-slate-600 flex items-center justify-center">
            <div className="w-2 h-0.5 bg-slate-500 rotate-45" />
          </div>
          <span className="text-[8px] font-mono font-bold text-slate-400 rotate-90 uppercase tracking-widest">
            1U
          </span>
          <div className="w-3 h-3 rounded-full bg-slate-950 border border-slate-600 flex items-center justify-center">
            <div className="w-2 h-0.5 bg-slate-500 -rotate-45" />
          </div>
        </div>

        {/* Center: Main Device Faceplate */}
        <div className="flex-1 px-4 flex items-center justify-between gap-6 overflow-x-auto custom-scrollbar">
          {/* Left Brand Badge & Diagnostic Status LED Bank */}
          <div className="flex flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-sky-500/20 border border-sky-400/40 flex items-center justify-center">
                <span className="text-[10px] font-black text-sky-400">N</span>
              </div>
              <div>
                <div className="text-xs font-black tracking-tight text-white uppercase">
                  {type === 'router'
                    ? '2911 ISR (Emulated)'
                    : type === 'router4331'
                    ? '4331 ISR (Emulated)'
                    : type === 'router1941'
                    ? '1941 ISR (Emulated)'
                    : type === 'switch'
                    ? 'Catalyst 2960-24TT (Emulated)'
                    : type === 'switch3560'
                    ? 'Catalyst 3560-24TS (Emulated)'
                    : type === 'l3switch'
                    ? 'Catalyst 3650-24PS (Emulated)'
                    : type === 'nexus9000'
                    ? 'Nexus 9300-EX (Emulated)'
                    : type === 'firewall'
                    ? 'ASA 5506-X (Emulated)'
                    : type === 'firepower'
                    ? 'Firepower 1010 (Emulated)'
                    : `${type.toUpperCase()} UNIT`}
                </div>
                <div className="text-[9px] font-mono text-slate-400">
                  {isRouter ? 'Modular Integrated Services Router (Simulation)' : isSwitch ? 'Enterprise Managed Switch (Simulation)' : 'Security Appliance (Simulation)'}
                </div>
              </div>
            </div>

            {/* Diagnostic LED Bank */}
            <div className="flex items-center gap-3 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-mono text-slate-500 font-bold">PWR</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-mono text-slate-500 font-bold">SYS</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-mono text-slate-500 font-bold">ACT</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              {isSwitch && (
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-mono text-slate-500 font-bold">STAT</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
              )}
            </div>
          </div>

          {/* Center-Right: Interactive Realistic RJ-45 & SFP Port Matrix */}
          <div className="flex items-center gap-4 bg-slate-950/90 p-2.5 rounded-lg border border-slate-800">
            {device &&
              Object.values(device.config.interfaces).map((iface) => {
                const status = getPortStatus(iface.name);
                const isSelected = selectedPortName === iface.name;
                const isSerial = iface.name.toLowerCase().startsWith('se');

                return (
                  <button
                    key={iface.name}
                    onClick={() => onPortClick && onPortClick(iface.name)}
                    className={`group flex flex-col items-center gap-1 p-1 rounded-md transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/20 ring-1 ring-sky-400 border-sky-400'
                        : 'hover:bg-slate-800/80 border border-transparent'
                    }`}
                  >
                    {/* Link Activity LED */}
                    <div className="flex items-center gap-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          status.isUp
                            ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                            : 'bg-rose-500'
                        }`}
                      />
                    </div>

                    {/* Jack Receptacle Graphic */}
                    {isSerial ? (
                      /* Serial V.35 / Smart Serial 26-pin socket */
                      <div className="w-7 h-6 bg-slate-900 border border-pink-500/60 rounded flex flex-col items-center justify-center p-0.5">
                        <div className="w-5 h-3 bg-pink-950/80 border border-pink-400/40 rounded-[1px] flex items-center justify-around">
                          <span className="w-0.5 h-0.5 bg-pink-300 rounded-full" />
                          <span className="w-0.5 h-0.5 bg-pink-300 rounded-full" />
                        </div>
                      </div>
                    ) : (
                      /* RJ-45 8P8C Modular Jack with Gold Pins */
                      <div className="w-7 h-7 bg-slate-900 border border-slate-700 group-hover:border-slate-500 rounded flex flex-col items-center justify-between p-0.5 relative shadow-inner">
                        {/* Retention Tab Notch */}
                        <div className="w-2.5 h-1 bg-slate-950 border-b border-slate-700 rounded-t-[1px]" />
                        {/* 8 Gold Pin Contacts */}
                        <div className="flex gap-[1px]">
                          {Array.from({ length: 8 }).map((_, p) => (
                            <div key={p} className="w-[1px] h-2 bg-amber-400/90 rounded-full" />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Port Label */}
                    <span className="text-[8px] font-mono text-slate-400 group-hover:text-slate-200">
                      {iface.name}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Right: AC Power Rocker Switch & Fan Vents */}
          <div className="flex flex-col items-center gap-2 pl-2 border-l border-slate-800 shrink-0">
            {/* Ventilation Slats */}
            <div className="flex flex-col gap-0.5 w-8">
              {Array.from({ length: 5 }).map((_, v) => (
                <div key={v} className="w-full h-0.5 bg-slate-950 border-b border-slate-800" />
              ))}
            </div>
            {/* Rocker Switch */}
            <div className="w-5 h-7 bg-slate-950 border border-slate-700 rounded flex flex-col items-center justify-between p-0.5">
              <span className="text-[6px] font-mono text-slate-500 font-bold">I</span>
              <div className="w-3 h-3 bg-emerald-500/80 rounded-sm shadow-sm shadow-emerald-400" />
              <span className="text-[6px] font-mono text-slate-500 font-bold">O</span>
            </div>
          </div>
        </div>

        {/* Right Rack Mount Ear with Screw Holes */}
        <div className="w-7 h-24 bg-gradient-to-l from-slate-700 to-slate-800 border-l border-slate-600 flex flex-col justify-between items-center py-2 shrink-0 rounded-r">
          <div className="w-3 h-3 rounded-full bg-slate-950 border border-slate-600 flex items-center justify-center">
            <div className="w-2 h-0.5 bg-slate-500 rotate-45" />
          </div>
          <span className="text-[8px] font-mono font-bold text-slate-400 -rotate-90 uppercase tracking-widest">
            19"
          </span>
          <div className="w-3 h-3 rounded-full bg-slate-950 border border-slate-600 flex items-center justify-center">
            <div className="w-2 h-0.5 bg-slate-500 -rotate-45" />
          </div>
        </div>
      </div>

      {/* Port Quick Inspection Bar */}
      {selectedPortName && device && device.config.interfaces[selectedPortName] && (
        <div className="w-full bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white font-mono">{selectedPortName}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              MAC: {device.config.interfaces[selectedPortName].mac}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              Speed: {device.config.interfaces[selectedPortName].speed} Mbps
            </span>
            {device.config.interfaces[selectedPortName].ip && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                IP: {device.config.interfaces[selectedPortName].ip}
              </span>
            )}
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              device.config.interfaces[selectedPortName].status === 'up'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {device.config.interfaces[selectedPortName].status === 'up' ? 'Port Connected & Up' : 'Port Down / No Carrier'}
          </span>
        </div>
      )}
    </div>
  );
}
