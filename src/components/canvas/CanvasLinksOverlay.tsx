import React, { useMemo } from 'react';
import { Device, Link, SimulationStep, StpTopologyState } from '../../types/network';
import { validateCabling } from '../../engine/deviceSpecs';
import { areSameSubnet } from '../../utils/ipUtils';

interface CanvasLinksOverlayProps {
  devices: Device[];
  links: Link[];
  selectedLinkId: string | null;
  stpState: StpTopologyState;
  currentSimStep: SimulationStep | null;
  rubberBand: { x1: number; y1: number; x2: number; y2: number } | null;
  onSelectLink: (linkId: string) => void;
  onSelectDevice: (deviceId: string | null) => void;
}

export const CanvasLinksOverlay: React.FC<CanvasLinksOverlayProps> = ({
  devices,
  links,
  selectedLinkId,
  stpState,
  currentSimStep,
  rubberBand,
  onSelectLink,
  onSelectDevice,
}) => {
  // Memoized rendered links calculation
  const renderedLinks = useMemo(() => {
    return links.map((link) => {
      const devA = devices.find((d) => d.id === link.fromDevice);
      const devB = devices.find((d) => d.id === link.toDevice);
      if (!devA || !devB) return null;

      const cAx = devA.x + 40;
      const cAy = devA.y + 40;
      const cBx = devB.x + 40;
      const cBy = devB.y + 40;

      const dx = cBx - cAx;
      const dy = cBy - cAy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      // Cable line starts at Card A outer border (38px offset) and ends at Card B outer border (38px offset)
      const lineX1 = cAx + ux * 38;
      const lineY1 = cAy + uy * 38;
      const lineX2 = cBx - ux * 38;
      const lineY2 = cBy - uy * 38;

      // Port LED positions: strictly 48px from device center along unit vector (always 10px outside card)
      const ledAx = cAx + ux * 48;
      const ledAy = cAy + uy * 48;
      const ledBx = cBx - ux * 48;
      const ledBy = cBy - uy * 48;

      // Port Labels: positioned 12px above or beside LED
      const labelAx = ledAx - uy * 12;
      const labelAy = ledAy + ux * 12;
      const labelBx = ledBx - uy * 12;
      const labelBy = ledBy + ux * 12;

      // STP status check
      const stpA = stpState.ports[`${devA.id}:${link.fromPort}`];
      const stpB = stpState.ports[`${devB.id}:${link.toPort}`];
      const isStpBlocked = stpA?.state === 'BLK' || stpB?.state === 'BLK';

      // Cable validation check
      const cableVal = validateCabling(devA, link.fromPort, devB, link.toPort, link.cable);
      const isMismatch = !cableVal.valid;

      // Interface status & Link physical state
      const ifaceA = devA.config.interfaces[link.fromPort];
      const ifaceB = devB.config.interfaces[link.toPort];

      const isDownA = !ifaceA || ifaceA.status === 'down';
      const isDownB = !ifaceB || ifaceB.status === 'down';
      const isLinkDown = isDownA || isDownB;

      // Check IP subnet mismatch on routed interfaces
      const hasIpA = Boolean(ifaceA?.ip && ifaceA?.mask);
      const hasIpB = Boolean(ifaceB?.ip && ifaceB?.mask);
      const isIpMismatch =
        hasIpA &&
        hasIpB &&
        !areSameSubnet(ifaceA!.ip!, ifaceB!.ip!, ifaceA!.mask || '255.255.255.0');

      // Real-Time Port LED Color Calculation
      const getLedColor = (isThisDown: boolean, isOtherDown: boolean, stpInfo: any) => {
        if (isThisDown || isOtherDown) return '#ef4444'; // Red (Admin Down or Physical Carrier Loss)
        if (isMismatch) return '#f59e0b'; // Amber (Cable Mismatch)
        if (isIpMismatch) return '#f59e0b'; // Amber (Subnet IP Mismatch)
        if (stpInfo?.state === 'BLK') return '#f59e0b'; // Amber (STP Blocked)
        if (stpInfo?.state === 'LIS' || stpInfo?.state === 'LRN') return '#f59e0b'; // Amber (STP Listening/Learning)
        return '#10b981'; // Emerald Green (Up / Forwarding)
      };

      const ledColorA = getLedColor(isDownA, isDownB, stpA);
      const ledColorB = getLedColor(isDownB, isDownA, stpB);

      // Cable stroke styling
      let strokeColor = '#64748b'; // default slate
      let strokeDash = 'none';

      if (isLinkDown) {
        strokeColor = '#ef4444'; // Red for Down / Broken Connection
        strokeDash = '6,4'; // Dashed line to emphasize outage
      } else if (isMismatch || isIpMismatch) {
        strokeColor = '#f59e0b'; // Amber for Cable or IP Mismatch
        strokeDash = '6,3';
      } else if (isStpBlocked) {
        strokeColor = '#eab308'; // Amber for STP Blocked wire
        strokeDash = '5,4';
      } else if (link.cable === 'crossover') {
        strokeColor = '#eab308'; // yellow/amber dashed for crossover
        strokeDash = '6,4';
      } else if (link.cable === 'serial' || link.cable === 'serial_dte') {
        strokeColor = link.cable === 'serial' ? '#ec4899' : '#f43f5e'; // pink/rose for serial WAN
        strokeDash = '8,3';
      } else if (link.cable === 'fiber') {
        strokeColor = '#06b6d4'; // cyan for fiber optic
      } else if (link.cable === 'dac') {
        strokeColor = '#a855f7'; // purple for 10G/40G DAC Twinax
      } else if (link.cable === 'rollover') {
        strokeColor = '#38bdf8'; // light blue dashed console
        strokeDash = '3,3';
      } else if (link.cable === 'coaxial') {
        strokeColor = '#94a3b8'; // slate coaxial
      } else if (link.cable === 'phone') {
        strokeColor = '#10b981'; // emerald telephone line
      } else if (link.cable === 'usb') {
        strokeColor = '#6366f1'; // indigo USB console
      } else {
        strokeColor = '#3b82f6'; // blue for straight-through
      }

      if (link.id === selectedLinkId) {
        strokeColor = isLinkDown ? '#f87171' : '#38bdf8'; // bright highlight when selected
      }

      // Check if current simulation packet is traveling along this link
      const isSimulatingOnThisLink =
        currentSimStep &&
        ((currentSimStep.fromDeviceId === devA.id && currentSimStep.toDeviceId === devB.id) ||
          (currentSimStep.fromDeviceId === devB.id && currentSimStep.toDeviceId === devA.id));

      return {
        link,
        devA,
        devB,
        lineX1,
        lineY1,
        lineX2,
        lineY2,
        ledAx,
        ledAy,
        ledBx,
        ledBy,
        labelAx,
        labelAy,
        labelBx,
        labelBy,
        ledColorA,
        ledColorB,
        strokeColor,
        strokeDash,
        isLinkDown,
        isIpMismatch,
        isStpBlocked,
        isMismatch,
        isSimulatingOnThisLink,
        midX: (cAx + cBx) / 2,
        midY: (cAy + cBy) / 2,
      };
    });
  }, [devices, links, selectedLinkId, stpState, currentSimStep]);

  return (
    <>
      {/* Cable Lines & Badges */}
      {renderedLinks.map((rl) => {
        if (!rl) return null;
        return (
          <g key={rl.link.id} className="pointer-events-auto">
            {/* Invisible thicker stroke for easy clicking/selecting */}
            <line
              x1={rl.lineX1}
              y1={rl.lineY1}
              x2={rl.lineX2}
              y2={rl.lineY2}
              stroke="transparent"
              strokeWidth={14}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelectLink(rl.link.id);
                onSelectDevice(null);
              }}
            />

            {/* Visible Cable wire */}
            <line
              x1={rl.lineX1}
              y1={rl.lineY1}
              x2={rl.lineX2}
              y2={rl.lineY2}
              stroke={rl.strokeColor}
              strokeWidth={rl.link.id === selectedLinkId ? 3.5 : 2.5}
              strokeDasharray={rl.strokeDash}
              strokeLinecap="round"
              filter={rl.link.id === selectedLinkId ? 'url(#glow)' : undefined}
              className="cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onSelectLink(rl.link.id);
                onSelectDevice(null);
              }}
            />

            {/* Port A Status LED (10-12px outside card) */}
            <circle
              cx={rl.ledAx}
              cy={rl.ledAy}
              r={4.5}
              fill={rl.ledColorA}
              stroke="#090d16"
              strokeWidth={1.5}
            />
            {/* Port A Name Label */}
            <text
              x={rl.labelAx}
              y={rl.labelAy}
              fill="#94a3b8"
              fontSize={9}
              fontFamily="JetBrains Mono, monospace"
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none select-none font-semibold bg-slate-900"
            >
              {rl.link.fromPort}
            </text>

            {/* Port B Status LED */}
            <circle
              cx={rl.ledBx}
              cy={rl.ledBy}
              r={4.5}
              fill={rl.ledColorB}
              stroke="#090d16"
              strokeWidth={1.5}
            />
            {/* Port B Name Label */}
            <text
              x={rl.labelBx}
              y={rl.labelBy}
              fill="#94a3b8"
              fontSize={9}
              fontFamily="JetBrains Mono, monospace"
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none select-none font-semibold bg-slate-900"
            >
              {rl.link.toPort}
            </text>

            {/* Real-time Status Badges */}
            {/* 1. LINK DOWN Badge (Red - Admin Down or Carrier Loss) */}
            {rl.isLinkDown && (
              <g transform={`translate(${rl.midX}, ${rl.midY})`}>
                <rect
                  x={-42}
                  y={-11}
                  width={84}
                  height={22}
                  rx={11}
                  fill="#450a0a"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                />
                <text
                  x={0}
                  y={3.5}
                  fill="#fca5a5"
                  fontSize={9}
                  fontWeight="bold"
                  textAnchor="middle"
                  className="select-none font-mono tracking-tight"
                >
                  LINK DOWN
                </text>
              </g>
            )}

            {/* 2. STP BLK Badge (Amber - Spanning Tree Blocked) */}
            {!rl.isLinkDown && rl.isStpBlocked && (
              <g transform={`translate(${rl.midX}, ${rl.midY})`}>
                <rect
                  x={-34}
                  y={-10}
                  width={68}
                  height={20}
                  rx={10}
                  fill="#1e1b4b"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                />
                <text
                  x={0}
                  y={3}
                  fill="#f59e0b"
                  fontSize={10}
                  fontWeight="bold"
                  textAnchor="middle"
                  className="select-none font-mono"
                >
                  STP BLK
                </text>
              </g>
            )}

            {/* 3. Cable Mismatch Badge (Orange) */}
            {!rl.isLinkDown && !rl.isStpBlocked && rl.isMismatch && (
              <g transform={`translate(${rl.midX}, ${rl.midY})`}>
                <rect
                  x={-42}
                  y={-10}
                  width={84}
                  height={20}
                  rx={10}
                  fill="#451a03"
                  stroke="#f97316"
                  strokeWidth={1.5}
                />
                <text
                  x={0}
                  y={3}
                  fill="#fb923c"
                  fontSize={9}
                  fontWeight="bold"
                  textAnchor="middle"
                  className="select-none font-mono"
                >
                  MISMATCH
                </text>
              </g>
            )}

            {/* 4. IP Subnet Mismatch Badge (Amber) */}
            {!rl.isLinkDown && !rl.isStpBlocked && !rl.isMismatch && rl.isIpMismatch && (
              <g transform={`translate(${rl.midX}, ${rl.midY})`}>
                <rect
                  x={-46}
                  y={-10}
                  width={92}
                  height={20}
                  rx={10}
                  fill="#451a03"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                />
                <text
                  x={0}
                  y={3}
                  fill="#fde047"
                  fontSize={8.5}
                  fontWeight="bold"
                  textAnchor="middle"
                  className="select-none font-mono"
                >
                  IP MISMATCH
                </text>
              </g>
            )}

            {/* Animated Simulation Packet Travelling on Wire */}
            {rl.isSimulatingOnThisLink &&
              (currentSimStep?.status === 'drop' ? (
                <g transform={`translate(${rl.midX}, ${rl.midY})`}>
                  <circle
                    r={14}
                    fill="#ef4444"
                    fillOpacity={0.25}
                    stroke="#ef4444"
                    strokeWidth={2}
                    className="animate-ping"
                  />
                  <circle r={9} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />
                  <text
                    x={0}
                    y={3.5}
                    fill="#ffffff"
                    fontSize={11}
                    fontWeight="bold"
                    textAnchor="middle"
                    className="select-none font-mono"
                  >
                    ✕
                  </text>
                </g>
              ) : (
                <circle
                  r={6}
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth={2}
                  filter="url(#glow)"
                >
                  <animateMotion
                    path={`M ${rl.lineX1} ${rl.lineY1} L ${rl.lineX2} ${rl.lineY2}`}
                    dur="0.8s"
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
          </g>
        );
      })}

      {/* Rubber-band cabling wire */}
      {rubberBand && (
        <line
          x1={rubberBand.x1}
          y1={rubberBand.y1}
          x2={rubberBand.x2}
          y2={rubberBand.y2}
          stroke="#38bdf8"
          strokeWidth={2}
          strokeDasharray="4,4"
          className="animate-pulse"
        />
      )}
    </>
  );
};
