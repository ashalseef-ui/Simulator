# WireCraft Engineering Documentation Hub

Welcome to the centralized technical documentation repository for **WireCraft**, an industrial-grade in-browser virtual network architecture simulator and learning platform.

---

## 🧭 Documentation Navigator

| Document | Primary Audience | Scope & Description |
|---|---|---|
| [**README.md**](./README.md) | Everyone / Getting Started | High-level system overview, feature highlights, quickstart, hardware catalog, and architecture summary. |
| [**PROJECT.md**](./PROJECT.md) | Architects / Educators | Engineering status report: what is genuinely simulated (L2/L3/OSPF/STP/ACLs) vs. current platform limitations. |
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | Core Engineers / Contributors | Deep dive into the OSI simulation pipeline, WebWorker concurrency, state management, and Dijkstra SPF engine. |
| [**CLI_REFERENCE.md**](./CLI_REFERENCE.md) | Network Engineers / Students | Exhaustive reference guide for all 107 Cisco IOS CLI commands, execution modes, pipe filtering, and multi-vendor translation. |
| [**API.md**](./API.md) | Full-Stack & Integration Devs | REST API contract for backend Express proxy (`server.ts`), AI TAC Co-Pilot, rate limits, and schemas. |
| [**TESTING.md**](./TESTING.md) | QA & Test Engineers | Vitest suite architecture, property-based invariants with `fast-check`, OSPF/STP test harnesses, and CI validation. |
| [**DEPLOYMENT.md**](./DEPLOYMENT.md) | DevOps / SRE | Production deployment workflows: Docker multi-stage builds, Cloud Run, Kubernetes, PM2, and Nginx reverse proxy. |
| [**SECURITY.md**](./SECURITY.md) | Security Analysts / Admins | Threat model, client-side sandbox isolation, prompt injection defenses, rate limiting, and vulnerability disclosure SLA. |
| [**ROADMAP.md**](./ROADMAP.md) | Product Managers / Community | Feature release pipeline across Phase 1 (Completed), Phase 2 (Enterprise L2/L3), Phase 3 (BGP & PCAP), and Phase 4. |
| [**BRAND_LOC.md**](./BRAND_LOC.md) | UI/UX & Brand Maintainers | Complete inventory of all brand mentions, SVG vectors, banners, hostnames, and step-by-step rebranding checklist. |
| [**CONTRIBUTING.md**](./CONTRIBUTING.md) | Contributors / Developers | Step-by-step contribution guidelines, Git branching conventions, Conventional Commits, and PR quality gates. |
| [**CODE_OF_CONDUCT.md**](./CODE_OF_CONDUCT.md) | Community Members | Contributor Covenant v2.1 code of conduct, inclusivity standards, and incident escalation procedures. |
| [**CHANGELOG.md**](./CHANGELOG.md) | All Users | Semantic Versioning release history, feature additions, breaking changes, and bug fixes. |

---

## 📦 Module-Level Architecture Documentation (`/src/*`)

In addition to repository-level guides, each core module maintains localized documentation explaining directory conventions and exported APIs:

| Module Document | Path | Scope & Focus |
|---|---|---|
| [**Source Architecture**](../src/README.md) | `src/README.md` | Top-level client architecture, entry points (`main.tsx`, `App.tsx`), and module relationships. |
| [**Core Engine Guide**](../src/engine/README.md) | `src/engine/README.md` | Algorithmic breakdown of L2/L3 forwarding, discrete virtual clock, STP, OSPF, and multi-protocol engines. |
| [**UI Components Guide**](../src/components/README.md) | `src/components/README.md` | React 19 component hierarchy, desktop window management, Canvas pan/zoom, and modal subsystems. |
| [**Web Worker Concurrency**](../src/workers/README.md) | `src/workers/README.md` | Off-thread simulation execution, request/response contracts, and main-thread fallback strategies. |
| [**Domain Types & Models**](../src/types/README.md) | `src/types/README.md` | TypeScript data dictionary for Devices, Interfaces, Cables, and Protocol configurations. |
| [**Utility Algorithms**](../src/utils/README.md) | `src/utils/README.md` | Bitwise IPv4 math, subnet mask calculations, and circular-safe deep object cloning. |
| [**Seed Data & Labs**](../src/data/README.md) | `src/data/README.md` | Pre-configured enterprise network topologies, NOC incident tickets, and 10 guided CCNA certification labs. |

---

## 🏗️ Architecture at a Glance

```
                                  +-------------------------------------------------+
                                  |         WireCraft Frontend (React 19 SPA)       |
                                  |  +--------------------+  +-------------------+  |
                                  |  |   Topology Canvas  |  |  Device Inspector |  |
                                  |  |   (Pan/Zoom/Links) |  |   (CLI / Web UI)  |  |
                                  |  +--------------------+  +-------------------+  |
                                  |           │                        │            |
                                  |           ▼                        ▼            |
                                  |  +-------------------------------------------+  |
                                  |  |      In-Browser Simulation Core (TS)      |  |
                                  |  |  - 802.1D Spanning Tree Engine            |  |
                                  |  |  - OSPFv2 Dijkstra SPF Algorithm          |  |
                                  |  |  - Layer 2/3 Packet Forwarder & ACLs      |  |
                                  |  |  - 107-Command Cisco IOS CLI Trie Engine  |  |
                                  |  +-------------------------------------------+  |
                                  +-------------------------------------------------+
                                                          │
                                                REST JSON (/api/ai/*)
                                                          ▼
                                  +-------------------------------------------------+
                                  |          Backend Service (Node.js 22)           |
                                  |  - Static Asset Delivery (/dist)                |
                                  |  - Grounded OSPF Diagnostic Synthesizer         |
                                  |  - Gemini 3.8 Flash AI TAC Co-Pilot Proxy       |
                                  |  - High-Res Topology Schematic Generator        |
                                  +-------------------------------------------------+
```

---

## ⚡ Quick Links for Common Tasks

- **Want to run the app locally?** Follow the [Quickstart Guide in README.md](./README.md#getting-started).
- **Need help configuring a router or switch?** Search the [CLI Reference](./CLI_REFERENCE.md).
- **Submitting code or opening a PR?** Check the [Contributing Guide](./CONTRIBUTING.md) and [Testing Guide](./TESTING.md).
- **Deploying to production?** Follow [DEPLOYMENT.md](./DEPLOYMENT.md).
- **Updating logos or brand strings?** Review [BRAND_LOC.md](./BRAND_LOC.md).
- **Found a security bug?** Disclose confidentially per [SECURITY.md](./SECURITY.md).
