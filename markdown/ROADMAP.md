# WireCraft Engineering Roadmap

This document outlines the strategic milestones, engineering priorities, and feature pipeline for **WireCraft**.

---

## Strategic Vision

To make WireCraft the world's most accessible, zero-install, protocol-accurate network architecture simulator, bridging the gap between static textbook diagrams and heavy virtual machine testbeds.

---

## Release Milestones & Trajectory

```
[ Phase 1: Foundation ] ───> [ Phase 2: Enterprise L2/L3 ] ───> [ Phase 3: Automation & PCAP ] ───> [ Phase 4: Multiplayer ]
  • 107 IOS Commands           • Rapid PVST+ (802.1w)             • Wireshark .pcap Export            • Live Collaborative Canvas
  • OSPFv2 Dijkstra SPF        • LACP EtherChannel (802.3ad)      • BGP-4 eBGP/iBGP Peering           • Cloud Sandbox Sync
  • 802.1D Spanning Tree       • EIGRP DUAL Engine                • Python / Netmiko Emulation        • Custom Student Exams
  • AI TAC Co-Pilot & Labs     • NAT Overload (PAT)               • IPv6 OSPFv3 & SLAAC               • LMS Integration (Canvas/Moodle)
```

---

## Phase 1: Core Foundation & CCNA Essentials *(Completed - v1.2.0)*

- [x] **Universal Canvas Topologies**: Interactive canvas supporting drag-and-drop hardware, multi-selection, and automatic cable detection.
- [x] **Complete 107 Cisco IOS Commands**: Verified command parser covering User EXEC, Privileged EXEC, Global Config, Interface Config, Router Config, and Line Config.
- [x] **OSPFv2 Dijkstra SPF Engine**: Live adjacency formation, DR/BDR election, area filtering, and Dijkstra routing table convergence (`src/engine/ospfEngine.ts`).
- [x] **Spanning Tree (802.1D)**: Root bridge election, path cost evaluation, and automatic alternate port blocking (`src/engine/stpEngine.ts`).
- [x] **802.1Q VLANs & Router-on-a-Stick**: Trunk encapsulation, allowed VLAN lists, native VLANs, and subinterfaces.
- [x] **AI TAC Co-Pilot & Socratic Mentor**: Server-side Gemini 3.8 Flash integration providing grounded diagnostics and pedagogical problem solving.
- [x] **10 Guided CCNA Certification Labs**: Interactive practice scenarios with automatic validation and real-time grading.
- [x] **Multi-Vendor Translation**: Rosetta Stone translation matrix for Cisco IOS, Juniper Junos, Arista EOS, Linux/VyOS, and MikroTik RouterOS.

---

## Phase 2: Enterprise Switching & Advanced Routing *(Near-Term - Q4 2026)*

- [ ] **Rapid Spanning Tree Protocol (RSTP 802.1w)**:
  - Implement Edge Ports (PortFast), Alternate, and Backup port roles with sub-second convergence.
  - Proposal/Agreement handshake simulation.
- [ ] **EtherChannel / Link Aggregation (802.3ad)**:
  - Port bonding supporting LACP (Active/Passive) and PAgP (Desirable/Auto).
  - Load-balancing hash algorithms (Source MAC, Destination MAC, IP XOR).
- [ ] **Dynamic EIGRP DUAL Metric Engine**:
  - Implement Diffusing Update Algorithm (DUAL) finite state machine.
  - Feasible Successor and Feasibility Condition calculations using composite metric $256 \times (\frac{10^7}{\text{Bandwidth}} + \frac{\text{Delay}}{10})$.
- [ ] **Port Address Translation (PAT / NAT Overload)**:
  - Dynamic ephemeral port mapping table allowing entire LAN subnets to share a single public IP.
- [ ] **HSRP / VRRP First Hop Redundancy**:
  - Virtual IP arbitration, priority preemption, and active/standby router failover.

---

## Phase 3: Service Provider Protocols & Packet Capture *(Mid-Term - 2027)*

- [ ] **Border Gateway Protocol (BGP-4)**:
  - eBGP and iBGP peering over simulated TCP port 179.
  - AS-Path prepending, Local Preference, Weight, and MED attribute evaluation.
- [ ] **In-Browser PCAP Packet Capture Export**:
  - WebAssembly-powered packet capture generator exporting downloadable `.pcap` files readable in Wireshark.
- [ ] **Comprehensive IPv6 Protocol Stack**:
  - SLAAC auto-addressing with Router Advertisements (RA) and Router Solicitations (RS).
  - OSPFv3 dynamic routing over IPv6 link-local addresses (`FE80::/10`).
- [ ] **In-Browser Python Automation (Pyodide)**:
  - Embedded Python sandbox enabling students to run automated Netmiko and Paramiko scripts against simulated device CLIs.

---

## Phase 4: Collaborative Learning & LMS Integration *(Long-Term)*

- [ ] **Multiplayer Collaborative Canvas**:
  - WebRTC / WebSocket real-time collaboration allowing multiple students and instructors to edit topologies simultaneously.
- [ ] **Custom Instructor Exam Creator**:
  - Instructor portal to author custom network fault scenarios, hidden objectives, and automated grading rubrics.
- [ ] **LTI 1.3 / LMS Integration**:
  - Seamless single sign-on and gradebook passback for Canvas, Blackboard, and Moodle.
- [ ] **Dark-Site Air-Gapped Packaging**:
  - Standalone Electron and desktop binaries for air-gapped defense and government training centers.
