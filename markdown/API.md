# WireCraft Backend REST API Reference

> [📖 Doc Hub](./INDEX.md) • [🏗️ Architecture](./ARCHITECTURE.md) • [💻 CLI Reference](./CLI_REFERENCE.md) • [🔌 REST API](./API.md) • [🧪 Testing](./TESTING.md) • [🚀 Deployment](./DEPLOYMENT.md) • [🔒 Security](./SECURITY.md) • [🗺️ Roadmap](./ROADMAP.md) • [🏷️ Brand Guide](./BRAND_LOC.md) • [🤝 Contributing](./CONTRIBUTING.md)

The WireCraft backend service (`server.ts`) provides full-stack AI orchestration, topology diagnostics, schematic diagram synthesis, and server health checks.

---

## 1. Global Specifications

- **Base URL**: `http://localhost:3000` (or your production domain)
- **Content-Type**: `application/json`
- **Authentication**: None required for client SPA; backend uses server-side `GEMINI_API_KEY`.
- **Rate Limits (Per IP)**:
  - Text endpoints: `20 requests / minute` (HTTP 429 on breach)
  - Image endpoints: `4 requests / minute` (HTTP 429 on breach)
- **Body Payload Limit**:
  - Standard routes: `512 KB`
  - `/api/ai/edit-diagram`: `12 MB`

---

## 2. Health & Status

### `GET /api/health`
Returns server readiness and status of the Google GenAI integration.

#### Response (`200 OK`)
```json
{
  "ok": true,
  "ai": true
}
```

---

## 3. Network Diagnostics & Root Cause Analysis

### `POST /api/ai/diagnose`
Analyzes a live network topology, checks interface configurations, executes simulator-grounded OSPF analysis, and returns structured diagnosis and IOS remediation steps.

#### Request Body
```json
{
  "devices": [
    {
      "id": "r1",
      "name": "R1-HQ",
      "type": "router",
      "config": {
        "hostname": "R1-HQ",
        "ipRoutingEnabled": true,
        "interfaces": {
          "Gi0/0": {
            "ip": "10.0.0.1",
            "mask": "255.255.255.252",
            "status": "up",
            "mode": "routed"
          }
        },
        "ospf": {
          "processId": 1,
          "networks": [
            { "prefix": "10.0.0.0", "wildcard": "0.0.0.3", "area": 0 }
          ]
        }
      }
    }
  ],
  "links": [
    {
      "fromDevice": "r1",
      "fromPort": "Gi0/0",
      "toDevice": "r2",
      "toPort": "Gi0/0",
      "cable": "straight"
    }
  ],
  "currentIncident": {
    "title": "OSPF Adjacency Failure",
    "severity": "High",
    "description": "R1 and R2 fail to reach 2-WAY or FULL state.",
    "objective": "Restore OSPF adjacency between R1 and R2."
  },
  "query": "Why is OSPF stuck in ExStart/Exchange?"
}
```

#### Response (`200 OK`)
```json
{
  "score": 65,
  "summary": "OSPF neighbor relationship between R1-HQ and R2-Branch is broken due to MTU mismatch.",
  "issues": [
    "R1-HQ Gi0/0 MTU (1500) differs from R2-Branch Gi0/0 MTU (1400)."
  ],
  "rootCauseAnalysis": "During the OSPF Exchange state, Database Description (DBD) packets with differing MTU sizes cause DBD exchange packets to be rejected.",
  "remediation": [
    "configure terminal",
    "interface GigabitEthernet0/0",
    "ip mtu 1500",
    "end"
  ],
  "verificationCommands": [
    "show ip ospf neighbor",
    "show ip ospf interface GigabitEthernet0/0"
  ],
  "aiGenerated": true
}
```

---

## 4. Interactive TAC Co-Pilot

### `POST /api/ai/tac-copilot`
Interactive Tier-3 network architect assistant for direct troubleshooting, IOS syntax inquiries, and configuration reviews.

#### Request Body
```json
{
  "message": "How do I configure Router-on-a-Stick for VLAN 10 and VLAN 20?",
  "deviceContext": {
    "hostname": "R1-HQ",
    "type": "router",
    "runningConfig": "interface Gi0/0\n no ip address\n no shutdown"
  },
  "topologyContext": {
    "deviceCount": 4,
    "deviceNames": ["R1-HQ", "SW-Core", "PC1", "PC2"]
  }
}
```

