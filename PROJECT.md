# NetSim: Cisco CCNA Network Simulator

## Overview
NetSim is an enterprise-grade, in-browser Cisco network simulator designed for CCNA students and network engineers to model, configure, and troubleshoot network topologies without the need for physical hardware or heavy virtualization software.

## Key Features
- **Interactive IOS CLI:** A simulated Command Line Interface for configuring Cisco devices (routers, switches, L3 switches).
- **Network Topology Simulation:** Create and manage complex topologies with routers, switches, servers, and endpoints.
- **Spanning Tree Protocol (STP):** Real-time convergence simulation.
- **Packet Tracing:** Step-by-step visual packet tracing through the simulated network to understand forwarding decisions.
- **Guided CCNA Labs:** A series of 10+ built-in lab scenarios to practice fundamental networking concepts.
- **AI Socratic Troubleshooting Mentor:** An AI-integrated assistant designed to guide students through troubleshooting network issues using Socratic questioning.
- **Multi-Device Support:** Includes various Cisco models such as the Catalyst 3650, 2960, and Nexus 9000.
- **Subnet Calculator:** Built-in tool for fast subnetting and VLSM calculations.

## Architecture
The application is structured into several key engine components:
- **Simulation Engine:** Manages the overall network state, device connectivity, and traffic forwarding.
- **CLI Engine:** Handles parsing and execution of Cisco IOS-like commands for network devices.
- **STP Engine:** Simulates the Spanning Tree Protocol state machine and convergence.
- **UI Components:** React-based frontend providing the canvas, device palette, and various modal interfaces (NOC, labs, packet inspector, etc.).

## Technical Stack
- **Framework:** React with Vite.
- **Language:** TypeScript.
- **Styling:** Tailwind CSS.
- **State Management:** React hooks.
- **Icons:** Lucide React.
- **Backend (Node.js/Express):** Handles server-side requirements (if applicable).

## Current Capabilities
NetSim currently supports a wide array of network design and configuration scenarios, focusing on CCNA-level routing and switching. It is highly extensible, allowing for the addition of new device models, protocols, and lab scenarios.
