# WireCraft: Project Technical Scope & Validation Status

> [📖 Doc Hub](./INDEX.md) • [🏗️ Architecture](./ARCHITECTURE.md) • [💻 CLI Reference](./CLI_REFERENCE.md) • [🔌 REST API](./API.md) • [🧪 Testing](./TESTING.md) • [🚀 Deployment](./DEPLOYMENT.md) • [🔒 Security](./SECURITY.md) • [🗺️ Roadmap](./ROADMAP.md) • [🤝 Contributing](./CONTRIBUTING.md)

**WireCraft** is an in-browser educational network simulator and laboratory environment engineered for Cisco CCNA/CCNP certification preparation and computer networking education. Users construct network topologies on an interactive canvas, configure physical and logical interfaces using authentic Cisco IOS command-line syntax, and observe hop-by-hop packet animation with deterministic protocol calculations.

---

## 1. What is Genuinely Simulated

WireCraft differentiates itself from superficial web simulators by implementing genuine algorithmic protocol calculations rather than mock animations:

| Protocol / Layer | Engine Implementation | Simulation Fidelity & Logic |
|---|---|---|
| **Layer 2 Forwarding & VLANs** | `src/engine/simulationEngine.ts` | **High / Protocol-Accurate**: Forwarding paths honor IEEE 802.1Q tagging, port access/trunk operational modes, trunk allowed VLAN filtering, native VLAN untagged handling, Switch Virtual Interfaces (SVIs), and Router-on-a-Stick subinterface encapsulation (`encapsulation dot1Q <vlan>`). |
| **Spanning Tree Protocol (STP)** | `src/engine/stpEngine.ts` | **High / Standard-Compliant**: Genuine IEEE 802.1D Spanning Tree. Calculates Bridge IDs (Priority + MAC), elects the single Root Bridge, identifies Root Ports via lowest cumulative path cost (FastEthernet=19, GigabitEthernet=4), designates designated ports, and transitions redundant loop paths to Alternate/Blocking state. |
| **OSPFv2 Routing** | `src/engine/ospfEngine.ts` | **High / Algorithmic**: Implements Dijkstra Shortest Path First (SPF) algorithm. Evaluates wildcard masks on `network` statements, forms 2-Way and Full neighbor adjacencies, elects DR/BDR based on priority and Router ID, validates Hello/Dead timer consistency, detects MTU and subnet mask mismatches, and dynamically installs computed OSPF routes into routing tables. |
| **IP Routing & Next-Hop Resolution** | `src/engine/simulationEngine.ts` | **High / Real Engine**: Implements Longest Prefix Match (LPM) route lookup, Administrative Distance tie-breaking (Connected: 0, Static: 1, OSPF: 110, RIP: 120), metric cost evaluation, and recursive next-hop interface resolution. |
| **ICMP Ping & Traceroute** | `src/engine/simulationEngine.ts` | **High / Real Verification**: CLI `ping` and `traceroute` commands execute through the exact same engine pipeline as the visual packet animator. A ping packet must successfully traverse every forward hop, satisfy Access Control Lists at each interface, and find a valid reverse path back to the originator. |
| **Access Control Lists (ACLs)** | `src/engine/simulationEngine.ts` | **High / Real Verification**: Standard ACLs (source IP matching) and Extended ACLs (source, destination, protocol, port) with wildcard mask evaluation and implicit `deny any` logic. |
| **Cisco IOS CLI Engine** | `src/engine/cliEngine.ts` | **High / 107 Commands**: Authentic prompt hierarchy (`User EXEC` -> `Privileged EXEC` -> `Global Config` -> `Interface Config` -> `Router Config` -> `Line Config`), `Tab` autocompletion, `?` contextual help, command abbreviations (`sh ip int br`, `conf t`), command history, and pipe filters (`\| include`, `\| section`, `\| begin`). |

---

## 2. Transparent Limitations (Educational Honesty)

To preserve pedagogical integrity and set accurate expectations for students and instructors, the following capabilities are currently simulated conceptually or scheduled for future phases:

- **EIGRP, RIP, BGP**: Configuration syntax is parsed and accepted, and a matching `network` statement registers prefixes into the local topology database, but neighbor state machines and metric updates are planned for Phase 2 and 3.
- **OSPF Scope**: Operates a single Link-State Database (LSDB) view across Area 0 and standard multi-areas without separate LSA Type 3/4/5 flooding or ABR route summarization.
- **Canned CLI Diagnostic Outputs**: Commands such as `show ip nat translations`, `show ip dhcp binding`, and specific hardware environmental diagnostics print realistic, instructional representations rather than live hardware registers.
- **TCP Connection State**: Transport-layer simulation focuses on port-level reachability; full TCP sliding-window and three-way handshake state machines are omitted in favor of lightweight in-browser responsiveness.

---

## 3. Directory Layout & Core Modules

```
wirecraft/
├── src/
│   ├── components/            # React 19 UI (Canvas, Device Inspector, Modals, TopBar)
│   ├── engine/                # Pure TypeScript Protocol Simulation Engines
│   │   ├── cliEngine.ts       # 107-command IOS CLI parser, modes, and command trie
│   │   ├── simulationEngine.ts# Forwarding, packet animation, LPM routing, and ACLs
│   │   ├── ospfEngine.ts      # Dijkstra SPF, DR/BDR election, and OSPF adjacency
│   │   ├── stpEngine.ts       # 802.1D Spanning Tree bridge and port role calculations
│   │   ├── deviceSpecs.ts     # Hardware catalog, default interfaces, and MACs
│   │   └── __tests__/         # Vitest unit and property-based test suites
│   ├── workers/               # Web Workers for async simulation offloading
│   ├── types/                 # Strict TypeScript domain interfaces
│   └── data/                  # Pre-configured certification practice labs & sample topologies
├── server.ts                  # Node.js 22 + Express backend with Gemini GenAI AI TAC proxy
└── markdown/                  # Complete industrial documentation repository
```

---

## 4. Development & Testing Commands

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional Gemini AI TAC Co-Pilot key)
cp .env.example .env

# 3. Start local development server
npm run dev

# 4. Run full test suite (58+ unit and property tests)
npm test

# 5. Type validation
npm run lint

# 6. Production bundle compilation
npm run build
```

---

## 5. Trademark & Legal Notice

WireCraft is an independent educational simulation platform created solely for instructional training and CCNA/CCNP preparation.
- It is **not affiliated with, authorized by, sponsored by, or endorsed by Cisco Systems, Inc.**
- *"Cisco"*, *"Cisco IOS"*, *"Catalyst"*, *"CCNA"*, and *"CCIE"* are registered trademarks of Cisco Systems, Inc.
- All other product names, logos, and brands are property of their respective owners and are used purely for nominative compatibility identification.
