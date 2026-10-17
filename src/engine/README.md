# WireCraft Core Simulation Engine (`/src/engine`)

> [📖 Doc Hub](../../markdown/INDEX.md) • [🏗️ System Architecture](../../markdown/ARCHITECTURE.md) • [💻 CLI Reference](../../markdown/CLI_REFERENCE.md) • [🧪 Testing Methodology](../../markdown/TESTING.md)

The `/src/engine` directory contains the protocol-accurate simulation logic for **WireCraft**. All networking algorithms are implemented in pure TypeScript without DOM dependencies, allowing them to execute interchangeably on the browser main thread, inside background Web Workers, or headlessly in Node.js test environments.

---

## 🏛️ Engine Component Overview

| Module | Core Responsibilities |
|---|---|
| **`simulationEngine.ts`** | Central L2/L3 forwarding pipeline, Longest Prefix Match (LPM) route table lookup, Administrative Distance resolution, and hop-by-hop ICMP ping/traceroute execution with return-path validation. |
| **`ospfEngine.ts`** | Authentic Dijkstra Shortest Path First (SPF) algorithm, Link-State Database (LSDB) graph construction, DR/BDR election, Hello/Dead interval validation, and dynamic routing table installation. |
| **`stpEngine.ts`** | IEEE 802.1D Spanning Tree Protocol (STP) and Cisco Per-VLAN Spanning Tree Plus (PVST+). Root Bridge election by priority + MAC tie-break, root port selection by cumulative path cost, and loop prevention blocking. |
| **`cliEngine.ts`** | Authentic 107-command Cisco IOS command interpreter: command completion (`Tab`), contextual help (`?`), mode hierarchy (`user`, `priv`, `config`, `interface`, `router`, `line`), command history, and pipe filters (`\| include`, `\| section`, `\| begin`). |
| **`virtualClock.ts`** | Discrete-Event Simulation (DES) virtual time engine. Priority queue scheduler for timed protocol events (OSPF Hellos, STP BPDUs, ARP cache aging) with 0.5x, 1x, 2x, 5x, and 10x clock acceleration. |
| **`workerBridge.ts`** | Client interface bridging React state with the dedicated background Web Worker (`src/workers/simulationWorker.ts`), with automatic fallback to synchronous calculation if workers are unavailable. |
| **`deviceSpecs.ts`** | Hardware profiles, default interface complements, MAC address assignment, and physical cabling validation (straight-through vs. crossover vs. serial). |
| **`offlineTopologyGenerator.ts`** | Rule-based procedural topology synthesizer for instant offline creation of dual-tier, branch, star, and mesh networks without external API calls. |
| **`topologyBridge.ts`** | Adapter converting LLM/Gemini JSON responses into fully populated WireCraft `Device` and `Link` state objects. |

---

## 📂 Subdirectories

- **`/cli`**: Modular trie parser (`commandTrie.ts`), 107-command registry (`commandTreeRegistry.ts`), and multi-vendor syntax translation (`multiVendorEngines.ts`) for Juniper Junos, Arista EOS, Linux/VyOS, and MikroTik RouterOS.
- **`/protocols`**: Specialized protocol engines:
  - `bgpEngine.ts`: BGP-4 eBGP/iBGP peering, AS-Path, and EVPN route advertisements.
  - `eigrpEngine.ts`: Cisco EIGRP DUAL composite metric calculation and successor selection.
  - `hsrpEngine.ts`: First Hop Redundancy Protocol (HSRP RFC 2281) with virtual IP and Cisco virtual MAC (`0000.0c07.acXX`).
  - `mplsEngine.ts`: Label Distribution Protocol (LDP), LFIB, and Penultimate Hop Popping (PHP).
  - `ipsecEngine.ts`: Site-to-Site IPsec crypto maps, ESP encapsulation, and SA state.
  - `vxlanEngine.ts`: Layer 2 overlay encapsulation over Layer 3 IP fabric (VNI 4789).
  - `srv6Engine.ts`: Segment Routing over IPv6 locators and End/End.X functions.
  - `isisEngine.ts`: Intermediate System to Intermediate System (ISO/IEC 10589) link-state routing.
  - `wirelessIotEngine.ts`: 802.11 Wi-Fi association states, WPA2/WPA3 security, and MQTT broker telemetries.
- **`/__tests__`**: Vitest test suites executing 71+ unit, conformance, and property-based fuzz tests.
