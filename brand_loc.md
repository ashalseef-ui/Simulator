# WireCraft Brand Locations & Migration Reference Guide

This document catalogs every location where the project brand name (`WireCraft` / `wirecraft`), logos, icons, hostnames, and emulation banners appear. Use this file as a single-source checklist whenever rebranding or updating visual assets.

---

## 1. Project Metadata & HTML Entry Points

| File | Exact Lines / Keys | Description |
|---|---|---|
| `metadata.json` | `line 2-3` (`"name"`, `"description"`) | Applet name and meta description for AI Studio runtime and preview index. |
| `index.html` | `line 6` (`<title>`) | Browser tab title: `WireCraft - Virtual Network Architecture Simulator` |
| `index.html` | `line 7` (`<link rel="icon">`) | Favicon SVG reference (`/favicon.svg`) |
| `index.html` | `line 8-10` (`meta description`, `og:title`, `og:description`) | OpenGraph and search engine meta description cards |
| `package.json` | `line 2` (`"name"`) | NPM package name: `"wirecraft"` |
| `PROJECT.md` | `line 1, 51` | Root project overview title and legal/trademark attribution section |

---

## 2. Graphic Assets & Logo Components

| File | Type | Description |
|---|---|---|
| `src/components/WireCraftLogo.tsx` | React Component | Primary vector SVG brand logo component (`WireCraftLogo`). Contains symbol geometry (cybernetic switch fabric/nodes) and the gradient text wordmark `"WIRECRAFT"`. |
| `src/assets/images/wirecraft_logo.svg` | SVG Vector Asset | Standalone master SVG icon (dark plate, cyan/indigo circuit traces, glow filters). |
| `public/favicon.svg` | Public Web Asset | Root browser favicon served directly at `/favicon.svg`. |
| `public/wirecraft_logo.svg` | Public Web Asset | Root static vector logo served directly at `/wirecraft_logo.svg`. |
| `src/assets/images/wirecraft_mascot_packet_pete.jpg` | Image Asset | Mascot illustration asset for Packet Pete (`wirecraft_mascot_packet_pete.jpg`). |

---

## 3. UI Components, Modals & Navigation

| File | Lines / Elements | Description |
|---|---|---|
| `src/components/TopBar.tsx` | `line 22, 98-101` | Top application header: imports and renders `<WireCraftLogo size="sm" />`, gradient wordmark `WireCraft`, and subtitle `VIRTUAL NETWORK ARCHITECTURE`. |
| `src/components/AboutLegalModal.tsx` | `line 3, 35, 46, 49, 81` | About & Legal modal: renders `<WireCraftLogo size="lg" showText />`, fair-use disclaimer, and `"WireCraft Educational Edition"` footer. |
| `src/components/MascotGuideModal.tsx` | `line 14, 27, 28, 97` | Packet Pete onboarding guide modal: Welcome title `"Welcome to WireCraft!"`, description text, and mascot modal header badge. |
| `src/components/CommandReferenceModal.tsx` | `line 1135` | Reference guide modal footer: `"WireCraft Universal Network Operating System Architecture"`. |
| `src/components/NocIncidentModal.tsx` | `line 239` | NOC Triage Assistant header: `"WireCraft NOC & AI TAC Architect"`. |
| `src/components/AiDiagramModal.tsx` | `line 111` | Canvas image export filename: `wirecraft-diagram-${Date.now()}.png`. |
| `src/App.tsx` | `line 604` | Topology JSON export filename: `WireCraft_Lab_Topology_${date}.json`. |

---

## 4. Device Emulation, CLI Engines & Hostnames

| File | Lines / Context | Description |
|---|---|---|
| `src/components/DeviceInspector.tsx` | `line 94` | ASA/Firepower terminal banner: `"WireCraft ASA/Firepower Emulated Security Appliance"`. |
| `src/components/DeviceInspector.tsx` | `line 104` | Nexus switch banner: `"WireCraft NX-OS-Compatible Switch Engine"`. |
| `src/components/DeviceInspector.tsx` | `line 113` | Wireless LAN Controller banner: `"WireCraft AireOS-Compatible Controller Emulation"`. |
| `src/components/DeviceInspector.tsx` | `line 123` | Catalyst switch banner: `"WireCraft Catalyst-Compatible Switch Engine"`. |
| `src/components/DeviceInspector.tsx` | `line 131` | Router banner: `"WireCraft IOS-Compatible Router Engine (Emulated C2900)"`. |
| `src/components/DeviceInspector.tsx` | `line 145, 720` | PC Desktop Command Prompt: `"WireCraft Command Prompt [Version 1.0]"` and `"WireCraft Workstation OS v10.0"`. |
| `src/components/DeviceInspector.tsx` | `line 147, 646, 660, 663, 682, 714, 718, 775, 2078` | Emulated web browser, DNS records, and local domains: `wirecraft.local`, `ns1.wirecraft.lab`, `wirecraft-user\admin`, `"WireCraft Enterprise Web Engine"`. |
| `src/engine/cliEngine.ts` | `line 688` | IOS `reload` output: `"WireCraft IOS-Compatible Engine, Version 15.4(3)M2"`. |
| `src/engine/cliEngine.ts` | `line 2897` | IOS `show cdp neighbors detail` version string. |
| `src/engine/cliEngine.ts` | `line 3384` | LLDP / SNMP system description: `"WireCraft IOS-Compatible Engine"`. |
| `src/engine/cliEngine.ts` | `line 3713` | IOS `show inventory`: `"Manufacturer's Name... WireCraft Systems"`. |
| `src/engine/cliEngine.ts` | `line 3737, 3753-3755` | IOS `show version` banner and bootstrap notice: `"WireCraft IOS-Compatible Engine... ROM: WireCraft System Bootstrap"`. |
| `src/engine/deviceSpecs.ts` | `line 547, 553, 554` | Pre-configured DNS mapping and web server payload: `wirecraft.local`, `"WireCraft Enterprise Portal"`. |
| `src/engine/topologyBridge.ts` | `line 45` | Engine JSDoc and helper comments referencing normalized WireCraft objects. |
| `src/engine/__tests__/cliEngine.test.ts` | `line 147, 151, 159` | Unit tests asserting the presence of the `WireCraft` educational banner on `reload` and `show version`. |

