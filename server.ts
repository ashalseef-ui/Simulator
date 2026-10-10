import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));

  // Initialize Gemini SDK with telemetry header
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  // Endpoint: Generate high-quality network topology / diagram image
  app.post('/api/ai/generate-diagram', async (req, res) => {
    try {
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini API key is not configured. Please ensure GEMINI_API_KEY is available.',
        });
      }

      const {
        prompt,
        imageSize = '1K',
        aspectRatio = '16:9',
      } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Model: gemini-3-pro-image-preview per requirement
      // Supporting imageSize 1K, 2K, 4K
      const modelName = 'gemini-3-pro-image-preview';

      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              text: `High quality, clean professional Cisco network architecture diagram or topology illustration: ${prompt}. Professional IT engineering standard, sharp crisp details, technical schematic aesthetic.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: imageSize as any,
          },
        },
      });

      let imageUrl: string | null = null;
      let textResponse = '';

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
            break;
          } else if (part.text) {
            textResponse += part.text;
          }
        }
      }

      if (!imageUrl) {
        return res.status(500).json({
          error: 'No image was returned from the model.',
          details: textResponse,
        });
      }

      return res.json({ imageUrl, text: textResponse });
    } catch (error: any) {
      console.error('Error generating diagram:', error);
      return res.status(500).json({
        error: error.message || 'Failed to generate diagram image',
      });
    }
  });

  // Endpoint: Create & edit images using gemini-3.1-flash-image-preview
  app.post('/api/ai/edit-diagram', async (req, res) => {
    try {
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini API key is not configured. Please ensure GEMINI_API_KEY is available.',
        });
      }

      const { prompt, base64Image, mimeType = 'image/png' } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const modelName = 'gemini-3.1-flash-image-preview';

      const parts: any[] = [];

      if (base64Image) {
        const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType,
            data: cleanBase64,
          },
        });
      }

      parts.push({
        text: prompt,
      });

      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts,
        },
      });

      let imageUrl: string | null = null;
      let textResponse = '';

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const outMime = part.inlineData.mimeType || 'image/png';
            imageUrl = `data:${outMime};base64,${part.inlineData.data}`;
            break;
          } else if (part.text) {
            textResponse += part.text;
          }
        }
      }

      if (!imageUrl && !textResponse) {
        return res.status(500).json({ error: 'No output received from the model.' });
      }

      return res.json({ imageUrl, text: textResponse });
    } catch (error: any) {
      console.error('Error editing diagram:', error);
      return res.status(500).json({
        error: error.message || 'Failed to edit diagram',
      });
    }
  });

  // Endpoint: AI Network Diagnostics & Deep Root-Cause Analysis
  app.post('/api/ai/diagnose', async (req, res) => {
    try {
      const { devices = [], links = [], currentIncident = null, query = '' } = req.body;

      // Extract high-level summary of topology
      const topologySummary = devices.map((d: any) => {
        const ifaces = Object.entries(d.config?.interfaces || {}).map(([name, iface]: [string, any]) => {
          return `${name} (IP: ${iface.ip || 'none'}/${iface.mask || 'none'}, Mode: ${iface.mode || 'access'}, VLAN: ${iface.accessVlan || iface.encapsulationDot1Q || 1}, Status: ${iface.status})`;
        }).join('; ');
        const routes = (d.config?.routes || []).map((r: any) => `ip route ${r.network} ${r.mask} ${r.nextHop}`).join(', ');
        const ospf = d.config?.ospf ? `OSPF PID ${d.config.ospf.processId} networks: ${JSON.stringify(d.config.ospf.networks)}` : 'None';
        return `Device: ${d.name} (${d.type}), Hostname: ${d.config?.hostname || d.name}, STP Priority: ${d.config?.spanningTreePriority ?? 32768}\n  Interfaces: ${ifaces}\n  Static Routes: ${routes || 'None'}\n  OSPF: ${ospf}`;
      }).join('\n\n');

      const linksSummary = links.map((l: any) => {
        return `Link: ${l.fromDevice}:${l.fromPort} <---> ${l.toDevice}:${l.toPort} [Cable: ${l.cable}]`;
      }).join('\n');

      if (!ai) {
        // Intelligent local diagnostic fallback if API key is not configured
        const fallbackIssues: string[] = [];
        let score = 95;

        // Check for common topology mistakes
        devices.forEach((d: any) => {
          if ((d.type === 'pc' || d.type === 'laptop') && !d.config?.defaultGateway) {
            fallbackIssues.push(`[Host Gateway Missing] ${d.name} has no Default Gateway configured; cannot route off-subnet.`);
            score -= 10;
          }
          if (d.type === 'router' && !d.config?.ipRoutingEnabled) {
            fallbackIssues.push(`[IP Routing Disabled] Router ${d.name} has ip routing disabled.`);
            score -= 15;
          }
          Object.entries(d.config?.interfaces || {}).forEach(([name, iface]: [string, any]) => {
            if (name.includes('.') && !iface.encapsulationDot1Q) {
              fallbackIssues.push(`[Subinterface Encapsulation Missing] ${d.name} ${name} requires 'encapsulation dot1Q <vlan>'.`);
              score -= 15;
            }
          });
        });

        return res.json({
          score: Math.max(score, 40),
          summary: `Heuristic Diagnostic Complete: Analyzed ${devices.length} devices and ${links.length} physical links.`,
          issues: fallbackIssues.length > 0 ? fallbackIssues : ['No critical Layer 1/2 faults detected.'],
          remediation: [
            '1. Verify IP addressing and subnet masks on all interconnecting interfaces.',
            '2. Run "show ip interface brief" and "show ip route" on all routers.',
            '3. Use "show spanning-tree" to verify root bridge placement.',
            '4. Test reachability with extended ping and traceroute.',
          ],
          aiGenerated: false,
        });
      }

      // Call Gemini 3.8 Flash for deep learning network diagnosis
      const promptText = `
