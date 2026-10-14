import { Device, Link, CableType, DeviceType } from '../types/network';
import { createDevice, DEVICE_SPECS } from './deviceSpecs';
import { generateOfflineTopology, GeneratedTopologyResult } from './offlineTopologyGenerator';

export interface RawAiDevice {
  type: string;
  name: string;
  x?: number;
  y?: number;
  interfaces?: Record<
    string,
    {
      ip?: string;
      mask?: string;
      status?: 'up' | 'down';
      mode?: 'access' | 'trunk' | 'routed';
      accessVlan?: number;
    }
  >;
  vlans?: Record<string, string>;
  defaultGateway?: string;
  ospf?: {
    routerId?: string;
    networks?: Array<{ network?: string; prefix?: string; wildcard: string; area: number }>;
  };
}

export interface RawAiLink {
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
  cable?: CableType;
}

export interface RawAiTopologyResponse {
  title?: string;
  summary?: string;
  devices?: RawAiDevice[];
  links?: RawAiLink[];
  offlineFallback?: boolean;
}

/**
 * Normalizes and converts an AI or offline topology response into clean, fully-formed WireCraft objects.
 */
export function buildTopologyFromAiResponse(
  aiResponse: RawAiTopologyResponse,
  fallbackPrompt: string
): GeneratedTopologyResult {
  // If AI requested fallback or produced insufficient devices, use offline synthesizer
  if (aiResponse.offlineFallback || !aiResponse.devices || aiResponse.devices.length === 0) {
    return generateOfflineTopology(fallbackPrompt);
  }

  try {
    const devices: Device[] = [];
    const nameToDeviceMap = new Map<string, Device>();

    aiResponse.devices.forEach((rawDev, idx) => {
      // Validate device type
      const validTypes = Object.keys(DEVICE_SPECS) as DeviceType[];
      const type: DeviceType = validTypes.includes(rawDev.type as DeviceType)
        ? (rawDev.type as DeviceType)
        : rawDev.name.toLowerCase().startsWith('r')
        ? 'router'
        : rawDev.name.toLowerCase().startsWith('sw')
        ? 'switch'
        : 'pc';

      const x = typeof rawDev.x === 'number' && !isNaN(rawDev.x) ? rawDev.x : 200 + (idx % 3) * 220;
      const y = typeof rawDev.y === 'number' && !isNaN(rawDev.y) ? rawDev.y : 120 + Math.floor(idx / 3) * 160;

      const device = createDevice(type, rawDev.name || `Device-${idx + 1}`, x, y);

      // Apply interfaces overlay
      if (rawDev.interfaces) {
        for (const [portName, ifaceData] of Object.entries(rawDev.interfaces)) {
          if (device.config.interfaces[portName]) {
            if (ifaceData.ip) device.config.interfaces[portName].ip = ifaceData.ip;
            if (ifaceData.mask) device.config.interfaces[portName].mask = ifaceData.mask;
            if (ifaceData.status) device.config.interfaces[portName].status = ifaceData.status;
            if (ifaceData.mode) device.config.interfaces[portName].mode = ifaceData.mode;
            if (ifaceData.accessVlan) device.config.interfaces[portName].accessVlan = ifaceData.accessVlan;
          }
        }
      }

      // Apply VLANs
      if (rawDev.vlans) {
        for (const [vId, vName] of Object.entries(rawDev.vlans)) {
          const numId = parseInt(vId, 10);
          if (!isNaN(numId)) {
            device.config.vlans[numId] = { id: numId, name: String(vName) };
          }
        }
      }

      // Apply default gateway
      if (rawDev.defaultGateway) {
        device.config.defaultGateway = rawDev.defaultGateway;
      }

      // Apply OSPF
      if (rawDev.ospf) {
        device.config.ospf = {
          processId: 1,
          routerId: rawDev.ospf.routerId || `${idx + 1}.${idx + 1}.${idx + 1}.${idx + 1}`,
          networks: (rawDev.ospf.networks || []).map((n) => ({
            network: n.network || n.prefix || '0.0.0.0',
            wildcard: n.wildcard || '0.0.0.255',
            area: typeof n.area === 'number' ? n.area : 0,
          })),
        };
      }

      devices.push(device);
      nameToDeviceMap.set(device.name.toLowerCase(), device);
      nameToDeviceMap.set(rawDev.name.toLowerCase(), device);
    });

    const links: Link[] = [];
    if (aiResponse.links && Array.isArray(aiResponse.links)) {
      aiResponse.links.forEach((rawLink, lIdx) => {
        const devA = nameToDeviceMap.get(rawLink.from?.toLowerCase());
        const devB = nameToDeviceMap.get(rawLink.to?.toLowerCase());

        if (devA && devB && devA.id !== devB.id) {
          // Verify ports or fall back to first available port
          const portA = devA.config.interfaces[rawLink.fromPort]
            ? rawLink.fromPort
            : Object.keys(devA.config.interfaces)[0];
          const portB = devB.config.interfaces[rawLink.toPort]
            ? rawLink.toPort
            : Object.keys(devB.config.interfaces)[0];

          links.push({
            id: `ai_link_${lIdx}_${Date.now()}`,
            fromDevice: devA.id,
            fromPort: portA,
            toDevice: devB.id,
            toPort: portB,
            cable: rawLink.cable || 'straight',
          });
        }
      });
    }

    return {
      title: aiResponse.title || 'AI Synthesized Network Lab',
      summary: aiResponse.summary || 'Custom network architecture generated from natural language specifications.',
      devices,
      links,
      source: 'ai',
    };
  } catch (err) {
    console.warn('Error translating AI topology, using offline generator:', err);
    return generateOfflineTopology(fallbackPrompt);
  }
}