---

## 5. Backend Server & AI TAC Co-Pilot Prompts

| File | Lines / Context | Description |
|---|---|---|
| `server.ts` | `line 373` | Gemini AI TAC Co-Pilot system prompt: `"You are the WireCraft AI TAC Co-Pilot, an elite Principal Network Architect..."`. |
| `server.ts` | `line 473` | Text-to-Topology AI synthesis prompt: `"The user wants to generate an interactive network topology lab in WireCraft from this natural language prompt..."`. |

---

## 6. Industrial Markdown Documentation

All documentation files located in `/markdown/` and `/src/` consistently reference the **WireCraft** brand:

| File | Scope |
|---|---|
| `markdown/INDEX.md` | Master documentation hub header, architecture diagrams, and task links. |
| `markdown/README.md` | Primary title, badges, feature descriptions, hardware emulation table, and license attribution. |
| `markdown/PROJECT.md` | Technical project scope, simulation validation status, and trademark disclaimers. |
| `markdown/ARCHITECTURE.md` | System topology diagrams, simulation pipeline, and concurrency specifications. |
| `markdown/CLI_REFERENCE.md` | Title, prompt hierarchy, 107 command specifications, and multi-vendor translation tables. |
| `markdown/API.md` | REST API header, service architecture, and backend diagnostic schemas. |
| `markdown/TESTING.md` | Vitest configuration, property-based invariants, and CLI execution tests. |
| `markdown/DEPLOYMENT.md` | Production deployment guide, Dockerfile, and container architecture. |
| `markdown/SECURITY.md` | Vulnerability disclosure policy, client sandbox isolation, and contact emails. |
| `markdown/ROADMAP.md` | Strategic milestones, release timeline, and multi-year engineering roadmap. |
| `markdown/CONTRIBUTING.md` | Community contribution standards, git branch naming, and pull request requirements. |
| `markdown/CODE_OF_CONDUCT.md` | Contributor Covenant v2.1 pledge and community standards. |
| `markdown/CHANGELOG.md` | Semantic release history documenting the v1.2.0 brand unification. |
| `src/README.md` | Source code architecture overview and module index. |
| `src/engine/README.md` | Core simulation engine, discrete clock, and protocol documentation. |
| `src/components/README.md` | UI component tree, floating window manager, and canvas controls. |
| `src/workers/README.md` | Web Worker background execution and message contracts. |
| `src/types/README.md` | TypeScript models and domain dictionary. |
| `src/utils/README.md` | Utility algorithms, IP bitwise math, and deep clone mechanics. |
| `src/data/README.md` | Pre-configured topologies, CCNA labs, and NOC incident scenarios. |

---

## 7. How to Rebrand in the Future (Quick Checklist)

When changing to a new brand name (e.g., from `WireCraft` to `NewBrand`):

1. **Case-Insensitive String Check**:
   ```bash
   grep -rIin "wirecraft" . --exclude-dir={node_modules,dist,.git}
   ```
2. **Key Name Variations to Replace**:
   - PascalCase / CamelCase: `WireCraft`
   - lowercase slug: `wirecraft`
   - UPPERCASE wordmark: `WIRECRAFT` (in `src/components/WireCraftLogo.tsx`)
   - Domain / hostnames: `wirecraft.local` -> `newbrand.local`
3. **Asset Files to Rename / Replace**:
   - `src/components/WireCraftLogo.tsx` (or rename to `NewBrandLogo.tsx`)
   - `src/assets/images/wirecraft_logo.svg` -> `newbrand_logo.svg`
   - `public/wirecraft_logo.svg` -> `public/newbrand_logo.svg`
   - `public/favicon.svg` (update vector content or replace)
4. **Verification Commands**:
   ```bash
   npm run lint        # Verifies TypeScript typing
   npm test            # Verifies all unit & property tests pass
   npm run build       # Verifies Vite production build
   ```