#### Response (`200 OK`)
```json
{
  "reply": "To configure Router-on-a-Stick for VLAN 10 and VLAN 20:\n\n1. Ensure the physical port is up:\n   Router(config)# interface GigabitEthernet0/0\n   Router(config-if)# no shutdown\n\n2. Create subinterfaces with 802.1Q encapsulation:\n   Router(config)# interface GigabitEthernet0/0.10\n   Router(config-subif)# encapsulation dot1Q 10\n   Router(config-subif)# ip address 192.168.10.1 255.255.255.0\n\n   Router(config)# interface GigabitEthernet0/0.20\n   Router(config-subif)# encapsulation dot1Q 20\n   Router(config-subif)# ip address 192.168.20.1 255.255.255.0\n\n3. Verify switch trunking on the connecting port:\n   Switch(config-if)# switchport mode trunk"
}
```

---

## 5. Socratic Troubleshooting Mentor

### `POST /api/ai/socratic-mentor`
Pedagogical assistant that guides students through network troubleshooting without giving away solutions immediately.

#### Request Body
```json
{
  "question": "PC0 cannot ping Server0 across the router.",
  "topologyContext": { "deviceCount": 3 },
  "runningConfig": "interface Fa0/0\n ip address 192.168.1.1 255.255.255.0"
}
```

#### Response (`200 OK`)
```json
{
  "reply": "Consider the journey of an ICMP Echo Request packet from PC0:\n1. When PC0 evaluates the destination IP of Server0, does it determine the target is on its local subnet or a remote subnet?\n2. If remote, what configuration setting on PC0 is required to forward packets to the router?\n3. Check whether PC0 has a Default Gateway configured.",
  "hints": [
    "Check PC0 IP configuration settings for a Default Gateway.",
    "Verify the router interface facing PC0 has matching subnet mask."
  ]
}
```

---

## 6. Text-to-Topology Builder

### `POST /api/ai/text-to-topology`
Synthesizes a complete, valid multi-device topology JSON payload from a natural language prompt.

#### Request Body
```json
{
  "prompt": "Build an enterprise branch network with 2 OSPF routers connected to a core switch and two PCs in different subnets."
}
```

#### Response (`200 OK`)
```json
{
  "title": "Enterprise Branch OSPF",
  "summary": "Dual OSPF area 0 routers interconnected with a core switch and 2 client workstations.",
  "devices": [
    {
      "name": "R1-HQ",
      "type": "router",
      "x": 300,
      "y": 120,
      "interfaces": {
        "Gi0/0": { "ip": "10.0.0.1", "mask": "255.255.255.252", "status": "up", "mode": "routed" },
        "Gi0/1": { "ip": "192.168.10.1", "mask": "255.255.255.0", "status": "up", "mode": "routed" }
      },
      "ospf": {
        "routerId": "1.1.1.1",
        "networks": [
          { "prefix": "10.0.0.0", "wildcard": "0.0.0.3", "area": 0 },
          { "prefix": "192.168.10.0", "wildcard": "0.0.0.255", "area": 0 }
        ]
      }
    }
  ],
  "links": [
    {
      "from": "R1-HQ",
      "fromPort": "Gi0/0",
      "to": "R2-Branch",
      "toPort": "Gi0/0",
      "cable": "straight"
    }
  ]
}
```

---

## 7. Diagram & Schematic Image Generation

### `POST /api/ai/generate-diagram`
Generates high-resolution 1K, 2K, or 4K network schematic diagram images using `gemini-3-pro-image-preview`.

#### Request Body
```json
{
  "prompt": "Corporate campus network topology with redundant core switches and edge firewalls",
  "imageSize": "2K",
  "aspectRatio": "16:9"
}
```

#### Response (`200 OK`)
```json
{
  "imageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "text": "Clean technical network schematic generated."
}
```

---

### `POST /api/ai/edit-diagram`
Performs multimodal editing and refinement on existing diagram images using `gemini-3.1-flash-image-preview`.

#### Request Body
```json
{
  "prompt": "Add a redundant WAN link connecting the secondary data center",
  "base64Image": "data:image/png;base64,iVBORw0KGgo...",
  "mimeType": "image/png"
}
```

#### Response (`200 OK`)
```json
{
  "imageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "text": "Redundant WAN connection added."
}
```
