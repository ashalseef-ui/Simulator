# WireCraft TypeScript Domain Models (`/src/types`)

> [📖 Doc Hub](../../markdown/INDEX.md) • [🏗️ Architecture](../../markdown/ARCHITECTURE.md) • [💻 CLI Reference](../../markdown/CLI_REFERENCE.md)

This directory defines the single source of truth for all domain entities, network hardware models, protocol configuration blocks, and UI state contracts within **WireCraft**.

---

## 📐 Core Domain Interfaces (`network.ts`)

### Hardware & Topology
- **`Device`**: Root hardware entity containing `id`, `name`, `type` (`router`, `switch`, `firewall`, `pc`, `server`), `model`, `x`/`y` coordinates, and active `config: DeviceConfig`.
- **`DeviceInterface`**: Represents a physical or logical port (e.g., `GigabitEthernet0/0`, `FastEthernet0/1`, `Vlan10`, `Se0/0/0`). Tracks MAC address, IP address, subnet mask, administrative/line status, duplex, speed, switchport mode (`access` vs. `trunk`), allowed VLANs, native VLAN, STP state, HSRP configuration, and ACL attachments.
- **`Link`**: Inter-device cable connection tracking source device/port, destination device/port, and `cableType` (`straight` vs. `crossover` vs. `serial`).

### Routing & Protocol Configurations (`DeviceConfig`)
- **`hostname`**: Active device name printed in CLI prompts (`Router#`).
- **`interfaces`**: Map of interface names to `DeviceInterface` records.
- **`routes`**: Static route table entries (`network`, `mask`, `nextHop`, `metric`, `adminDistance`).
- **`ospf`**: OSPF process configuration (`processId`, `routerId`, `networks`, `passiveInterfaces`, `areas`).
- **`eigrp`**: EIGRP Autonomous System configuration (`asNumber`, `networks`, `metricWeights`).
- **`bgp`**: BGP configuration (`asn`, `routerId`, `neighbors`, `networks`).
- **`accessLists`**: Named and numbered standard/extended Access Control Lists.
- **`vlans`**: Layer 2 VLAN database (`id`, `name`).
- **`services`**: End-host and server daemons (DHCP pools, DNS records, HTTP web server).

### Simulation & UI State
- **`SimulationStep`**: Discrete animation frame for packet visualization tracking `fromDeviceId`, `toDeviceId`, `protocol`, `status`, and explanatory log message.
- **`StpTopologyState`**: Spanning Tree instance mapping root bridge ID, bridge costs, and per-port STP roles (`ROOT`, `DESIGNATED`, `ALTERNATE`) and states (`FORWARDING`, `BLOCKING`, `LEARNING`).
- **`DeviceWindowState`**: Window manager metadata (`isOpen`, `isMinimized`, `isMaximized`, `position`, `size`, `zIndex`, `activeTab`).