You are an Elite Cisco TAC Principal Network Architect (CCIE #99999).
Analyze the following Cisco network topology, running configurations, and links to diagnose problems, explain protocol behaviors, and provide exact Cisco IOS CLI remediation solutions.

${currentIncident ? `CURRENT OUTAGE TICKET:\nTitle: ${currentIncident.title}\nSeverity: ${currentIncident.severity}\nDescription: ${currentIncident.description}\nTarget: ${currentIncident.objective}\n` : ''}
${query ? `USER QUERY: ${query}\n` : ''}

NETWORK TOPOLOGY:
${topologySummary}

PHYSICAL CABLING:
${linksSummary}

Respond in clean, structured JSON format with this exact schema:
{
  "score": <number between 0 and 100 representing network health>,
  "summary": "<1-2 sentence executive summary of network state>",
  "issues": ["<Issue 1 with affected device>", "<Issue 2>"],
  "rootCauseAnalysis": "<Technical deep dive into the protocol/packet layer reason (e.g. STP port state, OSPF DBD MTU mismatch, ARP broadcast domain boundary, ACL rule ordering)>",
  "remediation": ["<Exact step 1 with IOS command>", "<Exact step 2 with IOS command>"],
  "verificationCommands": ["<Command 1 e.g. show ip ospf neighbor>", "<Command 2 e.g. debug ip icmp>"]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          systemInstruction: 'You are an expert Cisco CCIE Architect and TAC Escalation Engineer. Provide precise, technical, real-world network diagnostics and Cisco IOS commands.',
        },
      });

      const responseText = response.text || '';
      try {
        const parsed = JSON.parse(responseText);
        return res.json({ ...parsed, aiGenerated: true });
      } catch (parseErr) {
        return res.json({
          score: 85,
          summary: 'Diagnostic generated successfully.',
          rawAnalysis: responseText,
          issues: ['Refer to detailed analysis report.'],
          remediation: ['Review configuration commands in the analysis report.'],
          verificationCommands: ['show ip interface brief', 'show running-config'],
          aiGenerated: true,
        });
      }
    } catch (error: any) {
      console.error('Error running AI network diagnosis:', error);
      return res.status(500).json({
        error: error.message || 'Failed to complete AI network diagnosis',
      });
    }
  });

  // Endpoint: Interactive AI TAC Co-Pilot Chat
  app.post('/api/ai/tac-copilot', async (req, res) => {
    try {
      const { message, deviceContext = null, topologyContext = null } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!ai) {
        // Fallback response if GEMINI_API_KEY is not set
        return res.json({
          reply: `[TAC Advisor Mode] Analyzing request: "${message}".\n\nFor Cisco IOS troubleshooting:\n1. Use "show ip interface brief" to check layer 1/2 status.\n2. Use "show ip route" to verify routing table reachability.\n3. Use "show spanning-tree" to verify root bridge and blocked ports.\n4. Use "debug ip icmp" or "terminal monitor" for live packet capture diagnostics.`,
        });
      }

      const promptContext = `
You are the NetCraft AI TAC Co-Pilot, an elite Cisco CCIE Network Architect embedded in an interactive Cisco CCNA network simulator.
Answer the engineer's question clearly, practically, with exact Cisco IOS CLI syntax, packet-level protocol explanations (OSPF, STP, EIGRP, BGP, NAT, ACL, DHCP, VLANs), and step-by-step troubleshooting workflows.

${deviceContext ? `CURRENT DEVICE CONTEXT:\nHostname: ${deviceContext.hostname}\nType: ${deviceContext.type}\nRunning Config:\n${deviceContext.runningConfig || 'Default'}\n` : ''}
${topologyContext ? `TOPOLOGY CONTEXT: Total Devices: ${topologyContext.deviceCount}, Active Names: ${topologyContext.deviceNames?.join(', ')}\n` : ''}

USER QUESTION:
${message}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptContext,
        config: {
          systemInstruction: 'You are a friendly, highly technical Cisco TAC Escalation Engineer (CCIE #99999). Provide concise, authoritative advice with exact Cisco IOS commands and architectural best practices.',
        },
      });

      return res.json({ reply: response.text || 'No response generated.' });
    } catch (error: any) {
      console.error('Error in AI TAC Co-Pilot:', error);
      return res.status(500).json({
        error: error.message || 'TAC Co-Pilot service encountered an error',
      });
    }
  });

  // Endpoint: AI Socratic Troubleshooting Mentor
  app.post('/api/ai/socratic-mentor', async (req, res) => {
    try {
      const { question, topologyContext = null, runningConfig = '' } = req.body;

      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      if (!ai) {
        return res.json({
          reply: `[Socratic Mentor Offline Mode] To solve "${question}":\n\nAsk yourself:\n1. Are the devices in the same subnet mask range?\n2. Is the default gateway correctly specified on the host?\n3. Have you verified Layer 1/2 line protocols with "show ip interface brief"?`,
          hints: ['Check subnet masks', 'Verify physical link status', 'Check default gateway'],
        });
      }

      const prompt = `
You are an expert Socratic Networking Mentor and CCIE Instructor.
Your goal is to teach networking concepts and guide the student through troubleshooting without simply giving away direct answers.
Instead of providing the complete solution immediately:
1. Ask 1-2 probing Socratic questions that make the student think about the underlying packet flow or protocol state (OSPF, STP, VLANs, subnetting, ARP, ACLs).
2. Explain the core networking principle involved.
3. Provide incremental, targeted conceptual hints.

STUDENT QUESTION / ISSUE:
${question}

TOPOLOGY CONTEXT:
${topologyContext ? JSON.stringify(topologyContext) : 'Standard lab topology'}

RUNNING CONFIG CONTEXT:
${runningConfig || 'None provided'}

Respond in clean JSON format:
{
  "reply": "<Socratic response with guiding questions and principle explanation>",
  "hints": ["<Hint 1>", "<Hint 2>"]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          systemInstruction: 'You are an elite Socratic networking instructor. Teach through guided questions and deep conceptual explanations.',
        },
      });

      const text = response.text || '';
      try {
        const parsed = JSON.parse(text);
        return res.json(parsed);
      } catch (err) {
        return res.json({
          reply: text || 'Consider checking your interface status and subnet masks.',
          hints: ['Verify subnet masks', 'Check routing table'],
        });
      }
    } catch (error: any) {
      console.error('Error in Socratic mentor:', error);
      return res.status(500).json({ error: error.message || 'Socratic mentor service error' });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`Server listening at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
