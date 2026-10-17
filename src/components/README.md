# WireCraft UI Components (`/src/components`)

> [📖 Doc Hub](../../markdown/INDEX.md) • [🏗️ Architecture](../../markdown/ARCHITECTURE.md) • [🏷️ Brand Guide](../../markdown/BRAND_LOC.md)

This directory contains the user interface components for **WireCraft**, built using React 19, Lucide icons, and Tailwind CSS.

---

## 🧩 Component Directory & Hierarchy

```
App.tsx
├── TopBar.tsx                      # Top application navigation, logo, action toolbar
├── Canvas.tsx                      # Infinite workspace, pan/zoom, interactive cables, link health HUD
├── DevicePalette.tsx               # Left device catalog sidebar (Routers, Switches, Firewalls, Endpoints)
├── WindowManagerBar.tsx            # Bottom floating taskbar for active minimized/open device windows
├── VirtualClockTelemetryBar.tsx    # Movable Discrete-Event Simulation clock and Web Worker latency HUD
├── SimulationBar.tsx               # Hop-by-hop packet inspection and animation stepper
├── DeviceInspector.tsx             # Multi-tab device window (CLI terminal, Web browser, front panel, protocols)
│   ├── DeviceFrontPanel.tsx        # Authentic hardware LED front panel render
│   ├── StackingView.tsx            # Switch stack ring topology visualization
│   └── ProtocolsDashboard.tsx      # Comprehensive multi-protocol state inspection (OSPF, BGP, HSRP, MPLS, etc.)
└── Modals & Dialogs
    ├── TextToTopologyModal.tsx     # Natural language AI / offline topology synthesizer
    ├── NocIncidentModal.tsx        # Troubleshooting triage dashboard with AI TAC Co-Pilot
    ├── SocraticMentorModal.tsx     # Educational Socratic mentoring dialogue
    ├── AiDiagramModal.tsx          # High-resolution architectural topology diagram exporter
    ├── PresetsModal.tsx            # Pre-configured enterprise topology selector
    ├── LabGuideModal.tsx           # Guided CCNA practice labs with automated grader
    ├── LabAssessmentHud.tsx        # Floating laboratory score and validation tracker
    ├── ChaosBattleModal.tsx        # Timed outage repair challenge mode
    ├── SubnetCalculatorModal.tsx   # Interactive IPv4 subnet calculator and VLSM planner
    ├── CommandReferenceModal.tsx   # Complete 107-command CLI reference & Rosetta Stone matrix
    ├── MascotGuideModal.tsx        # Packet Pete interactive onboarding guide
    └── AboutLegalModal.tsx         # Legal disclaimer, open-source attribution, and architecture info
```

---

## 🪟 Floating Window Management Standards

- **Free-Floating Drag & Resize**: `DeviceInspector` windows support smooth pointer-down dragging across the viewport and 8-direction resizing.
- **Window Hierarchy**: Clicked windows elevate to the top `z-index` layer.
- **Tiling & Cascading**: Automated layout algorithms in `src/utils/windowLayout.ts` dynamically organize open windows into non-overlapping grids or diagonal cascades.
- **Collision Prevention**: Persistent HUDs (such as `VirtualClockTelemetryBar`) are placed by default at the top-right to preserve clear lines-of-sight to bottom-right zoom controls and bottom-left health legends.
