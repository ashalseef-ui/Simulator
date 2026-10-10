# NetSim: Cisco CCNA Network Simulator

An in-browser Cisco-style network simulator for CCNA students: build a topology, configure devices through an IOS-like CLI, and watch packets move hop by hop.

## What is genuinely simulated

| Area | Status |
|---|---|
| L2 forwarding, VLANs, trunks (allowed list, native VLAN), router-on-a-stick, SVIs | Real: path search honours port state, VLAN and trunk rules |
| STP (802.1D) | Real for a single VLAN: root election, root port (cost, then upstream bridge ID, then port ID), designated/alternate roles. No per-VLAN STP, timers or EtherChannel yet |
| IP routing | Real: longest-prefix match, then administrative distance, then cost; connected, static, default and OSPF routes; recursive next-hop resolution |
| **OSPFv2** (`src/engine/ospfEngine.ts`) | Real adjacency + SPF: network statements/wildcards, areas, passive interfaces, hello/dead timers, subnet match, router IDs, DR/BDR election, Dijkstra route table. Mismatches stop adjacency from forming and `show ip ospf neighbor/interface` and `show ip route` report the computed state |
| ICMP ping / traceroute | Real: the CLI uses the same engine as the packet animation, so it depends on L2 path, routing at every hop, ACLs and the **return path** |
| ACLs | Real for ICMP (standard + extended matching, wildcard masks, implicit deny) |

## Known limitations (be honest with students)

- **EIGRP, RIP, BGP**: configuration is accepted and a matching `network` statement makes a prefix reachable, but there are no neighbors, metrics or route exchange. They do not appear in `show ip route`.
- **OSPF**: single LSDB view (no LSA types / ABR summarisation), no ECMP, broadcast networks only, no authentication or MTU negotiation.
- **Still canned CLI output**: `show ip nat translations`, `show ip dhcp binding`, ACL hit counters, and a number of `show` commands print illustrative text, not live state.
- **TCP**: no transport-layer simulation.

## Architecture

- `src/engine/simulationEngine.ts`: ping/DHCP simulation, route lookup, forwarding path search
- `src/engine/ospfEngine.ts`: OSPF adjacency, DR/BDR, SPF
- `src/engine/stpEngine.ts`: spanning tree
- `src/engine/cliEngine.ts`: IOS-like command parser and `show` output
- `src/components/*`: React UI (canvas, device inspector, labs, NOC incidents, subnet calculator)
- `server.ts`: Express + Vite dev server and the Gemini-backed AI endpoints (`/api/ai/*`)

## Development

```bash
npm install
cp .env.example .env     # add GEMINI_API_KEY (optional: AI features degrade gracefully without it)
npm run dev              # http://localhost:3000
npm test                 # vitest: OSPF, STP, routing, end-to-end ping
npm run lint             # tsc --noEmit
```

### AI endpoint configuration

- `GEMINI_TEXT_MODELS`: comma-separated model list, tried in order (default `gemini-3.8-flash,gemini-2.5-flash`)
- Rate limits: 20 text requests/min and 4 image requests/min per IP (in-memory; use a shared store if you run several instances)
- Request bodies are capped at 512 KB (12 MB for image edits) and all inputs are length-limited
- The OSPF diagnosis sent to the model is computed by the simulator's own engine, not guessed
