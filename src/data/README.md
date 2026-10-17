# WireCraft Seed Datasets (`/src/data`)

> [📖 Doc Hub](../../markdown/INDEX.md) • [🏗️ Architecture](../../markdown/ARCHITECTURE.md) • [🧪 Testing](../../markdown/TESTING.md)

This directory maintains pre-configured topologies, structured CCNA certification practice labs, and realistic NOC incident scenarios.

---

## 📚 Seed Data Catalogs

### 1. `sampleTopologies.ts` (Pre-Configured Architecture Topologies)
Includes enterprise and campus reference networks ready for instant loading:
- **Small Office / Home Office (SOHO)**: Single edge router, unmanaged switch, server, and workstations.
- **Enterprise Multi-VLAN Campus**: Two core Catalyst switches with 802.1Q trunking and separate Sales / Engineering VLANs.
- **Dual Router-on-a-Stick**: Branch office routing multiple VLANs across a single trunked Gigabit link.
- **Redundant Triangular STP Fabric**: Three switches in a closed ring loop demonstrating 802.1D Spanning Tree election and alternate port blocking.
- **Multi-Area OSPF Enterprise**: Three routers configured in Area 0 and Area 10 with loopback router IDs and dynamic route distribution.
- **Enterprise Edge with ASA Firewall**: Perimeter DMZ security architecture with inside, outside, and DMZ interfaces.

### 2. `labs.ts` (10 Guided CCNA Certification Labs)
Interactive hands-on practice labs equipped with step-by-step instructions, hints, CLI commands, and automated scoring validation:
1. **Lab 1: ARP Fundamentals & Layer 2 Broadcasts**
2. **Lab 2: Basic Switch Configuration & VLAN Isolation**
3. **Lab 3: Router-on-a-Stick Subinterface Inter-VLAN Routing**
4. **Lab 4: Single-Area OSPFv2 Adjacency & Dijkstra Route Convergence**
5. **Lab 5: Multi-Area OSPFv2 Backbone Design**
6. **Lab 6: Standard Access Control Lists (ACLs)**
7. **Lab 7: Extended Access Control Lists (Port & Protocol Filtering)**
8. **Lab 8: DHCP Server Daemon & Pool Configuration**
9. **Lab 9: Static Network Address Translation (NAT)**
10. **Lab 10: Dynamic PAT / NAT Overload**

### 3. `incidentScenarios.ts` (NOC Outage Tickets)
Troubleshooting scenarios simulating real-world enterprise outage emergencies:
- **Ticket #101**: Branch office disconnection due to OSPF subnet mask mismatch.
- **Ticket #102**: VLAN blackhole caused by missing allowed VLAN in 802.1Q trunk.
- **Ticket #103**: Spanning Tree broadcast storm caused by BPDU filter misconfiguration.
- **Ticket #104**: Server unreachable due to implicit deny on extended ACL.
- **Ticket #105**: Intermittent connectivity caused by duplicate IP address assignment.
