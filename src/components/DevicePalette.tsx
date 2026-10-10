import React, { useState, useEffect, useMemo } from 'react';
import { DeviceType, CableType } from '../types/network';
import { DEVICE_SPECS, DeviceSpec } from '../engine/deviceSpecs';
import { DeviceFrontPanel } from './DeviceFrontPanel';
import {
  Cable,
  Zap,
  Trash2,
  MousePointer,
  PlusCircle,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Check,
  Waypoints,
  Network,
  Shield,
  Wifi,
  Cloud,
  Monitor,
  Cpu,
} from 'lucide-react';

interface DevicePaletteProps {
  onAddDevice: (type: DeviceType) => void;
  activeCableType: CableType | null;
  onSelectCableType: (cable: CableType | null) => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
}

// -------------------------------------------------------------------------
// HARDWARE CATEGORIES
// -------------------------------------------------------------------------
type DeviceCategoryKey =
  | 'Routers'
  | 'Switches'
  | 'Security & Firewalls'
  | 'Wireless & Infrastructure'
  | 'WAN & Cloud'
  | 'End Devices';

interface DeviceCategoryConfig {
  key: DeviceCategoryKey;
  label: string;
  icon: React.ElementType;
  colorClass: string;
}

const DEVICE_CATEGORIES: DeviceCategoryConfig[] = [
  {
    key: 'Routers',
    label: 'Routers & Gateways',
    icon: Waypoints,
    colorClass: 'text-indigo-400',
  },
  {
    key: 'Switches',
    label: 'Switches & Data Center',
    icon: Network,
    colorClass: 'text-emerald-400',
  },
  {
    key: 'Security & Firewalls',
    label: 'Security & Firewalls',
    icon: Shield,
    colorClass: 'text-rose-400',
  },
  {
    key: 'Wireless & Infrastructure',
    label: 'Wireless & Mobility',
    icon: Wifi,
    colorClass: 'text-amber-400',
  },
  {
    key: 'WAN & Cloud',
    label: 'WAN & Cloud Providers',
    icon: Cloud,
    colorClass: 'text-sky-400',
  },
  {
    key: 'End Devices',
    label: 'End Devices & Hosts',
    icon: Monitor,
    colorClass: 'text-purple-400',
  },
];

// -------------------------------------------------------------------------
// CABLE & MEDIA CATEGORIES
// -------------------------------------------------------------------------
type CableCategoryKey =
  | 'Ethernet & Twisted-Pair'
  | 'Fiber & High-Speed'
  | 'Serial & WAN'
  | 'Broadband & Console';

interface CableCategoryConfig {
  key: CableCategoryKey;
  label: string;
  icon: React.ElementType;
  colorClass: string;
}

const CABLE_CATEGORIES: CableCategoryConfig[] = [
  {
    key: 'Ethernet & Twisted-Pair',
    label: 'Ethernet LAN Media',
    icon: Cable,
    colorClass: 'text-sky-400',
  },
  {
    key: 'Fiber & High-Speed',
    label: 'Optical & Backbone',
    icon: Zap,
    colorClass: 'text-cyan-400',
  },
  {
    key: 'Serial & WAN',
    label: 'Serial & Leased WAN',
    icon: Waypoints,
    colorClass: 'text-pink-400',
  },
  {
    key: 'Broadband & Console',
    label: 'Broadband & Management',
    icon: Cpu,
    colorClass: 'text-amber-400',
  },
];

interface CableSpec {
  type: CableType;
  name: string;
  category: CableCategoryKey;
  desc: string;
  color: string;
  badge: string;
  dash?: boolean;
}

