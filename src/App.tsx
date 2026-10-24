import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Device,
  DeviceConfig,
  Link,
  CableType,
  DeviceType,
  DeviceWindowState,
  SimulationStep,
  StpTopologyState,
} from './types/network';
import { createDevice, validateCabling } from './engine/deviceSpecs';
import { calculatePvst } from './engine/stpEngine';
import { tileWindows, cascadeWindows } from './utils/windowLayout';
import { LAB_SCENARIOS } from './data/labs';
import { deepClone } from './utils/deepClone';

// Components
import { Canvas } from './components/Canvas';
import { DevicePalette } from './components/DevicePalette';
import { DeviceInspector } from './components/DeviceInspector';
import { TopBar } from './components/TopBar';
import { WindowManagerBar } from './components/WindowManagerBar';
import { SimulationBar } from './components/SimulationBar';
import { PacketInspectorModal } from './components/PacketInspectorModal';
import { SubnetCalculatorModal } from './components/SubnetCalculatorModal';
import { LabGuideModal } from './components/LabGuideModal';
import { LabAssessmentHud } from './components/LabAssessmentHud';
import { PresetsModal } from './components/PresetsModal';
import { AiDiagramModal } from './components/AiDiagramModal';
import { NocIncidentModal } from './components/NocIncidentModal';
import { SocraticMentorModal } from './components/SocraticMentorModal';
import { AboutLegalModal } from './components/AboutLegalModal';
import { TextToTopologyModal } from './components/TextToTopologyModal';
import { WhiteboardScanModal } from './components/WhiteboardScanModal';
import { MascotGuideModal } from './components/MascotGuideModal';
import { ChaosBattleModal, ChaosChallenge } from './components/ChaosBattleModal';
import { VirtualClockTelemetryBar } from './components/VirtualClockTelemetryBar';
import { CommandReferenceModal } from './components/CommandReferenceModal';
import { SpeedrunModal } from './components/SpeedrunModal';
import { NetGremlinWidget } from './components/NetGremlinWidget';
import { audioEngine } from './utils/audioEffects';
import { workerBridge } from './engine/workerBridge';
import { IncidentScenario } from './data/incidentScenarios';
import { X, Flame, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Open with Empty Canvas
  const [devices, setDevices] = useState<Device[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Undo / Redo Topology History (bounded to max 30 states to prevent memory bloat)
  const MAX_HISTORY_DEPTH = 30;
  const [history, setHistory] = useState<{ devices: Device[]; links: Link[] }[]>([
    { devices: [], links: [] },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = useCallback(
    (newDevices: Device[], newLinks: Link[]) => {
      let next = history.slice(0, historyIndex + 1);
      next.push({
        devices: deepClone(newDevices),
        links: deepClone(newLinks),
      });
      if (next.length > MAX_HISTORY_DEPTH) {
        next = next.slice(next.length - MAX_HISTORY_DEPTH);
      }
      setHistory(next);
      setHistoryIndex(next.length - 1);
    },
    [history, historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setDevices(deepClone(prev.devices));
      setLinks(deepClone(prev.links));
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setDevices(deepClone(next.devices));
      setLinks(deepClone(next.links));
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Selections
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  // Cabling Tool State
  const [activeCableType, setActiveCableType] = useState<CableType | null>(null);
  const [cableSource, setCableSource] = useState<{ deviceId: string; port: string } | null>(
    null
  );

  // Window Management State
  const [deviceWindows, setDeviceWindows] = useState<Record<string, DeviceWindowState>>({});

  // Simulation State
  const [simulationSteps, setSimulationSteps] = useState<SimulationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [packetHistory, setPacketHistory] = useState<
    { id: string; label: string; count: number; steps: SimulationStep[] }[]
  >([]);

  // Modals
  const [showLabsModal, setShowLabsModal] = useState<boolean>(false);
  const [showPresetsModal, setShowPresetsModal] = useState<boolean>(false);
  const [showSubnetModal, setShowSubnetModal] = useState<boolean>(false);
  const [showPacketModal, setShowPacketModal] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [showNocModal, setShowNocModal] = useState<boolean>(false);
  const [showSocraticModal, setShowSocraticModal] = useState<boolean>(false);
  const [showLegalModal, setShowLegalModal] = useState<boolean>(false);
  const [showTextToTopologyModal, setShowTextToTopologyModal] = useState<boolean>(false);
  const [showWhiteboardScanModal, setShowWhiteboardScanModal] = useState<boolean>(false);
  const [showMascotModal, setShowMascotModal] = useState<boolean>(true); // Open mascot tutorial on startup!
  const [showChaosModal, setShowChaosModal] = useState<boolean>(false);
  const [showCommandsModal, setShowCommandsModal] = useState<boolean>(false);
  const [showSpeedrunModal, setShowSpeedrunModal] = useState<boolean>(false);
  const [showGremlinWidget, setShowGremlinWidget] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(() => audioEngine.getMuted());

  // Active Incident Scenario
  const [activeIncident, setActiveIncident] = useState<IncidentScenario | null>(null);
  // Active Lab Scenario
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDeployIncident = (incident: IncidentScenario) => {
    const topo = incident.initialTopology();
    setDevices(topo.devices);
    setLinks(topo.links);
    setActiveIncident(incident);
    audioEngine.playAlarmChime();
    setSimulationSteps([]);
    setSelectedDeviceId(null);
    setSelectedLinkId(null);
    pushHistory(topo.devices, topo.links);
  };

  const handleDeployGeneratedTopology = (
    newDevices: Device[],
    newLinks: Link[],
    _title: string,
    mode: 'replace' | 'append'
  ) => {
    if (mode === 'replace') {
      setDevices(newDevices);
      setLinks(newLinks);
      setDeviceWindows({});
      setSimulationSteps([]);
      setActiveIncident(null);
      setSelectedDeviceId(null);
      setSelectedLinkId(null);
      pushHistory(newDevices, newLinks);
    } else {
      const offsetX = 80;
      const offsetY = 80;
      const shiftedDevices = newDevices.map((d) => ({
        ...d,
        id: `gen_${d.id}_${Date.now()}`,
        x: d.x + offsetX,
        y: d.y + offsetY,
      }));
      const idMap = new Map<string, string>();
      newDevices.forEach((d, i) => idMap.set(d.id, shiftedDevices[i].id));
      const shiftedLinks = newLinks.map((l, i) => ({
        ...l,
        id: `gen_lnk_${i}_${Date.now()}`,
        fromDevice: idMap.get(l.fromDevice) || l.fromDevice,
        toDevice: idMap.get(l.toDevice) || l.toDevice,
      }));

      const combinedDevs = [...devices, ...shiftedDevices];
      const combinedLinks = [...links, ...shiftedLinks];
      setDevices(combinedDevs);
      setLinks(combinedLinks);
      pushHistory(combinedDevs, combinedLinks);
    }
  };

  // Active Chaos Battle Scenario
  const [activeChaosChallenge, setActiveChaosChallenge] = useState<ChaosChallenge | null>(null);
  const [chaosTimeLeft, setChaosTimeLeft] = useState<number>(300);
  const [chaosIsCompleted, setChaosIsCompleted] = useState<boolean>(false);
  const [chaosScoreEarned, setChaosScoreEarned] = useState<number>(0);
  const [chaosFeedbackMessage, setChaosFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const chaosStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeChaosChallenge || chaosIsCompleted) return;
    if (!chaosStartTimeRef.current) {
      chaosStartTimeRef.current = Date.now();
    }
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (chaosStartTimeRef.current || Date.now())) / 1000);
      const remaining = Math.max(0, 300 - elapsed);
      setChaosTimeLeft(remaining);
      if (remaining <= 0) {
        setChaosFeedbackMessage({
          type: 'error',
          text: 'SLA Expired! Outage exceeded SLA window. Reset challenge to try again.',
        });
      }
    }, 500);
    return () => clearInterval(timer);
  }, [activeChaosChallenge, chaosIsCompleted]);

  const handleStartChaosChallenge = (challenge: ChaosChallenge) => {
    const topo = challenge.initialTopology();
    setDevices(topo.devices);
    setLinks(topo.links);
    setDeviceWindows({});
    setSimulationSteps([]);
    setActiveIncident(null);
    setSelectedDeviceId(null);
    setSelectedLinkId(null);
    pushHistory(topo.devices, topo.links);

    setActiveChaosChallenge(challenge);
    audioEngine.playAlarmChime();
    chaosStartTimeRef.current = Date.now();
    setChaosTimeLeft(300);
    setChaosIsCompleted(false);
    setChaosScoreEarned(0);
    setChaosFeedbackMessage(null);
    setShowChaosModal(false); // Close modal so student can immediately troubleshoot on canvas
  };

  const handleVerifyChaosFix = () => {
    if (!activeChaosChallenge) return;
    const passed = activeChaosChallenge.validator(devices);
    if (passed) {
      audioEngine.playVictoryFanfare();
      const bonus = Math.round(chaosTimeLeft * 1.5);
      const base =
        activeChaosChallenge.difficulty === 'Junior'
          ? 500
          : activeChaosChallenge.difficulty === 'Senior'
          ? 1000
          : 2000;
      const totalScore = base + bonus;
      setChaosIsCompleted(true);
      setChaosScoreEarned(totalScore);
      setChaosFeedbackMessage({
        type: 'success',
        text: `Remediation Verified! You earned +${totalScore} XP PTS!`,
      });
      setShowChaosModal(true); // Open modal to celebrate victory
    } else {
      audioEngine.playPing(false);
      setChaosFeedbackMessage({
        type: 'error',
        text: 'Fault still present! Inspect device configs and network states.',
      });
    }
  };

  const handleResetChaosChallenge = () => {
    if (!activeChaosChallenge) return;
    handleStartChaosChallenge(activeChaosChallenge);
  };

  const handleExitChaosChallenge = () => {
    setActiveChaosChallenge(null);
    setChaosIsCompleted(false);
    setChaosScoreEarned(0);
    setChaosFeedbackMessage(null);
  };

  // STP & OSPF Engine: Asynchronously solved off-thread in Web Worker (PVST+)
  const [stpState, setStpState] = useState<StpTopologyState>(() => calculatePvst(devices, links));

  useEffect(() => {
    let isSubscribed = true;
    workerBridge.solveTopology(devices, links).then((res) => {
      if (isSubscribed) {
        setStpState(res.stpState);
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, [devices, links]);

  // Simulation step playback timer
  useEffect(() => {
    let timer: any;
    if (isSimPlaying && simulationSteps.length > 0) {
      timer = setInterval(() => {
        setCurrentStepIndex((curr) => {
          if (curr >= simulationSteps.length - 1) {
            setIsSimPlaying(false);
            const lastStep = simulationSteps[simulationSteps.length - 1];
            if (lastStep?.status === 'success' || lastStep?.status === 'reply') {
              audioEngine.playPing(true);
            } else if (lastStep?.status === 'drop') {
              audioEngine.playPing(false);
            }
            return curr;
          }
          const nextIdx = curr + 1;
          const nextStep = simulationSteps[nextIdx];
          if (nextStep?.status === 'forward' || nextStep?.status === 'broadcast') {
            audioEngine.playKeyClick();
          }
          return nextIdx;
        });
      }, Math.round(1000 / simSpeed));
    }
    return () => clearInterval(timer);
  }, [isSimPlaying, simulationSteps, simSpeed]);

  // Open Device Inspector Window
  const handleOpenDevice = (deviceId: string) => {
    const existing = deviceWindows[deviceId];
    if (existing) {
      setDeviceWindows({
        ...deviceWindows,
        [deviceId]: {
          ...existing,
          minimized: false,
          zIndex: Date.now(),
        },
      });
      return;
    }

    const openCount = Object.keys(deviceWindows).length;
    const newWin: DeviceWindowState = {
      id: `win_${deviceId}`,
      deviceId,
      x: 320 + (openCount * 30) % 200,
      y: 70 + (openCount * 30) % 150,
      width: 620,
      height: 480,
      minimized: false,
      maximized: false,
      zIndex: Date.now(),
      activeTab: 'cli',
    };

    setDeviceWindows({
      ...deviceWindows,
      [deviceId]: newWin,
    });
  };

  const handleCloseWindow = (winId: string) => {
    const next = { ...deviceWindows };
    delete next[winId.replace('win_', '')];
    setDeviceWindows(next);
  };

  const handleUpdateWindowState = (id: string, updates: Partial<DeviceWindowState>) => {
    const key = id.replace('win_', '');
    if (deviceWindows[key]) {
      setDeviceWindows({
        ...deviceWindows,
        [key]: { ...deviceWindows[key], ...updates },
      });
    }
  };

  // Add Device
  const handleAddDevice = (type: DeviceType) => {
    const count = devices.filter((d) => d.type === type).length;
    const prefixMap: Record<DeviceType, string> = {
      router: 'Router',
      router4331: 'ISR4331-',
      router1941: 'ISR1941-',
      switch: 'Switch',
      switch2960_48: 'SW2960-48-',
      switch3560: 'SW3560-',
      switch3850: 'SW3850-',
      switch9300: 'Cat9300-',
      l3switch: 'Core3650-',
      nexus9000: 'Nexus9K-',
      arista_7050: 'Arista7050-',
      juniper_ex: 'EX4300-',
      juniper_vsrx: 'vSRX-',
      linux_router: 'LinuxRouter-',
      mikrotik_router: 'MikroTik-',
      firewall: 'ASA-',
      firepower: 'FTD-',
      wlc: 'WLC-',
      ap: 'AP-',
      home_router: 'HomeGW-',
      cloud: 'ISP-Cloud',
      mpls_cloud: 'MPLS-Core',
      modem: 'Modem',
      pc: 'PC',
      laptop: 'Laptop',
      server: 'Server',
      ipphone: 'IPPhone',
      printer: 'Printer',
      iot_sensor: 'IoT-Sensor-',
      iot_gateway: 'IoT-GW-',
    };
    const prefix = prefixMap[type] || 'Dev';
    const name = `${prefix}${count}`;

    // Calculate non-overlapping position within screen bounds
    let x = 240;
    let y = 100;
    let attempts = 0;
    const cardWidth = 190;
    const cardHeight = 130;
    const maxX = 1300;
    const maxY = 850;

    while (attempts < 50) {
      const isOverlap = devices.some(
        (d) => Math.abs(d.x - x) < cardWidth && Math.abs(d.y - y) < cardHeight
      );
      if (!isOverlap && x <= maxX && y <= maxY) break;
      x += 210;
      if (x > maxX) {
        x = 240;
        y += 150;
        if (y > maxY) {
          y = 100 + (attempts % 3) * 30;
          x = 240 + (attempts % 4) * 40;
        }
      }
      attempts++;
    }

    x = Math.max(220, Math.min(x, maxX));
    y = Math.max(80, Math.min(y, maxY));

    const newDev = createDevice(type, name, x, y);
    const nextDevices = [...devices, newDev];
    setDevices(nextDevices);
    pushHistory(nextDevices, links);
  };

  // Move Device
  const handleMoveDevice = (id: string, x: number, y: number) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, x, y } : d))
    );
  };

  // Delete Selected Device or Cable
  const handleDeleteSelected = useCallback(() => {
    if (selectedDeviceId) {
      const nextDevices = devices.filter((d) => d.id !== selectedDeviceId);
      const nextLinks = links.filter(
        (l) => l.fromDevice !== selectedDeviceId && l.toDevice !== selectedDeviceId
      );
      setDevices(nextDevices);
      setLinks(nextLinks);
      setSelectedDeviceId(null);
      handleCloseWindow(`win_${selectedDeviceId}`);
      pushHistory(nextDevices, nextLinks);
    } else if (selectedLinkId) {
      const nextLinks = links.filter((l) => l.id !== selectedLinkId);
      setLinks(nextLinks);
      setSelectedLinkId(null);
      pushHistory(devices, nextLinks);
    }
  }, [selectedDeviceId, selectedLinkId, devices, links, pushHistory]);

  // Clear workspace
  const handleClearAll = () => {
    setDevices([]);
    setLinks([]);
    setSelectedDeviceId(null);
    setSelectedLinkId(null);
    setDeviceWindows({});
    setSimulationSteps([]);
    setActiveLabId(null);
    setActiveIncident(null);
    pushHistory([], []);
  };

  // Cabling Flow
  const handleStartCabling = (deviceId: string, port: string) => {
    setCableSource({ deviceId, port });
  };

  const handleCompleteCabling = (targetDeviceId: string, targetPort: string) => {
    if (!cableSource || !activeCableType) return;
    if (cableSource.deviceId === targetDeviceId) return;

    const devA = devices.find((d) => d.id === cableSource.deviceId);
    const devB = devices.find((d) => d.id === targetDeviceId);
    if (!devA || !devB) return;

    // Validate and resolve cable type
    const validation = validateCabling(
      devA,
      cableSource.port,
      devB,
      targetPort,
      activeCableType
    );

    const resolvedCable =
      activeCableType === 'auto' ? validation.recommendedCable : activeCableType;

    const newLink: Link = {
      id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fromDevice: cableSource.deviceId,
      fromPort: cableSource.port,
      toDevice: targetDeviceId,
      toPort: targetPort,
      cable: resolvedCable,
      resolvedCable,
      isMismatch: !validation.valid,
    };

    const nextLinks = [...links, newLink];
    setLinks(nextLinks);
    pushHistory(devices, nextLinks);

    setCableSource(null);
    setActiveCableType(null);
  };

  const handleCancelCabling = useCallback(() => {
    setCableSource(null);
    setActiveCableType(null);
  }, []);

  // Desktop Keyboard Shortcuts (Ctrl+Z Undo, Ctrl+Y Redo, Delete, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        (modKey && e.key.toLowerCase() === 'y') ||
        (modKey && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDeviceId || selectedLinkId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key === 'Escape') {
        if (cableSource || activeCableType) {
          handleCancelCabling();
        } else if (selectedDeviceId || selectedLinkId) {
          setSelectedDeviceId(null);
          setSelectedLinkId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    handleCancelCabling,
    selectedDeviceId,
    selectedLinkId,
    cableSource,
    activeCableType,
  ]);

  // Toggle Link State (Simulate Link Failure / Restore)
  const handleToggleLinkState = (linkId: string) => {
    const link = links.find((l) => l.id === linkId);
    if (!link) return;
    audioEngine.playRelayClick();

    const devA = devices.find((d) => d.id === link.fromDevice);
    const devB = devices.find((d) => d.id === link.toDevice);
    if (!devA || !devB) return;

    const ifaceA = devA.config.interfaces[link.fromPort];
    const ifaceB = devB.config.interfaces[link.toPort];

    // If either interface is down, restore both to 'up'; otherwise down both to 'down'
    const newStatus: 'up' | 'down' = (ifaceA?.status === 'down' || ifaceB?.status === 'down') ? 'up' : 'down';

    setDevices((prev) =>
      prev.map((d) => {
        if (d.id === devA.id) {
          const ifaces = { ...d.config.interfaces };
          if (ifaces[link.fromPort]) {
            ifaces[link.fromPort] = { ...ifaces[link.fromPort], status: newStatus };
          }
          return { ...d, config: { ...d.config, interfaces: ifaces } };
        }
        if (d.id === devB.id) {
          const ifaces = { ...d.config.interfaces };
          if (ifaces[link.toPort]) {
            ifaces[link.toPort] = { ...ifaces[link.toPort], status: newStatus };
          }
          return { ...d, config: { ...d.config, interfaces: ifaces } };
        }
        return d;
      })
    );
  };

  // Update Device Configuration from Inspector
  const handleUpdateDeviceConfig = (deviceId: string, config: DeviceConfig) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, config } : d))
    );
  };

  // Run ICMP Ping Simulation (Offloaded to Web Worker)
  const handleRunPingSim = async (srcDeviceId: string, dstIp: string) => {
    const sim = await workerBridge.simulatePingAsync(srcDeviceId, dstIp, devices, links);
    if (sim.steps.length > 0) {
      setSimulationSteps(sim.steps);
      setCurrentStepIndex(0);
      setIsSimPlaying(true);
      const srcName = devices.find((d) => d.id === srcDeviceId)?.name || 'Host';
      const historyItem = {
        id: `sim_ping_${Date.now()}`,
        label: `Ping: ${srcName} → ${dstIp}`,
        count: sim.steps.length,
        steps: sim.steps,
      };
      setPacketHistory((prev) => [historyItem, ...prev.slice(0, 9)]);
    }
  };

  // Run DHCP DORA Simulation (Offloaded to Web Worker)
  const handleRunDhcpSim = async (clientDeviceId: string) => {
    const sim = await workerBridge.simulateDhcpAsync(clientDeviceId, devices, links);
    if (sim.steps.length > 0) {
      setSimulationSteps(sim.steps);
      setCurrentStepIndex(0);
      setIsSimPlaying(true);
      const clientName = devices.find((d) => d.id === clientDeviceId)?.name || 'Client';
      const historyItem = {
        id: `sim_dhcp_${Date.now()}`,
        label: `DHCP: ${clientName} DORA`,
        count: sim.steps.length,
        steps: sim.steps,
      };
      setPacketHistory((prev) => [historyItem, ...prev.slice(0, 9)]);

      if (sim.allocatedConfig) {
        const client = devices.find((d) => d.id === clientDeviceId);
        if (client) {
          const ifaces = { ...client.config.interfaces };
          const firstKey = Object.keys(ifaces)[0];
          if (firstKey) {
            ifaces[firstKey] = {
              ...ifaces[firstKey],
              ip: sim.allocatedConfig.ip,
              mask: sim.allocatedConfig.mask,
            };
          }
          handleUpdateDeviceConfig(clientDeviceId, {
            ...client.config,
            interfaces: ifaces,
            defaultGateway: sim.allocatedConfig.gateway,
            dnsServer: sim.allocatedConfig.dns,
          });
        }
      }
    }
  };

  // Export Topology as Vector SVG Diagram
  const handleExportSvg = () => {
    if (devices.length === 0) return;
    const minX = Math.min(...devices.map((d) => d.x)) - 60;
    const minY = Math.min(...devices.map((d) => d.y)) - 60;
    const maxX = Math.max(...devices.map((d) => d.x + 160)) + 60;
    const maxY = Math.max(...devices.map((d) => d.y + 100)) + 60;
    const width = Math.max(900, maxX - minX);
    const height = Math.max(600, maxY - minY);

    const linkElements = links
      .map((l) => {
        const fromDev = devices.find((d) => d.id === l.fromDevice);
        const toDev = devices.find((d) => d.id === l.toDevice);
        if (!fromDev || !toDev) return '';
        const x1 = fromDev.x + 75;
        const y1 = fromDev.y + 35;
        const x2 = toDev.x + 75;
        const y2 = toDev.y + 35;
        const strokeColor = l.isMismatch ? '#ef4444' : '#38bdf8';
        const strokeDash = l.cable === 'crossover' ? 'stroke-dasharray="6,4"' : '';
        return `
          <line x1="${x1 - minX}" y1="${y1 - minY}" x2="${x2 - minX}" y2="${y2 - minY}" stroke="${strokeColor}" stroke-width="2.5" ${strokeDash} opacity="0.85" />
          <text x="${(x1 + x2) / 2 - minX}" y="${(y1 + y2) / 2 - minY - 6}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">${l.fromPort} ↔ ${l.toPort}</text>
        `;
      })
      .join('');

    const deviceElements = devices
      .map((d) => {
        const posX = d.x - minX;
        const posY = d.y - minY;
        const firstIp = Object.values(d.config.interfaces).find((i) => i.ip)?.ip || '';
        return `
          <g transform="translate(${posX}, ${posY})">
            <rect width="150" height="70" rx="10" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
            <rect x="0" y="0" width="150" height="24" rx="10" fill="#1e293b" />
            <text x="12" y="16" fill="#f8fafc" font-family="sans-serif" font-size="11" font-weight="bold">${d.name}</text>
            <text x="12" y="42" fill="#38bdf8" font-family="monospace" font-size="10">${d.type.toUpperCase()}</text>
            ${firstIp ? `<text x="12" y="58" fill="#10b981" font-family="monospace" font-size="10">${firstIp}</text>` : ''}
          </g>
        `;
      })
      .join('');

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="#020617"/>
  <rect width="100%" height="100%" fill="url(#grid)" opacity="0.6"/>
  <g id="links">
    ${linkElements}
  </g>
  <g id="devices">
    ${deviceElements}
  </g>
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WireCraft_Topology_${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Lab Topology to JSON file
  const handleExportLab = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      devices,
      links,
      deviceWindows,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WireCraft_Lab_Topology_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import Lab Topology from JSON file
  const handleImportLab = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Lab file size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed || !Array.isArray(parsed.devices) || parsed.devices.length > 200 || !Array.isArray(parsed.links) || parsed.links.length > 500) {
          setErrorMessage('Invalid Lab JSON file format or exceeds device (200) / link (500) limits.');
          return;
        }

        for (const d of parsed.devices) {
          if (!d || typeof d.id !== 'string' || typeof d.type !== 'string' || !d.config) {
            setErrorMessage('Invalid device object structure in lab file.');
            return;
          }
        }

        for (const l of parsed.links) {
          if (!l || typeof l.fromDevice !== 'string' || typeof l.toDevice !== 'string') {
            setErrorMessage('Invalid link object structure in lab file.');
            return;
          }
        }

        setDevices(parsed.devices);
        setLinks(parsed.links);
        if (parsed.deviceWindows && typeof parsed.deviceWindows === 'object') {
          setDeviceWindows(parsed.deviceWindows);
        } else {
          setDeviceWindows({});
        }
        pushHistory(parsed.devices, parsed.links);
        setSimulationSteps([]);
        setSelectedDeviceId(null);
        setSelectedLinkId(null);
      } catch (err) {
        setErrorMessage('Failed to parse Lab JSON file. Please ensure it is valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Window Tile & Cascade actions
  const handleTileWindows = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const tiled = tileWindows(deviceWindows, width, height, 'grid');
    setDeviceWindows(tiled);
  };

  const handleCascadeWindows = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const cascaded = cascadeWindows(deviceWindows, width, height);
    setDeviceWindows(cascaded);
  };

  const handleMinimizeAll = () => {
    const updated: Record<string, DeviceWindowState> = {};
    for (const [id, win] of Object.entries(deviceWindows)) {
      updated[id] = { ...win, minimized: true };
    }
    setDeviceWindows(updated);
  };

  const handleToggleWindow = (id: string) => {
    const key = id.replace('win_', '');
    if (deviceWindows[key]) {
      setDeviceWindows({
        ...deviceWindows,
        [key]: {
          ...deviceWindows[key],
          minimized: !deviceWindows[key].minimized,
          zIndex: Date.now(),
        },
      });
    }
  };

  const currentSimStep =
    simulationSteps.length > 0 ? simulationSteps[currentStepIndex] : null;

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Navigation & Action Bar */}
      <TopBar
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenLabs={() => setShowLabsModal(true)}
        onOpenNoc={() => setShowNocModal(true)}
        onOpenSocratic={() => setShowSocraticModal(true)}
        onOpenPresets={() => setShowPresetsModal(true)}
        onOpenSubnetCalc={() => setShowSubnetModal(true)}
        onOpenPacketInspector={() => setShowPacketModal(true)}
        onOpenAiStudio={() => setShowAiModal(true)}
        onOpenTextToTopology={() => setShowTextToTopologyModal(true)}
        onOpenWhiteboardScan={() => setShowWhiteboardScanModal(true)}
        onTileWindows={handleTileWindows}
        onCascadeWindows={handleCascadeWindows}
        onExportLab={handleExportLab}
        onExportSvg={handleExportSvg}
        onImportLab={handleImportLab}
        simulationStepCount={simulationSteps.length}
        activeIncidentTitle={activeIncident?.title}
        onOpenLegal={() => setShowLegalModal(true)}
        onOpenMascot={() => setShowMascotModal(true)}
        onOpenChaos={() => setShowChaosModal(true)}
        onOpenCommands={() => setShowCommandsModal(true)}
        onOpenSpeedrun={() => setShowSpeedrunModal(true)}
        onOpenGremlin={() => setShowGremlinWidget((prev) => !prev)}
        isMuted={isAudioMuted}
        onToggleMute={() => {
          const next = audioEngine.toggleMute();
          setIsAudioMuted(next);
        }}
      />

      {/* Main Workspace: Palette Sidebar + Infinite Canvas */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Active Incident Outage Banner */}
        {activeIncident && !activeChaosChallenge && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-slate-950/90 border border-amber-500/40 backdrop-blur-xl px-3 py-1.5 rounded-lg shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-[11px] font-mono font-semibold text-amber-400">
                {activeIncident.ticketId}
              </span>
              <span className="text-xs font-medium text-white truncate max-w-[200px]">
                {activeIncident.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
              <button
                onClick={() => setShowNocModal(true)}
                className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold cursor-pointer transition-colors"
              >
                Triage
              </button>
              <button
                onClick={() => setActiveIncident(null)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 cursor-pointer transition-colors"
                title="Clear Incident Banner"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Active Chaos Battle Outage HUD */}
        {activeChaosChallenge && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-slate-950/95 border border-orange-500/40 backdrop-blur-xl px-3 py-1.5 rounded-lg shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-orange-500/20 text-orange-400">
                <Flame className="w-3.5 h-3.5 animate-pulse" />
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">
                  Chaos: {activeChaosChallenge.title}
                </span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold border ${
                    chaosTimeLeft <= 60
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {Math.floor(chaosTimeLeft / 60)}:
                  {(chaosTimeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
              {!chaosIsCompleted && (
                <button
                  onClick={handleVerifyChaosFix}
                  className="px-2 py-0.5 rounded bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Verify
                </button>
              )}
              <button
                onClick={() => setShowChaosModal(true)}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium cursor-pointer transition-colors"
              >
                Briefing
              </button>
              <button
                onClick={handleExitChaosChallenge}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 cursor-pointer transition-colors"
                title="End Chaos Challenge"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <DevicePalette
          onAddDevice={handleAddDevice}
          activeCableType={activeCableType}
          onSelectCableType={setActiveCableType}
          onDeleteSelected={handleDeleteSelected}
          onClearAll={handleClearAll}
          isCollapsed={!isSidebarOpen}
          onToggleCollapse={() => setIsSidebarOpen((prev) => !prev)}
        />

        <Canvas
          devices={devices}
          links={links}
          selectedDeviceId={selectedDeviceId}
          selectedLinkId={selectedLinkId}
          activeCableType={activeCableType}
          cableSource={cableSource}
          stpState={stpState}
          currentSimStep={currentSimStep}
          onSelectDevice={setSelectedDeviceId}
          onSelectLink={setSelectedLinkId}
          onMoveDevice={handleMoveDevice}
          onOpenDevice={handleOpenDevice}
          onStartCabling={handleStartCabling}
          onCompleteCabling={handleCompleteCabling}
          onCancelCabling={handleCancelCabling}
          onDeleteSelected={handleDeleteSelected}
          onToggleLinkState={handleToggleLinkState}
        />

        {/* Step Simulation Control Bar */}
        <SimulationBar
          simulationSteps={simulationSteps}
          currentStepIndex={currentStepIndex}
          isPlaying={isSimPlaying}
          playbackSpeed={simSpeed}
          onSpeedChange={setSimSpeed}
          packetHistory={packetHistory}
          onSelectHistoryItem={(id) => {
            const item = packetHistory.find((p) => p.id === id);
            if (item) {
              setSimulationSteps(item.steps);
              setCurrentStepIndex(0);
              setIsSimPlaying(false);
            }
          }}
          onPlay={() => setIsSimPlaying(true)}
          onPause={() => setIsSimPlaying(false)}
          onStepForward={() =>
            setCurrentStepIndex((c) => Math.min(simulationSteps.length - 1, c + 1))
          }
          onStepBackward={() => setCurrentStepIndex((c) => Math.max(0, c - 1))}
          onReset={() => {
            setIsSimPlaying(false);
            setSimulationSteps([]);
            setCurrentStepIndex(0);
          }}
          onOpenInspector={() => setShowPacketModal(true)}
        />

        {/* Floating Multi-Windows (CLI / Device Inspectors) */}
        {Object.values(deviceWindows).map((winState) => {
          const dev = devices.find((d) => d.id === winState.deviceId);
          if (!dev) return null;

          return (
            <DeviceInspector
              key={winState.id}
              device={dev}
              allDevices={devices}
              allLinks={links}
              windowState={winState}
              onUpdateWindowState={handleUpdateWindowState}
              onClose={handleCloseWindow}
              onUpdateDeviceConfig={handleUpdateDeviceConfig}
              onRunPingSim={handleRunPingSim}
              onRunDhcpSim={handleRunDhcpSim}
            />
          );
        })}

        {/* Virtual Clock & Web Worker Telemetry HUD */}
        <VirtualClockTelemetryBar />
      </div>

      {/* Bottom Desktop Taskbar */}
      <WindowManagerBar
        windows={deviceWindows}
        devices={devices}
        onToggleWindow={handleToggleWindow}
        onMinimizeAll={handleMinimizeAll}
        onOpenLegal={() => setShowLegalModal(true)}
      />

      {/* Modals */}
      {showLabsModal && (
        <LabGuideModal
          devices={devices}
          links={links}
          onLoadTopology={(newDevs, newLinks, labId) => {
            setDevices(newDevs);
            setLinks(newLinks);
            if (labId) setActiveLabId(labId);
            pushHistory(newDevs, newLinks);
            setShowLabsModal(false);
          }}
          onClose={() => setShowLabsModal(false)}
        />
      )}

      {/* Active Guided Lab Assessment HUD */}
      {activeLabId && (
        <LabAssessmentHud
          activeLabId={activeLabId}
          devices={devices}
          links={links}
          onResetLab={() => {
            const lab = LAB_SCENARIOS.find((l) => l.id === activeLabId);
            if (lab) {
              const topo = lab.initialTopology();
              setDevices(topo.devices);
              setLinks(topo.links);
              pushHistory(topo.devices, topo.links);
            }
          }}
          onOpenLabGuide={() => setShowLabsModal(true)}
          onCloseLab={() => setActiveLabId(null)}
        />
      )}

      {showPresetsModal && (
        <PresetsModal
          onLoadTopology={(newDevs, newLinks) => {
            setDevices(newDevs);
            setLinks(newLinks);
            pushHistory(newDevs, newLinks);
          }}
          onExportLab={handleExportLab}
          onImportLab={handleImportLab}
          onClose={() => setShowPresetsModal(false)}
        />
      )}

      {showSubnetModal && (
        <SubnetCalculatorModal onClose={() => setShowSubnetModal(false)} />
      )}

      {showPacketModal && (
        <PacketInspectorModal
          step={currentSimStep}
          allSteps={simulationSteps}
          currentStepIndex={currentStepIndex}
          onSelectStepIndex={(idx) => setCurrentStepIndex(idx)}
          onClose={() => setShowPacketModal(false)}
        />
      )}

      {showAiModal && <AiDiagramModal onClose={() => setShowAiModal(false)} />}

      {/* NOC Real-World Incidents & AI TAC Modal */}
      {showNocModal && (
        <NocIncidentModal
          isOpen={showNocModal}
          onClose={() => setShowNocModal(false)}
          devices={devices}
          links={links}
          activeIncident={activeIncident}
          onDeployIncident={handleDeployIncident}
          onClearIncident={() => setActiveIncident(null)}
          onOpenDevice={handleOpenDevice}
        />
      )}

      {/* AI Socratic Troubleshooting Mentor Modal */}
      <SocraticMentorModal
        isOpen={showSocraticModal}
        onClose={() => setShowSocraticModal(false)}
        topologyContext={{ deviceCount: devices.length, linkCount: links.length }}
      />

      {/* Legal & Trademark Disclaimers Modal */}
      <AboutLegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
      />

      {/* AI & Offline Text-to-Topology Lab Architect Modal */}
      <TextToTopologyModal
        isOpen={showTextToTopologyModal}
        onClose={() => setShowTextToTopologyModal(false)}
        onDeployTopology={handleDeployGeneratedTopology}
        onSwitchToWhiteboardScanner={() => setShowWhiteboardScanModal(true)}
      />

      {/* AI Whiteboard & Diagram Scanner with Pre-Flight Review Modal */}
      <WhiteboardScanModal
        isOpen={showWhiteboardScanModal}
        onClose={() => setShowWhiteboardScanModal(false)}
        onDeployTopology={handleDeployGeneratedTopology}
        onSwitchToTextArchitect={() => setShowTextToTopologyModal(true)}
      />

      {/* Packet Pete Tutorial Mascot Modal */}
      <MascotGuideModal
        isOpen={showMascotModal}
        onClose={() => setShowMascotModal(false)}
        onOpenTextToTopology={() => setShowTextToTopologyModal(true)}
        onOpenWhiteboardScan={() => setShowWhiteboardScanModal(true)}
        onOpenLabs={() => setShowLabsModal(true)}
        onOpenSocratic={() => setShowSocraticModal(true)}
        onOpenNoc={() => setShowNocModal(true)}
      />

      {/* Chaos Monkey Battle Mode Modal */}
      <ChaosBattleModal
        isOpen={showChaosModal}
        onClose={() => setShowChaosModal(false)}
        devices={devices}
        activeChallenge={activeChaosChallenge}
        timeLeft={chaosTimeLeft}
        isCompleted={chaosIsCompleted}
        scoreEarned={chaosScoreEarned}
        onStartChallenge={handleStartChaosChallenge}
        onVerifyFix={handleVerifyChaosFix}
        onResetChallenge={handleResetChaosChallenge}
        onExitChallenge={handleExitChaosChallenge}
        feedbackMessage={chaosFeedbackMessage}
      />

      {/* Cisco IOS Command Master Reference Modal */}
      <CommandReferenceModal
        isOpen={showCommandsModal}
        onClose={() => setShowCommandsModal(false)}
      />

      {/* CCNA Speedrun Timed Trials Modal */}
      <SpeedrunModal
        isOpen={showSpeedrunModal}
        onClose={() => setShowSpeedrunModal(false)}
        devices={devices}
        links={links}
        onLoadTopology={(newDevs, newLinks) => {
          setDevices(newDevs);
          setLinks(newLinks);
          pushHistory(newDevs, newLinks);
        }}
      />

      {/* Chaos Net-Gremlin Interactive Sandbox Widget */}
      <NetGremlinWidget
        isOpen={showGremlinWidget}
        onClose={() => setShowGremlinWidget(false)}
        devices={devices}
        links={links}
        onUpdateDeviceConfig={handleUpdateDeviceConfig}
        onToggleLinkState={handleToggleLinkState}
      />

      {errorMessage && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center gap-3 bg-red-950/95 border border-red-500/60 text-red-100 px-4 py-3 rounded-lg shadow-2xl backdrop-blur-md">
          <span className="text-sm font-medium">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-100 p-1 transition-colors rounded"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
