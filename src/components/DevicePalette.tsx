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
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
} from 'lucide-react';

interface DevicePaletteProps {
  onAddDevice: (type: DeviceType) => void;
  activeCableType: CableType | null;
  onSelectCableType: (cable: CableType | null) => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'devices' | 'cables'>('devices');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState<number>(250);
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

  if (isCollapsed) {
    return (
      <aside className="w-12 bg-slate-950 border-r border-white/5 flex flex-col items-center py-2 select-none z-20 shrink-0 justify-between">
        <div className="flex flex-col items-center gap-2">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Expand Hardware Palette"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4 text-sky-400" />
            </button>
          )}
          <button
            onClick={() => {
              if (onToggleCollapse) onToggleCollapse();
              setActiveTab('devices');
            }}
            title="Hardware Drawers"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'devices'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (onToggleCollapse) onToggleCollapse();
              setActiveTab('cables');
            }}
            title="Cables & Media"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'cables'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Cable className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-2 pt-2 border-t border-white/10 w-full px-1">
          <button
            onClick={() => onSelectCableType(null)}
            title="Select Mode"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              !activeCableType
                ? 'text-sky-400 bg-white/5'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MousePointer className="w-4 h-4" />
          </button>
          <button
            onClick={onDeleteSelected}
            title="Delete Selected"
            className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative bg-slate-950 border-r border-white/5 flex flex-col h-full select-none z-20 shrink-0"
    >
      {/* Resizer Handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-sky-500/60 transition-colors z-30"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      />

      {/* Sidebar Header & Tab Switcher */}
      <div className="p-2 border-b border-white/5 bg-slate-950 space-y-1.5">
        <div className="flex items-center gap-1">
          <div className="flex-1 flex bg-white/[0.04] p-0.5 rounded-lg border border-white/5">
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
              Hardware
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
              Cables
            </button>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Collapse Hardware Palette"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Universal Search Bar & Cascading Toggle */}
        <div className="flex items-center gap-1">
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
              className="w-full bg-white/[0.03] border border-white/10 rounded-md pl-7 pr-6 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400 transition-colors"
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
            className="p-1.5 rounded-md bg-white/[0.03] hover:bg-white/5 text-slate-400 hover:text-slate-200 border border-white/10 transition-colors cursor-pointer"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 custom-scrollbar">
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
                className="group border-b border-white/5 last:border-0"
              >
                {/* Cascading Drawer Header */}
                <button
                  onClick={() => toggleDeviceDrawer(cat.key)}
                  className="w-full px-2 py-2 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <CatIcon className={`w-3.5 h-3.5 ${cat.colorClass}`} />
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-slate-100 transition-colors">
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-600">
                      {items.length}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-3 h-3 text-slate-600" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </button>

                {/* Drawer Body (Collapsible Cascade) */}
                {isOpen && (
                  <div className="pb-2 space-y-0.5">
                    {items.map((spec) => {
                      return (
                        <div
                          key={spec.type}
                          onClick={() => onAddDevice(spec.type)}
                          title={spec.description}
                          className="group py-1.5 px-2 rounded hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-between gap-2"
                        >
                          {/* Left: Device Icon & Title */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center shrink-0">
                              <DeviceFrontPanel type={spec.type} mode="compact" animated={false} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-slate-300 group-hover:text-white truncate">
                                {spec.displayName}
                              </div>
                            </div>
                          </div>

                          {/* Plus Action */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddDevice(spec.type);
                            }}
                            title={`Add ${spec.displayName} to canvas`}
                            className="text-slate-600 group-hover:text-sky-400 transition-colors shrink-0 cursor-pointer"
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
                className="group border-b border-white/5 last:border-0"
              >
                {/* Cascading Cable Drawer Header */}
                <button
                  onClick={() => toggleCableDrawer(cat.key)}
                  className="w-full px-2 py-2 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <CatIcon className={`w-3.5 h-3.5 ${cat.colorClass}`} />
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-slate-100 transition-colors">
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-600">
                      {items.length}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-3 h-3 text-slate-600" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </button>

                {/* Drawer Body (Collapsible Cascade of Cables) */}
                {isOpen && (
                  <div className="pb-2 space-y-0.5">
                    {items.map((cable) => {
                      const isActive = activeCableType === cable.type;
                      return (
                        <div
                          key={cable.type}
                          onClick={() => onSelectCableType(isActive ? null : cable.type)}
                          title={cable.desc}
                          className={`group py-1.5 px-2 rounded hover:bg-white/5 transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isActive ? 'bg-sky-500/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center shrink-0">
                              <div className={`w-2 h-2 rounded-full ${cable.color}`} />
                            </div>
                            <div className="text-xs font-medium text-slate-300 group-hover:text-white truncate">
                              {cable.name}
                            </div>
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 text-sky-400" />}
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

      {/* Toolbar / Actions at bottom - Sleek 1-Row Compact Strip */}
      <div className="p-2 border-t border-white/5 bg-slate-950/90 flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onSelectCableType(null)}
          title="Select Mode"
          className={`flex-1 py-1.5 px-2 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            !activeCableType
              ? 'bg-white/10 border-white/15 text-sky-400'
              : 'border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" />
          Select
        </button>
        <button
          onClick={onDeleteSelected}
          title="Delete Selected Device or Cable (Del)"
          className="py-1.5 px-2.5 rounded-md border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
        <button
          onClick={onClearAll}
          title="Clear Entire Topology Workspace"
          className="py-1.5 px-2 rounded-md text-[11px] font-medium text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
        >
          Clear
        </button>
      </div>
    </aside>
  );
};
