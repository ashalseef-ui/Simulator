# Changelog

> [📖 Doc Hub](./INDEX.md) • [🏗️ Architecture](./ARCHITECTURE.md) • [💻 CLI Reference](./CLI_REFERENCE.md) • [🔌 REST API](./API.md) • [🧪 Testing](./TESTING.md) • [🚀 Deployment](./DEPLOYMENT.md) • [🔒 Security](./SECURITY.md) • [🗺️ Roadmap](./ROADMAP.md) • [🏷️ Brand Guide](./BRAND_LOC.md) • [🤝 Contributing](./CONTRIBUTING.md)

All notable changes to the **WireCraft** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-10-14

### Added
- **Complete 107 Cisco IOS CLI Command Suite**: Comprehensive verification and support for all 107 essential commands from the reference guide, including:
  - Advanced routing processes (`router rip`, `version 2`, `passive-interface`, `router eigrp`, `show ip eigrp neighbors`).
  - Access Control Lists (`ip access-list extended`, named ACL submodes, rule evaluation).
  - Storage & memory inspection (`mkdir`, `dir`, `show boot`, `show flash`, `show tech-support`).
  - Terminal session management (`logout`, `line console 0`, `line vty 0 4`, `logging synchronous`).
- **Brand Unification & Asset Overhaul**:
  - Unified project branding under **WireCraft** across all components, metadata, and backend models.
  - Added vector `WireCraftLogo` component with dual compact and wordmark modes.
  - Added standalone `public/favicon.svg` and `public/wirecraft_logo.svg` for direct browser delivery.
  - Created `markdown/BRAND_LOC.md` single-source-of-truth brand location catalog.
- **Multi-Vendor CLI Translation Engine**: Rosetta Stone matrix translating Cisco IOS commands to Juniper Junos, Arista EOS, Linux/VyOS, and MikroTik RouterOS.
- **Property-Based Testing**: Added `fast-check` property tests in `src/engine/__tests__/robustnessPropertyBased.test.ts` fuzzing packet paths, topology graphs, and route lookups.

### Changed
- Standardized environment variables in `.env.example` (`PORT`, `GEMINI_API_KEY`, `GEMINI_TEXT_MODELS`).
- Upgraded simulation worker error boundary to safely handle union narrowing.
- Optimized bundle code splitting and chunk limits in Vite configuration.

### Fixed
- Fixed TypeScript compile error in `src/workers/simulationWorker.ts` where exhaustive switch checks caused type exhaustion on fallback error branches.
- Fixed favicon 404 issue on static root requests by publishing static SVG assets to `/public`.
- Corrected interface resolution for modular router serial ports (`Se0/0/0`) during CLI configuration.

---

## [1.1.0] - 2026-09-28

### Added
- **OSPFv2 SPF Simulation Engine**: Authentic Dijkstra shortest-path calculations, DR/BDR election, hello/dead interval validation, and dynamic routing table generation (`src/engine/ospfEngine.ts`).
- **Spanning Tree (802.1D)**: Root bridge election, lowest cost calculations, designated and blocked alternate ports (`src/engine/stpEngine.ts`).
- **Interactive AI TAC Co-Pilot**: Server-side Gemini 3.8 Flash endpoint (`/api/ai/tac-copilot`) capable of analyzing running configs and explaining complex protocol behaviors.
- **Socratic Troubleshooting Mentor**: AI pedagogical agent (`/api/ai/socratic-mentor`) that assists students by asking diagnostic questions rather than giving answers away.
- **Natural Language Text-to-Topology**: Natural language synthesis (`/api/ai/text-to-topology`) converting text prompts into fully wired JSON topologies.
- **AI Diagram Studio**: Image generation endpoint using `gemini-3-pro-image-preview` and `gemini-3.1-flash-image-preview` for high-resolution topology schematics.

### Changed
- Refactored canvas rendering to use sub-pixel smooth panning and zoom with SVG cable layer.
- Added virtual clock telemetry bar supporting 1x, 5x, and 10x simulation speeds.

---

## [1.0.0] - 2026-08-15

### Added
- **Initial Core Simulator Engine**:
  - Interactive network canvas with drag-and-drop hardware devices (Routers, Switches, Firewalls, PCs, Servers).
  - Cable wiring system supporting Straight-Through, Crossover, and Serial connections.
  - Hop-by-hop packet animation engine for ICMP ping and ARP resolution.
- **Device Inspector**:
  - Multi-tab device window featuring Cisco IOS terminal, physical port status, and PC desktop tools (Command Prompt, Web Browser, IP Configuration).
- **10 Guided CCNA Practice Labs**:
  - Interactive scenarios covering ARP, VLAN segmentation, Router-on-a-Stick, OSPF, ACLs, and NAT.
  - Automated lab assessment scoring engine with real-time feedback.
- **NOC Incident Triage System**:
  - 10 real-world outage scenarios simulating misconfigured trunks, duplex mismatches, missing gateways, and routing loops.
- **Subnet & VLSM Calculator**:
  - Built-in IPv4 network calculator with CIDR mask breakdown, usable host ranges, and binary representation.
