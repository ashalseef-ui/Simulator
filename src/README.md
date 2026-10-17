# WireCraft Source Code Architecture (`/src`)

> [📖 Root Documentation Hub](../markdown/INDEX.md) • [🏗️ Architecture Deep-Dive](../markdown/ARCHITECTURE.md) • [💻 CLI Reference](../markdown/CLI_REFERENCE.md)

This directory houses the entire client-side virtual network simulation engine and React 19 user interface for **WireCraft**.

---

## 📁 Directory Structure & Responsibilities

| Subdirectory | Role & Functionality | Documentation |
|---|---|---|
| [`/components`](./components/README.md) | Modular React 19 UI presentation layer, floating window manager, interactive SVG/HTML5 canvas, device inspector, and troubleshooting modals. | [Components Guide](./components/README.md) |
| [`/engine`](./engine/README.md) | Pure TypeScript protocol simulation engines (802.1D Spanning Tree, Dijkstra OSPFv2, L2/L3 packet forwarding, 107-command Cisco IOS CLI parser). | [Engine Guide](./engine/README.md) |
| [`/workers`](./workers/README.md) | Dedicated Web Worker offloading intensive graph solving and packet traversals off the UI main thread. | [Workers Guide](./workers/README.md) |
| [`/types`](./types/README.md) | Strict TypeScript domain models, interfaces, and state contracts (Devices, Interfaces, Links, Protocols). | [Types Guide](./types/README.md) |
| [`/utils`](./utils/README.md) | Pure utility algorithms (IPv4 CIDR/mask calculation, circular-reference-safe deep cloning, window layout cascades). | [Utils Guide](./utils/README.md) |
| [`/data`](./data/README.md) | Static seed datasets: CCNA certification practice labs, pre-configured enterprise topologies, and NOC incident scenarios. | [Data Guide](./data/README.md) |
| [`/assets`](./assets/) | Vector SVG brand marks (`wirecraft_logo.svg`) and mascot illustrations (`wirecraft_mascot_packet_pete.jpg`). | [Brand Guide](../markdown/BRAND_LOC.md) |

---

## 🚀 Key Entry Points

- **`main.tsx`**: Bootstraps the React 19 DOM tree into `#root`.
- **`App.tsx`**: Central application state coordinator:
  - Manages active devices, link connections, cable selection, and undo/redo history.
  - Coordinates multi-window desktop workspace (open inspectors, z-index stacking, minimizing, tiling).
  - Bridges simulation calculations with the background Web Worker (`workerBridge.ts`).
- **`index.css`**: Global design constitution and Tailwind CSS utility styling.
