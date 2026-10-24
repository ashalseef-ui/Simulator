import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Device,
  Link,
  CableType,
  StpTopologyState,
  SimulationStep,
} from '../types/network';
import { DEVICE_SPECS, validateCabling } from '../engine/deviceSpecs';
import { areSameSubnet } from '../utils/ipUtils';
import {
  Network,
  Activity,
  Zap,
  ZapOff,
  Trash2,
} from 'lucide-react';

import { DeviceFrontPanel } from './DeviceFrontPanel';
import { CanvasLinksOverlay } from './canvas/CanvasLinksOverlay';

interface CanvasProps {
  devices: Device[];
  links: Link[];
  selectedDeviceId: string | null;
  selectedLinkId: string | null;
  activeCableType: CableType | null;
  cableSource: { deviceId: string; port: string } | null;
  stpState: StpTopologyState;
  currentSimStep: SimulationStep | null;
  onSelectDevice: (id: string | null) => void;
  onSelectLink: (id: string | null) => void;
  onMoveDevice: (id: string, x: number, y: number) => void;
  onOpenDevice: (id: string) => void;
  onStartCabling: (deviceId: string, port: string) => void;
  onCompleteCabling: (targetDeviceId: string, targetPort: string) => void;
  onCancelCabling: () => void;
  onDeleteSelected: () => void;
  onToggleLinkState?: (linkId: string) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  devices,
  links,
  selectedDeviceId,
  selectedLinkId,
  activeCableType,
  cableSource,
  stpState,
  currentSimStep,
  onSelectDevice,
  onSelectLink,
  onMoveDevice,
  onOpenDevice,
  onStartCabling,
  onCompleteCabling,
  onCancelCabling,
  onDeleteSelected,
  onToggleLinkState,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showHealthLegend, setShowHealthLegend] = useState(false);

  // Dragging device state
  const [draggingDevId, setDraggingDevId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Mouse world coordinates for cabling rubber-band
  const [mouseWorldPos, setMouseWorldPos] = useState({ x: 0, y: 0 });

  // Port selector popover state
  const [portPickerDevice, setPortPickerDevice] = useState<Device | null>(null);
  const [portPickerPos, setPortPickerPos] = useState({ x: 0, y: 0 });

  // Keyboard delete listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedDeviceId || selectedLinkId)) {
        // Only if not inside an input/textarea
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          onDeleteSelected();
        }
      }
      if (e.key === 'Escape') {
        onCancelCabling();
        setPortPickerDevice(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDeviceId, selectedLinkId, onDeleteSelected, onCancelCabling]);

  // Keep refs to zoom and pan for native non-passive wheel listener
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;

  // Native wheel listener with passive: false to reliably capture mouse scroll wheel for zooming
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();

      if (e.shiftKey) {
        // Shift + Wheel = Horizontal pan
        setPan((p) => ({ x: p.x - e.deltaY, y: p.y }));
        return;
      }

      // Mouse scroll wheel directly controls Zoom In & Zoom Out centered on mouse position
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const nextZoom = Math.min(3.0, Math.max(0.2, +(currentZoom * zoomFactor).toFixed(3)));

      if (nextZoom === currentZoom) return;

      const worldX = (cursorX - currentPan.x) / currentZoom;
      const worldY = (cursorY - currentPan.y) / currentZoom;

      setZoom(nextZoom);
      setPan({
        x: cursorX - worldX * nextZoom,
        y: cursorY - worldY * nextZoom,
      });
    };

    container.addEventListener('wheel', onWheelNative, { passive: false });
    return () => container.removeEventListener('wheel', onWheelNative);
  }, []);

  // Handle Wheel Pan & Zoom (React fallback)
  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;

    if (e.shiftKey) {
      setPan((p) => ({ x: p.x - e.deltaY, y: p.y }));
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const nextZoom = Math.min(3.0, Math.max(0.2, +(zoom * zoomFactor).toFixed(3)));

    if (nextZoom === zoom) return;

    const worldX = (cursorX - pan.x) / zoom;
    const worldY = (cursorY - pan.y) / zoom;

    setZoom(nextZoom);
    setPan({
      x: cursorX - worldX * nextZoom,
      y: cursorY - worldY * nextZoom,
    });
  };

  // Convert client mouse pos to canvas world coordinates
  const clientToWorld = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+click to pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      onSelectDevice(null);
      onSelectLink(null);
      setPortPickerDevice(null);
      if (e.button === 0 && !activeCableType) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const worldPos = clientToWorld(e.clientX, e.clientY);
    setMouseWorldPos(worldPos);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (draggingDevId) {
      // Snap to 10px grid
      const rawX = worldPos.x - dragOffset.x;
      const rawY = worldPos.y - dragOffset.y;
      const snappedX = Math.round(rawX / 10) * 10;
      const snappedY = Math.round(rawY / 10) * 10;
      onMoveDevice(draggingDevId, snappedX, snappedY);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingDevId(null);
  };

  // Start dragging or cabling on a device card
  const handleDeviceMouseDown = (e: React.MouseEvent, dev: Device) => {
    e.stopPropagation();

    if (activeCableType) {
      // Cabling mode: open port selector
      if (!cableSource) {
        setPortPickerDevice(dev);
        setPortPickerPos({ x: dev.x + 85, y: dev.y });
      } else if (cableSource.deviceId !== dev.id) {
        setPortPickerDevice(dev);
        setPortPickerPos({ x: dev.x + 85, y: dev.y });
      }
      return;
    }

    if (e.button === 0) {
      onSelectDevice(dev.id);
      onSelectLink(null);
      setDraggingDevId(dev.id);
      const worldPos = clientToWorld(e.clientX, e.clientY);
      setDragOffset({
        x: worldPos.x - dev.x,
        y: worldPos.y - dev.y,
      });
    }
  };

  // Port selector click handler
  const handleSelectPort = (portName: string) => {
    if (!portPickerDevice) return;

    if (!cableSource) {
      // Source selected
      onStartCabling(portPickerDevice.id, portName);
      setPortPickerDevice(null);
    } else {
      // Destination selected
      onCompleteCabling(portPickerDevice.id, portName);
      setPortPickerDevice(null);
    }
  };

  // Get available ports on device that are not already wired
  const getDevicePortsWithUsage = (dev: Device) => {
    const spec = DEVICE_SPECS[dev.type];
    const ports = spec.defaultPorts.map((p) => {
      const isUsed = links.some(
        (l) =>
          (l.fromDevice === dev.id && l.fromPort === p.name) ||
          (l.toDevice === dev.id && l.toPort === p.name)
      );
      return {
        name: p.name,
        speed: p.speed,
        isUsed,
      };
    });
    return ports;
  };

  // Memoized selected link info for HUD and inspector
  const selectedLink = links.find((l) => l.id === selectedLinkId);
  const selectedLinkInfo = useMemo(() => {
    if (!selectedLink) return null;
    const devA = devices.find((d) => d.id === selectedLink.fromDevice);
    const devB = devices.find((d) => d.id === selectedLink.toDevice);
    if (!devA || !devB) return null;
    const ifaceA = devA.config.interfaces[selectedLink.fromPort];
    const ifaceB = devB.config.interfaces[selectedLink.toPort];
    const isDownA = !ifaceA || ifaceA.status === 'down';
    const isDownB = !ifaceB || ifaceB.status === 'down';
    const isLinkDown = isDownA || isDownB;

    const stpA = stpState.ports[`${devA.id}:${selectedLink.fromPort}`];
    const stpB = stpState.ports[`${devB.id}:${selectedLink.toPort}`];
    const isStpBlocked = stpA?.state === 'BLK' || stpB?.state === 'BLK';
    const cableVal = validateCabling(devA, selectedLink.fromPort, devB, selectedLink.toPort, selectedLink.cable);
    const isMismatch = !cableVal.valid;
    const isIpMismatch =
      Boolean(ifaceA?.ip && ifaceA?.mask && ifaceB?.ip && ifaceB?.mask) &&
      !areSameSubnet(ifaceA!.ip!, ifaceB!.ip!, ifaceA!.mask || '255.255.255.0');

    return {
      link: selectedLink,
      devA,
      devB,
      ifaceA,
      ifaceB,
      isDownA,
      isDownB,
      isLinkDown,
      isStpBlocked,
      isMismatch,
      isIpMismatch,
      cableValMessage: cableVal.message,
      midX: (devA.x + devB.x + 80) / 2,
      midY: (devA.y + devB.y + 80) / 2,
    };
  }, [selectedLink, devices, stpState]);

  // Memoized link health counter
  const linkHealthCounts = useMemo(() => {
    let up = 0;
    let warn = 0;
    let down = 0;

    for (const link of links) {
      const devA = devices.find((d) => d.id === link.fromDevice);
      const devB = devices.find((d) => d.id === link.toDevice);
      if (!devA || !devB) continue;

      const ifaceA = devA.config.interfaces[link.fromPort];
      const ifaceB = devB.config.interfaces[link.toPort];
      const isDownA = !ifaceA || ifaceA.status === 'down';
      const isDownB = !ifaceB || ifaceB.status === 'down';
      const isLinkDown = isDownA || isDownB;

      if (isLinkDown) {
        down++;
        continue;
      }

      const stpA = stpState.ports[`${devA.id}:${link.fromPort}`];
      const stpB = stpState.ports[`${devB.id}:${link.toPort}`];
      const isStpBlocked = stpA?.state === 'BLK' || stpB?.state === 'BLK';
      const cableVal = validateCabling(devA, link.fromPort, devB, link.toPort, link.cable);
      const isMismatch = !cableVal.valid;
      const isIpMismatch =
        Boolean(ifaceA?.ip && ifaceA?.mask && ifaceB?.ip && ifaceB?.mask) &&
        !areSameSubnet(ifaceA!.ip!, ifaceB!.ip!, ifaceA!.mask || '255.255.255.0');

      if (isStpBlocked || isMismatch || isIpMismatch) {
        warn++;
      } else {
        up++;
      }
    }

    return { up, warn, down };
  }, [links, devices, stpState]);

  // Calculate rubber band line if cabling source is set
  let rubberBand: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (cableSource) {
    const srcDev = devices.find((d) => d.id === cableSource.deviceId);
    if (srcDev) {
      const cAx = srcDev.x + 40;
      const cAy = srcDev.y + 40;
      rubberBand = {
        x1: cAx,
        y1: cAy,
        x2: mouseWorldPos.x,
        y2: mouseWorldPos.y,
      };
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 w-full h-full overflow-hidden bg-slate-950 ${
        isPanning ? 'cursor-grabbing' : activeCableType ? 'cursor-crosshair' : 'cursor-grab'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Background Dots Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* SVG Canvas for Links, Port LEDs, Badges, and Packet Animations */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Cable Lines & Rubber-band Cabling Layer */}
        <CanvasLinksOverlay
          devices={devices}
          links={links}
          selectedLinkId={selectedLinkId}
          stpState={stpState}
          currentSimStep={currentSimStep}
          rubberBand={rubberBand}
          onSelectLink={onSelectLink}
          onSelectDevice={onSelectDevice}
        />
      </svg>

      {/* HTML Layer for Device Cards */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {devices.map((dev) => {
          const isSelected = dev.id === selectedDeviceId;
          const isRootBridge = stpState.rootBridgeId === dev.id;

          // Find primary IP if assigned
          const primaryIp =
            Object.values(dev.config.interfaces).find((i) => i.ip)?.ip ||
            (dev.config.isDhcpClient ? 'DHCP' : '');

          // Device overall connection health
          const devLinks = links.filter((l) => l.fromDevice === dev.id || l.toDevice === dev.id);
          const hasDownLink = devLinks.some((l) => {
            const isA = l.fromDevice === dev.id;
            const myPort = isA ? l.fromPort : l.toPort;
            const oppDevId = isA ? l.toDevice : l.fromDevice;
            const oppPort = isA ? l.toPort : l.fromPort;
            const oppDev = devices.find((d) => d.id === oppDevId);
            const myIface = dev.config.interfaces[myPort];
            const oppIface = oppDev?.config.interfaces[oppPort];
            return myIface?.status === 'down' || oppIface?.status === 'down';
          });
          const hasWarnLink =
            !hasDownLink &&
            devLinks.some((l) => {
              const isA = l.fromDevice === dev.id;
              const myPort = isA ? l.fromPort : l.toPort;
              const stp = stpState.ports[`${dev.id}:${myPort}`];
              return stp?.state === 'BLK' || l.isMismatch;
            });

          return (
            <div
              key={dev.id}
              className={`absolute pointer-events-auto select-none transition-shadow ${
                isSelected ? 'z-30' : 'z-10'
              }`}
              style={{
                left: `${dev.x}px`,
                top: `${dev.y}px`,
                width: '84px',
                height: '82px',
              }}
              onMouseDown={(e) => handleDeviceMouseDown(e, dev)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onOpenDevice(dev.id);
              }}
            >
              {/* Realistic Hardware Card */}
              <div
                className={`relative w-full h-full rounded-xl bg-slate-900/90 backdrop-blur-md border p-1.5 flex flex-col items-center justify-between cursor-move shadow-lg transition-all ${
                  isSelected
                    ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-sky-500/20'
                    : 'border-slate-800 hover:border-slate-600 shadow-black/40'
                }`}
              >
                {/* Top Badge: Type & Root Bridge & Real-Time Link Health Indicator */}
                <div className="w-full flex items-center justify-between">
                  <span className="text-[9px] font-mono font-medium text-slate-400 uppercase tracking-tighter truncate max-w-[44px]">
                    {dev.type}
                  </span>
                  <div className="flex items-center gap-1">
                    {isRootBridge && (
                      <span
                        title="STP Root Bridge"
                        className="px-1 py-0.2 text-[8px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded"
                      >
                        ROOT
                      </span>
                    )}
                    {devLinks.length > 0 && (
                      <span
                        title={
                          hasDownLink
                            ? 'Connection Alert: Link Down / Interface Shutdown'
                            : hasWarnLink
                            ? 'Warning: STP Blocked or Cable Mismatch'
                            : 'All Connected Links Operational (Up/Forwarding)'
                        }
                        className={`w-2 h-2 rounded-full border border-slate-950 ${
                          hasDownLink
                            ? 'bg-rose-500 shadow-sm shadow-rose-500/80 animate-pulse'
                            : hasWarnLink
                            ? 'bg-amber-400 shadow-sm shadow-amber-400/80'
                            : 'bg-emerald-400 shadow-sm shadow-emerald-400/80'
                        }`}
                      />
                    )}
                  </div>
                </div>

                {/* Realistic Device Front Panel Graphic */}
                <div className="relative my-0.5 w-full flex items-center justify-center">
                  <DeviceFrontPanel type={dev.type} mode="compact" device={dev} />
                </div>

                {/* Device Name / Hostname */}
                <span className="text-[10px] font-semibold text-slate-200 text-center truncate w-full px-0.5 leading-none">
                  {dev.config.hostname || dev.name}
                </span>

                {/* IP Subtitle Pill */}
                {primaryIp && (
                  <div className="text-[8px] font-mono text-sky-400/90 truncate w-full text-center leading-none mt-0.5">
                    {primaryIp}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Port Selection Popover (when Cabling) */}
      {portPickerDevice && (() => {
        const popoverWidth = 220;
        const popoverHeight = 280;
        const containerW = containerRef.current?.clientWidth || window.innerWidth;
        const containerH = containerRef.current?.clientHeight || window.innerHeight;
        const rawLeft = portPickerPos.x * zoom + pan.x;
        const rawTop = portPickerPos.y * zoom + pan.y;
        const clampedLeft = Math.max(16, Math.min(rawLeft, containerW - popoverWidth - 16));
        const clampedTop = Math.max(16, Math.min(rawTop, containerH - popoverHeight - 16));

        return (
          <div
            className="absolute z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 min-w-[200px]"
            style={{
              left: `${clampedLeft}px`,
              top: `${clampedTop}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div>
              <div className="text-xs font-bold text-slate-200">
                {portPickerDevice.name}
              </div>
              <div className="text-[10px] text-slate-400">
                {cableSource ? 'Select Target Port' : 'Select Source Port'}
              </div>
            </div>
            <button
              onClick={() => setPortPickerDevice(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {getDevicePortsWithUsage(portPickerDevice).map((p) => (
              <button
                key={p.name}
                disabled={p.isUsed}
                onClick={() => handleSelectPort(p.name)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  p.isUsed
                    ? 'opacity-40 cursor-not-allowed bg-slate-800/40 text-slate-500'
                    : 'bg-slate-800/80 hover:bg-sky-600 text-slate-200 hover:text-white cursor-pointer'
                }`}
              >
                <span>{p.name}</span>
                <span className="text-[10px] opacity-75">
                  {p.isUsed ? 'In-Use' : `${p.speed}M`}
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    })()}

      {/* Active Cabling Mode Notification Banner */}
      {activeCableType && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-slate-950/90 border border-sky-500/40 backdrop-blur-xl px-3 py-1.5 rounded-lg shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
          <span className="text-xs font-medium text-slate-200">
            {cableSource
              ? `Connecting ${cableSource.port} to target device...`
              : `Select port on source device to attach ${activeCableType} cable`}
          </span>
          <button
            onClick={onCancelCabling}
            className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 ml-1.5 cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-500/10 transition-colors"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      {/* Selected Link Real-Time Inspector / Fault Simulation Floating Action Card */}
      {selectedLinkInfo && (
        <div
          className="absolute z-40 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl shadow-2xl p-3 min-w-[280px] max-w-sm pointer-events-auto"
          style={{
            left: Math.max(20, Math.min(window.innerWidth - 320, selectedLinkInfo.midX * zoom + pan.x - 140)),
            top: Math.max(20, selectedLinkInfo.midY * zoom + pan.y - 75),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  selectedLinkInfo.isLinkDown
                    ? 'bg-rose-500 animate-ping'
                    : selectedLinkInfo.isStpBlocked || selectedLinkInfo.isMismatch || selectedLinkInfo.isIpMismatch
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span className="text-xs font-bold text-slate-200">
                {selectedLinkInfo.isLinkDown
                  ? 'Link Down / Broken Connection'
                  : selectedLinkInfo.isStpBlocked
                  ? 'STP Blocked (Loop Prevention)'
                  : selectedLinkInfo.isMismatch
                  ? 'Cable Type Mismatch'
                  : selectedLinkInfo.isIpMismatch
                  ? 'Subnet IP Mismatch'
                  : 'Link Up & Forwarding'}
              </span>
            </div>
            <button
              onClick={() => onSelectLink(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>

          {/* Endpoints & Status */}
          <div className="my-2 space-y-1.5 text-[11px] font-mono">
            <div className="flex items-center justify-between text-slate-300 bg-slate-950/60 px-2 py-1 rounded">
              <span className="text-sky-400 font-semibold truncate max-w-[120px]">
                {selectedLinkInfo.devA.name} ({selectedLinkInfo.link.fromPort})
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  selectedLinkInfo.isDownA
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {selectedLinkInfo.isDownA ? 'DOWN' : 'UP'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300 bg-slate-950/60 px-2 py-1 rounded">
              <span className="text-sky-400 font-semibold truncate max-w-[120px]">
                {selectedLinkInfo.devB.name} ({selectedLinkInfo.link.toPort})
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                  selectedLinkInfo.isDownB
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {selectedLinkInfo.isDownB ? 'DOWN' : 'UP'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5 px-0.5">
              <span>
                Cable: <span className="text-slate-200 capitalize">{selectedLinkInfo.link.cable}</span>
              </span>
              <span className="text-emerald-400">1 Gbps Full-Duplex</span>
            </div>
          </div>

          {/* Action buttons: Break/Restore Link & Delete */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
            {onToggleLinkState && (
              <button
                onClick={() => onToggleLinkState(selectedLinkInfo.link.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                  selectedLinkInfo.isLinkDown
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30'
                    : 'bg-rose-600/90 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/30'
                }`}
              >
                {selectedLinkInfo.isLinkDown ? (
                  <>
                    <Zap className="w-3 h-3" />
                    Restore Link (Bring Up)
                  </>
                ) : (
                  <>
                    <ZapOff className="w-3 h-3" />
                    Simulate Break (Down)
                  </>
                )}
              </button>
            )}
            <button
              onClick={onDeleteSelected}
              title="Delete Cable"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border border-slate-700 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Empty Canvas Guidance Watermark */}
      {devices.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-4">
          <div className="w-14 h-14 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3 shadow-xl backdrop-blur-sm">
            <Network className="w-7 h-7 text-sky-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-slate-200 mb-1 tracking-tight">
            Empty Workspace Canvas
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mb-3.5">
            Select devices in the left sidebar to add hardware, or click <span className="text-sky-400 font-medium">Presets</span> in the top bar to load a topology.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <span className="px-2 py-0.5 rounded bg-white/[0.03] border border-white/5">Mouse Wheel: Zoom</span>
            <span>·</span>
            <span className="px-2 py-0.5 rounded bg-white/[0.03] border border-white/5">Drag Canvas: Pan</span>
          </div>
        </div>
      )}

      {/* Real-Time Link & Connection Health Indicator HUD */}
      {links.length > 0 && (
        <div className="absolute bottom-2.5 left-2.5 z-30 select-none">
          <div className="bg-slate-950/90 border border-white/10 backdrop-blur-xl rounded-lg px-2.5 py-1.5 shadow-xl space-y-1 text-xs max-w-xs">
            <div
              className="flex items-center justify-between gap-3 cursor-pointer"
              onClick={() => setShowHealthLegend(!showHealthLegend)}
            >
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-medium text-slate-300 text-[11px]">
                  Link Health
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span
                  className="flex items-center gap-1 text-emerald-400 px-1 py-0.2 rounded bg-emerald-950/40 border border-emerald-900/40"
                  title="Operational Links (Up & Forwarding)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {linkHealthCounts.up}
                </span>
                <span
                  className="flex items-center gap-1 text-amber-400 px-1 py-0.2 rounded bg-amber-950/40 border border-amber-900/40"
                  title="Blocked / Warning Links"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {linkHealthCounts.warn}
                </span>
                <span
                  className="flex items-center gap-1 text-rose-400 px-1 py-0.2 rounded bg-rose-950/40 border border-rose-900/40"
                  title="Down / Failed Links"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  {linkHealthCounts.down}
                </span>
                <span className="text-[10px] text-slate-500 font-sans ml-0.5">
                  {showHealthLegend ? '▾' : '▸'}
                </span>
              </div>
            </div>

            {/* Expanded Health Color Legend */}
            {showHealthLegend && (
              <div className="pt-1.5 border-t border-white/5 space-y-1 text-[10px] text-slate-300">
                <div className="flex items-start gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-emerald-400">Green:</strong> Up & STP Forwarding
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-400">Amber:</strong> STP Blocked / Mismatch
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-0.5 animate-pulse" />
                  <span>
                    <strong className="text-rose-400">Red:</strong> Down / Shutdown
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zoom / Viewport HUD Controls - Sleek Horizontal Glass Bar */}
      <div className="absolute bottom-2.5 right-2.5 z-30 bg-slate-950/90 border border-white/10 backdrop-blur-xl rounded-lg px-1.5 py-1 shadow-xl flex items-center gap-1 text-slate-300">
        <button
          title="Zoom Out (Scroll Down)"
          onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.15).toFixed(2)))}
          className="p-1 hover:bg-white/5 hover:text-white rounded text-xs font-bold cursor-pointer transition-colors"
        >
          -
        </button>
        <span
          title="Current Zoom"
          className="text-[11px] font-mono px-1 select-none text-slate-400"
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          title="Zoom In (Scroll Up)"
          onClick={() => setZoom((z) => Math.min(3.0, +(z + 0.15).toFixed(2)))}
          className="p-1 hover:bg-white/5 hover:text-white rounded text-xs font-bold cursor-pointer transition-colors"
        >
          +
        </button>
        <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />
        <button
          title="Reset Zoom to 100%"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="px-1.5 py-0.5 hover:bg-white/5 hover:text-white rounded text-[10px] font-mono cursor-pointer transition-colors"
        >
          1:1
        </button>
      </div>
    </div>
  );
};
