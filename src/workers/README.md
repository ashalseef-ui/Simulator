# WireCraft Web Worker Concurrency (`/src/workers`)

> [📖 Doc Hub](../../markdown/INDEX.md) • [🏗️ Architecture](../../markdown/ARCHITECTURE.md) • [🧪 Testing](../../markdown/TESTING.md)

This directory contains the background Web Worker implementation for **WireCraft**, ensuring that computationally intensive network graph operations and packet traversals never block the UI main thread or drop frames at 60 FPS.

---

## ⚡ Concurrency Model

```
[ UI Thread: React 19 ]                          [ Background Web Worker ]
       │                                                    │
       ├──── postMessage(SOLVE_TOPOLOGY_REQUEST) ──────────>│
       │                                                    ├─ Computes 802.1D Spanning Tree / PVST+
       │                                                    ├─ Runs Dijkstra OSPF Shortest Path First
       │                                                    ├─ Computes BGP, EIGRP, HSRP, MPLS states
       │<─── onmessage(SOLVE_TOPOLOGY_RESULT) ──────────────┤
       │     (State updated in <2ms)                        │
       │                                                    │
       ├──── postMessage(SIMULATE_PING_REQUEST) ───────────>│
       │                                                    ├─ Calculates hop-by-hop L2/L3 path
       │                                                    ├─ Tests ACLs & reverse routing return path
       │<─── onmessage(SIMULATE_PING_RESULT) ───────────────┤
```

---

## 📦 Message Types & API Contract

### Inbound Worker Requests (`WorkerRequest`)

1. **`SOLVE_TOPOLOGY`**: Requests simultaneous recalculation of STP/PVST+ port states, OSPF routing tables, and advanced protocol states for the current topology graph.
2. **`SIMULATE_PING`**: Computes deterministic packet traversal between source and destination IP addresses, returning animation steps and return-path verification.
3. **`SIMULATE_DHCP`**: Executes the 4-way DHCP DORA (Discover, Offer, Request, Acknowledge) exchange.
4. **`PING_WORKER`**: Liveness probe returning latency telemetry.

### Outbound Worker Responses (`WorkerResponse`)

- **`SOLVE_TOPOLOGY_RESULT`**: Contains updated `stpState`, `ospfState`, and `computeLatencyMs`.
- **`SIMULATE_PING_RESULT`**: Returns `SimulationResult` containing packet trajectory steps, TTL expiration, or ACL drop points.
- **`SIMULATE_DHCP_RESULT`**: Returns DHCP lease parameters and visual packet steps.
- **`ERROR`**: Graceful failure payload falling back to synchronous execution on the main thread if an unhandled exception occurs.

---

## 🛡️ Fallback Resilience

The worker bridge (`src/engine/workerBridge.ts`) monitors worker health with an automatic timeout (5000ms). If a browser environment does not support Web Workers (or if an execution timeout triggers), calculations automatically fall back to synchronous execution on the main thread without crashing the application.