const CABLES_LIST: CableSpec[] = [
  // ETHERNET & TWISTED-PAIR
  {
    type: 'auto',
    name: 'Smart Auto-Cable',
    category: 'Ethernet & Twisted-Pair',
    desc: 'Auto-senses device MDI/MDIX pins and automatically selects appropriate media standard.',
    color: 'bg-emerald-500',
    badge: 'Auto-Sense',
  },
  {
    type: 'straight',
    name: 'Copper Straight-Through',
    category: 'Ethernet & Twisted-Pair',
    desc: 'Cat6 EIA/TIA 568B pin-to-pin. Connects dissimilar hardware (Host to Switch, Router to Switch).',
    color: 'bg-sky-500',
    badge: '1 Gbps Cat6',
  },
  {
    type: 'crossover',
    name: 'Copper Crossover',
    category: 'Ethernet & Twisted-Pair',
    desc: 'Cat6 with reversed TX/RX pairs. Connects like hardware (Switch to Switch, Router to Router, PC to PC).',
    color: 'bg-amber-500',
    badge: '1 Gbps Cat6',
    dash: true,
  },
  {
    type: 'rollover',
    name: 'Console Rollover Cable',
    category: 'Ethernet & Twisted-Pair',
    desc: 'Light blue rollover console cable (RJ-45 to DB-9/USB) for out-of-band CLI initial setup.',
    color: 'bg-sky-400',
    badge: 'Console CLI',
    dash: true,
  },

  // FIBER & HIGH-SPEED
  {
    type: 'fiber',
    name: 'Fiber Optic (LC Duplex)',
    category: 'Fiber & High-Speed',
    desc: 'Multi-mode / Single-mode duplex optical LC cable for long-distance 10G/40G switch trunking.',
    color: 'bg-cyan-400',
    badge: '10/40 Gbps',
  },
  {
    type: 'dac',
    name: '10G/40G SFP+ Twinax DAC',
    category: 'Fiber & High-Speed',
    desc: 'Direct Attach Copper passive cable for low-latency rack-to-rack spine-and-leaf interconnect.',
    color: 'bg-purple-400',
    badge: '10G Twinax',
  },

  // SERIAL & WAN
  {
    type: 'serial',
    name: 'Serial V.35 DCE (Clocking)',
    category: 'Serial & WAN',
    desc: 'Smart Serial DCE providing clock-rate signal to synchronize point-to-point leased line WANs.',
    color: 'bg-pink-500',
    badge: 'Clock Provider',
    dash: true,
  },
  {
    type: 'serial_dte',
    name: 'Serial V.35 DTE (Endpoint)',
    category: 'Serial & WAN',
    desc: 'Smart Serial DTE connector for router branch endpoints connecting to telecom provider equipment.',
    color: 'bg-rose-500',
    badge: 'Subscriber End',
    dash: true,
  },

  // BROADBAND & CONSOLE
  {
    type: 'coaxial',
    name: 'Coaxial Cable (RG-6 / DOCSIS)',
    category: 'Broadband & Console',
    desc: 'Heavy shielding 75-ohm coaxial cable with F-connectors for Cable Modem to ISP headend uplink.',
    color: 'bg-slate-400',
    badge: 'Broadband Coax',
  },
  {
    type: 'phone',
    name: 'Telephone Line (RJ-11)',
    category: 'Broadband & Console',
    desc: 'Standard 2-pair RJ-11 analog telephone wire connecting DSL broadband modems to central office.',
    color: 'bg-emerald-400',
    badge: 'DSL Line',
  },
  {
    type: 'usb',
    name: 'USB Console Cable',
    category: 'Broadband & Console',
    desc: 'USB Type-A to Mini-B console cable used for device management sessions.',
    color: 'bg-indigo-400',
    badge: 'USB Management',
  },
];

