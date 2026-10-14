# WireCraft: Virtual Network Architecture Simulator

[![Node Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4.x-38bdf8.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests Passing](https://img.shields.io/badge/tests-58%20passed-success.svg)](https://vitest.dev/)

**WireCraft** is an industrial-grade, in-browser virtual network architecture simulator and interactive learning platform engineered for CCNA/CCNP network engineers, systems architects, and students. Build complex multi-tier network topologies, configure devices using authentic Cisco IOS command-line syntax, observe real-time hop-by-hop packet animation, troubleshoot live NOC outage tickets, and leverage an embedded Gemini-powered AI TAC Co-Pilot.

---

## Key Highlights

- **Authentic Cisco IOS CLI Engine**: Over 107 genuine Cisco IOS commands spanning User EXEC, Privileged EXEC, Global Config, Interface Config, Router Config (OSPF, RIP, EIGRP), and Line Config modes. Includes autocompletion (`Tab`), contextual help (`?`), command abbreviations (`sh ip int br`, `conf t`), command history, and pipe filtering (`| include`, `| section`, `| begin`).
- **Multi-Vendor OS Translation (Rosetta Stone)**: Side-by-side syntax comparison and translation for Cisco IOS, Juniper Junos, Arista EOS, Linux / VyOS, and MikroTik RouterOS.
- **Genuine Protocol Simulation Engines**:
  - **OSPFv2 (`src/engine/ospfEngine.ts`)**: Authentic Dijkstra Shortest Path First (SPF) algorithm, DR/BDR election, Hello/Dead interval validation, Router ID resolution, subnet match verification, and live dynamic routing table convergence.
  - **Spanning Tree Protocol (`src/engine/stpEngine.ts`)**: 802.1D STP root bridge election, lowest root path cost calculations, designated and alternate port roles, and loop-free topology pruning.
  - **Layer 2 Forwarding & VLANs**: 802.1Q trunking, trunk allowed VLAN filtering, native VLAN untagged frames, switch virtual interfaces (SVIs), and Router-on-a-Stick subinterface encapsulation.
  - **ICMP Packet Traversal & Return-Path Verification**: Pings and traceroutes traverse true Layer 2 paths and Layer 3 routing hops, respecting Access Control Lists (standard & extended ACLs) and bidirectional return routes.
- **Interactive Multi-Window Desktop Workspace**: Floating, draggable, resizable modal windows with window tiling, cascading, minimization, and stacking rack views.
- **AI-Powered Network Operations Center (NOC)**:
  - **Gemini AI TAC Co-Pilot**: Interactive tier-3 network architect assistant that troubleshoots running configurations, diagnoses MTU/OSPF mismatches, and suggests exact IOS remediation commands.
  - **Socratic Troubleshooting Mentor**: Educational mode that guides students with conceptual hints and diagnostic questions without giving away answers.
  - **Natural Language Text-to-Topology**: Describe any network in plain English (e.g., *"Build an enterprise branch office with dual OSPF routers, core switches, and two department VLANs"*) and watch WireCraft synthesize a fully configured topology.
  - **AI Architectural Diagram Generator**: Generates high-resolution 1K/2K/4K technical schematic topology diagrams using Gemini image models.
- **10 Hands-On Guided Practice Labs**: Pre-configured certification scenarios covering ARP fundamentals, VLAN isolation, Router-on-a-Stick, OSPF single/multi-area, ACL traffic filtering, DHCP services, and NAT address translation with automated validation and scoring HUD.

---

## Architecture Overview

```
+-------------------------------------------------------------------------+
|                        WireCraft Frontend (React 19)                    |
|  +-------------------+  +-------------------+  +---------------------+  |
|  |  Topology Canvas  |  |  Device Inspector |  |   NOC Incident HUD  |  |
|  | (Pan/Zoom/Cables) |  |   (CLI / Web UI)  |  | (Troubleshooting)   |  |
|  +-------------------+  +-------------------+  +---------------------+  |
|                              |                           |              |
|                              v                           v              |
|  +-------------------------------------------------------------------+  |
|  |                 Core Simulation Engine Pipeline                   |  |
|  |  +-----------------+  +-----------------+  +-------------------+  |  |
|  |  | 802.1D Spanning |  |  OSPFv2 Dijkstra|  |  L2/L3 Forwarding |  |  |
|  |  |   Tree Engine   |  |   SPF Algorithm |  |  & ACL Verifier   |  |  |
|  |  +-----------------+  +-----------------+  +-------------------+  |  |
|  |  +-----------------+  +-----------------+  +-------------------+  |  |
|  |  |  Virtual Clock  |  | WebWorker Engine|  | Multi-Vendor CLI  |  |  |
|  |  | (1x / 5x / 10x) |  | (Async Offload) |  | (Trie/Tree Engine)|  |  |
|  |  +-----------------+  +-----------------+  +-------------------+  |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
                                    |
                          REST API (/api/ai/*)
                                    v
+-------------------------------------------------------------------------+
|                        Express Backend (Node.js 22)                     |
|  +-------------------+  +-------------------+  +---------------------+  |
|  | Rate Limiting     |  | OSPF Diagnostics  |  | Google GenAI SDK    |  |
|  | & Sanitization    |  | Grounding Bridge  |  | (Gemini 3.8 Flash)  |  |
|  +-------------------+  +-------------------+  +---------------------+  |
+-------------------------------------------------------------------------+
```

---

## Quickstart

### Prerequisites

- **Node.js**: `v22.0.0` or higher
- **npm**: `v10.0.0` or higher
- **Gemini API Key** *(optional, for AI features)*: Obtainable from [Google AI Studio](https://aistudio.google.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/wirecraft.git
cd wirecraft

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

Edit `.env` to specify your Gemini API credentials (optional; all core network simulation, CLI, and labs function fully offline without an API key):

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_TEXT_MODELS=gemini-3.8-flash,gemini-2.5-flash
```

### Development Server

Start the full-stack Vite development server mounted on Express:

```bash
npm run dev
```

Navigate to `http://localhost:3000` in your browser.

---

## Verification & Testing

WireCraft features a comprehensive unit and property-based test suite using **Vitest** and **fast-check**:

```bash
# Run unit and regression tests
npm test

# Run tests in interactive watch mode
npm run test:watch

# Execute strict TypeScript type validation
npm run lint

# Compile production bundle
npm run build
```

---

## Hardware Emulation Catalog

| Category | Model / Device Spec | Interfaces | Emulation Engine |
|---|---|---|---|
| **Routers** | Cisco 2911 ISR | Gi0/0, Gi0/1, Gi0/2, Se0/0/0, Se0/0/1 | Cisco IOS 15.4(3)M2 |
| **Routers** | Cisco 4331 ISR | Gi0/0/0, Gi0/0/1, Gi0/0/2, SFP0/0/1 | Cisco IOS-XE 16.9 |
| **Routers** | Cisco 1941 ISR | Gi0/0, Gi0/1, Serial interfaces | Cisco IOS 15.1 |
| **Switches** | Cisco Catalyst 2960 | 24x FastEthernet (Fa0/1 - 24), 2x Gigabit (Gi0/1 - 2) | Layer 2 IOS Catalyst |
| **Switches** | Cisco Catalyst 3560 | 24x FastEthernet, 2x Gigabit | Layer 3 Multi-Layer Switch (SVI routing) |
| **Firewalls** | Cisco ASA 5506-X | Gi1/1 - Gi1/8 (Inside, Outside, DMZ) | ASA Software 9.8(2) |
| **Wireless** | Cisco 3504 WLC & AP | Management, AP-Manager, Virtual | AireOS 8.5.151.0 |
| **End Devices** | Workstation PC / Laptop | FastEthernet0/0, Wireless 802.11 | Desktop OS (CMD, Browser, IP Config) |
| **Servers** | Enterprise Linux Server | FastEthernet0/0, Gi0/1 | HTTP, DNS, DHCP Service Daemons |

---

## Documentation Index

Comprehensive engineering documentation is maintained in the [`/markdown`](./markdown/) directory:

- [**README.md**](./markdown/README.md) - Primary project specification and overview
- [**ARCHITECTURE.md**](./markdown/ARCHITECTURE.md) - Deep architectural breakdown of simulation mechanics and state flows
- [**CONTRIBUTING.md**](./markdown/CONTRIBUTING.md) - Contribution standards, branching conventions, and PR guidelines
- [**CHANGELOG.md**](./markdown/CHANGELOG.md) - Versioned history of features, bugfixes, and engine improvements
- [**DEPLOYMENT.md**](./markdown/DEPLOYMENT.md) - Containerization, Cloud Run, Docker, and reverse-proxy guidelines
- [**SECURITY.md**](./markdown/SECURITY.md) - Vulnerability disclosure policy, prompt injection defense, and security controls
- [**API.md**](./markdown/API.md) - Complete REST endpoint reference, JSON schemas, and rate-limiting limits
- [**CLI_REFERENCE.md**](./markdown/CLI_REFERENCE.md) - Exhaustive reference for all 107 Cisco IOS CLI commands and multi-vendor translations
- [**TESTING.md**](./markdown/TESTING.md) - Test methodologies, property-based tests, and STP/OSPF validation
- [**ROADMAP.md**](./markdown/ROADMAP.md) - Long-term development goals, feature pipeline, and future releases
- [**CODE_OF_CONDUCT.md**](./markdown/CODE_OF_CONDUCT.md) - Contributor Covenant v2.1 community standard

---

## Legal & Trademark Attribution

**WireCraft** is an independent educational simulation environment created for networking pedagogy, certification preparation, and instructional research.
- WireCraft is **not affiliated with, endorsed by, authorized by, or sponsored by Cisco Systems, Inc., Juniper Networks, Arista Networks, or MikroTik.**
- *"Cisco"*, *"Cisco IOS"*, *"Catalyst"*, *"CCNA"*, and *"CCIE"* are registered trademarks of Cisco Systems, Inc.
- All product names, logos, command syntaxes, and model designations are property of their respective owners and are utilized strictly under nominative fair use for educational compatibility and technical description.

---

## License

This project is licensed under the terms of the [MIT License](https://opensource.org/licenses/MIT).