export const DevicePalette: React.FC<DevicePaletteProps> = ({
  onAddDevice,
  activeCableType,
  onSelectCableType,
  onDeleteSelected,
  onClearAll,
}) => {
  const [activeTab, setActiveTab] = useState<'devices' | 'cables'>('devices');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState<number>(300);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(220, Math.min(520, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Hardware Drawers expansion state
  const [openDeviceDrawers, setOpenDeviceDrawers] = useState<Record<DeviceCategoryKey, boolean>>({
    'Routers': true,
    'Switches': true,
    'Security & Firewalls': true,
    'Wireless & Infrastructure': true,
    'WAN & Cloud': true,
    'End Devices': true,
  });

  // Cable Drawers expansion state
  const [openCableDrawers, setOpenCableDrawers] = useState<Record<CableCategoryKey, boolean>>({
    'Ethernet & Twisted-Pair': true,
    'Fiber & High-Speed': true,
    'Serial & WAN': true,
    'Broadband & Console': true,
  });

  const toggleDeviceDrawer = (key: DeviceCategoryKey) => {
    setOpenDeviceDrawers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCableDrawer = (key: CableCategoryKey) => {
    setOpenCableDrawers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllDrawers = () => {
    if (activeTab === 'devices') {
      const allOpen = Object.values(openDeviceDrawers).every(Boolean);
      const updated = {} as Record<DeviceCategoryKey, boolean>;
      DEVICE_CATEGORIES.forEach((c) => {
        updated[c.key] = !allOpen;
      });
      setOpenDeviceDrawers(updated);
    } else {
      const allOpen = Object.values(openCableDrawers).every(Boolean);
      const updated = {} as Record<CableCategoryKey, boolean>;
      CABLE_CATEGORIES.forEach((c) => {
        updated[c.key] = !allOpen;
      });
      setOpenCableDrawers(updated);
    }
  };

  // Filtered devices by search query
  const filteredSpecs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return DEVICE_SPECS;

    const matched: Partial<Record<DeviceType, DeviceSpec>> = {};
    (Object.entries(DEVICE_SPECS) as [DeviceType, DeviceSpec][]).forEach(([type, spec]) => {
      const matchName = spec.displayName.toLowerCase().includes(q);
      const matchDesc = spec.description.toLowerCase().includes(q);
      const matchCat = spec.category.toLowerCase().includes(q);
      const matchTags = spec.tags?.some((t) => t.toLowerCase().includes(q));
      const matchPorts = spec.defaultPorts.some((p) => p.name.toLowerCase().includes(q));

      if (matchName || matchDesc || matchCat || matchTags || matchPorts) {
        matched[type] = spec;
      }
    });
    return matched;
  }, [searchQuery]);

  // Filtered cables by search query
  const filteredCables = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return CABLES_LIST;

    return CABLES_LIST.filter((c) => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchDesc = c.desc.toLowerCase().includes(q);
      const matchCat = c.category.toLowerCase().includes(q);
      const matchBadge = c.badge.toLowerCase().includes(q);
      return matchName || matchDesc || matchCat || matchBadge;
    });
  }, [searchQuery]);

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none z-20 shrink-0"
    >
      {/* Resizer Handle */}
      <div
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-sky-500/60 transition-colors z-30"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      />

      {/* Sidebar Header & Tab Switcher */}
      <div className="p-2 border-b border-slate-800 bg-slate-950/40 space-y-2">
        <div className="flex bg-slate-800/80 p-0.5 rounded-lg">
          <button
            onClick={() => {
              setActiveTab('devices');
              onSelectCableType(null);
            }}
            className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'devices' && !activeCableType
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Hardware Drawers
          </button>
          <button
            onClick={() => setActiveTab('cables')}
            className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === 'cables' || activeCableType
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cable className="w-3.5 h-3.5" />
            Cables & Media
          </button>
        </div>

        {/* Universal Search Bar & Cascading Toggle */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeTab === 'devices'
                  ? 'Search models, ports, OSPF...'
                  : 'Search cables, fiber, coax...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={toggleAllDrawers}
            title="Expand or Collapse All Drawers"
            className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-colors cursor-pointer"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {activeTab === 'devices' ? (
          /* ========================================================= */
          /* HARDWARE DRAWERS                                          */
          /* ========================================================= */
          DEVICE_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const items = (Object.values(filteredSpecs) as DeviceSpec[]).filter(
              (spec) => spec && spec.category === cat.key
            );

            if (items.length === 0) return null;

            const isOpen = !!openDeviceDrawers[cat.key];

            return (
              <div
                key={cat.key}
                className="rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden shadow-sm transition-all"
              >
                {/* Cascading Drawer Header */}
                <button
                  onClick={() => toggleDeviceDrawer(cat.key)}
                  className="w-full px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800/80 flex items-center justify-between border-b border-slate-800/60 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5">
                    <CatIcon className={`w-4 h-4 ${cat.colorClass}`} />
                    <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700/60">
                      {items.length}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 transition-transform" />
                    )}
                  </div>
                </button>

                {/* Drawer Body (Collapsible Cascade) */}
                {isOpen && (
                  <div className="p-1.5 space-y-1 bg-slate-950/20">
                    {items.map((spec) => {
                      return (
                        <div
                          key={spec.type}
                          onClick={() => onAddDevice(spec.type)}
                          title={spec.description}
                          className="group py-1 px-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/90 border border-slate-800/80 hover:border-sky-400/80 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between gap-2 text-left"
                        >
                          {/* Left: Realistic Device Front Panel Thumbnail & Title */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-0.5 rounded bg-slate-950 border border-slate-800 group-hover:border-sky-500/30 group-hover:bg-sky-500/10 transition-colors shrink-0 flex items-center justify-center">
                              <DeviceFrontPanel type={spec.type} mode="compact" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                                {spec.displayName}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[10px] font-mono text-slate-400">
                                  {spec.defaultPorts.length} ports
                                </span>
                                {spec.tags && spec.tags.length > 0 && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800/80 text-slate-400 truncate max-w-[100px]">
                                    {spec.tags[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Plus Action Badge */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddDevice(spec.type);
                            }}
                            title={`Add ${spec.displayName} to canvas`}
                            className="p-0.5 rounded text-slate-400 group-hover:text-sky-300 group-hover:bg-sky-500/20 transition-all shrink-0 cursor-pointer"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* ========================================================= */
          /* CABLES & MEDIA DRAWERS                                    */
          /* ========================================================= */
          CABLE_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const items = filteredCables.filter((c) => c.category === cat.key);

            if (items.length === 0) return null;

            const isOpen = !!openCableDrawers[cat.key];

            return (
              <div
                key={cat.key}
                className="rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden shadow-sm transition-all"
              >
                {/* Cascading Cable Drawer Header */}
                <button
                  onClick={() => toggleCableDrawer(cat.key)}
                  className="w-full px-3 py-2 bg-slate-900/90 hover:bg-slate-800/80 flex items-center justify-between border-b border-slate-800/60 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <CatIcon className={`w-4 h-4 ${cat.colorClass}`} />
                    <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700/60">
                      {items.length}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 transition-transform" />
                    )}
                  </div>
                </button>

                {/* Drawer Body (Collapsible Cascade of Cables) */}
                {isOpen && (
                  <div className="p-2 space-y-1.5 bg-slate-950/20">
                    {items.map((cable) => {
                      const isActive = activeCableType === cable.type;
                      return (
                        <div
                          key={cable.type}
                          onClick={() => onSelectCableType(isActive ? null : cable.type)}
                          title={cable.desc}
                          className={`group p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                            isActive
                              ? 'bg-sky-950/70 border-sky-400 shadow-md shadow-sky-500/10 ring-1 ring-sky-400'
                              : 'bg-slate-900/60 hover:bg-slate-800/90 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          {/* Left: Cable Dot & Info */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative flex items-center justify-center p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                              <div
                                className={`w-3.5 h-3.5 rounded-full ${cable.color} ${
                                  cable.dash ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div
                                className={`text-xs font-bold truncate ${
                                  isActive ? 'text-sky-200' : 'text-slate-200 group-hover:text-white'
                                }`}
                              >
                                {cable.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800/90 font-mono text-slate-400">
                                  {cable.badge}
                                </span>
                                <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
                                  {cable.desc.substring(0, 32)}...
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Active Checkmark or Connect Hint */}
                          <div className="shrink-0 flex items-center">
                            {isActive ? (
                              <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-sm">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-slate-700/60 group-hover:border-slate-500 flex items-center justify-center text-slate-500 group-hover:text-slate-300 transition-colors">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-slate-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Toolbar / Actions at bottom */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => onSelectCableType(null)}
            title="Select Mode"
            className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              !activeCableType
                ? 'bg-slate-800 border-slate-600 text-sky-400'
                : 'border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            Select
          </button>
          <button
            onClick={onDeleteSelected}
            title="Delete Selected Device or Cable (Del)"
            className="flex-1 py-1.5 px-2 rounded-lg border border-slate-800 text-rose-400 hover:bg-rose-950/40 hover:border-rose-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>

        <button
          onClick={onClearAll}
          className="w-full py-1.5 px-2 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          Clear Workspace
        </button>
      </div>
    </aside>
  );
};
