import { calculateStp, calculatePvst } from '../engine/stpEngine';
import { computeOspf } from '../engine/ospfEngine';
import { simulatePing, simulateDhcp } from '../engine/simulationEngine';
import { computeEigrpNetworkState } from '../engine/protocols/eigrpEngine';
import { computeBgpNetworkState } from '../engine/protocols/bgpEngine';
import { computeHsrpNetworkState } from '../engine/protocols/hsrpEngine';
import { computeMplsNetworkState } from '../engine/protocols/mplsEngine';
import { computeIpsecSessions } from '../engine/protocols/ipsecEngine';
import { computeVxlanState } from '../engine/protocols/vxlanEngine';
import { computeSrv6State } from '../engine/protocols/srv6Engine';
import { computeIsisNetworkState } from '../engine/protocols/isisEngine';
import { computeWirelessIotNetworkState } from '../engine/protocols/wirelessIotEngine';
import { Device, Link } from '../types/network';

export type WorkerRequest =
  | {
      id: string;
      type: 'SOLVE_TOPOLOGY';
      devices: Device[];
      links: Link[];
      vlanId?: number;
    }
  | {
      id: string;
      type: 'SIMULATE_PING';
      srcDevId: string;
      dstIp: string;
      devices: Device[];
      links: Link[];
    }
  | {
      id: string;
      type: 'SIMULATE_DHCP';
      clientDevId: string;
      devices: Device[];
      links: Link[];
    };

export type WorkerResponse =
  | {
      id: string;
      type: 'SOLVE_TOPOLOGY_RESULT';
      stpState: any;
      ospfState: any;
      eigrpState?: any;
      bgpState?: any;
      isisState?: any;
      hsrpState?: any;
      mplsState?: any;
      ipsecState?: any;
      vxlanState?: any;
      srv6State?: any;
      wirelessIotState?: any;
      computeLatencyMs: number;
    }
  | {
      id: string;
      type: 'SIMULATE_PING_RESULT';
      result: ReturnType<typeof simulatePing>;
      computeLatencyMs: number;
    }
  | {
      id: string;
      type: 'SIMULATE_DHCP_RESULT';
      result: ReturnType<typeof simulateDhcp>;
      computeLatencyMs: number;
    }
  | {
      id: string;
      type: 'ERROR';
      error: string;
      stack?: string;
      computeLatencyMs: number;
    };

// Handle incoming messages on worker thread
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  const tStart = performance.now();

  // 1. Validate request structure
  if (!req || typeof req.id !== 'string' || typeof req.type !== 'string') {
    self.postMessage({
      id: (req && typeof (req as any).id === 'string') ? (req as any).id : 'UNKNOWN',
      type: 'ERROR',
      error: 'Invalid worker request format (missing id or type)',
      computeLatencyMs: 0,
    });
    return;
  }

  try {
    switch (req.type) {
      case 'SOLVE_TOPOLOGY': {
        if (!Array.isArray(req.devices) || !Array.isArray(req.links)) {
          throw new Error('SOLVE_TOPOLOGY requires valid devices and links arrays');
        }
        const stpState = calculatePvst(req.devices, req.links);
        const ospfState = computeOspf(req.devices, req.links, stpState);
        const eigrpState = computeEigrpNetworkState(req.devices, req.links);
        const bgpState = computeBgpNetworkState(req.devices, req.links);
        const isisState = computeIsisNetworkState(req.devices, req.links);
        const hsrpState = computeHsrpNetworkState(req.devices, req.links);
        const mplsState = computeMplsNetworkState(req.devices, req.links);
        const ipsecState = computeIpsecSessions(req.devices);
        const vxlanState = computeVxlanState(req.devices);
        const srv6State = computeSrv6State(req.devices);
        const wirelessIotState = computeWirelessIotNetworkState(req.devices, req.links);
        const computeLatencyMs = performance.now() - tStart;

        const response: WorkerResponse = {
          id: req.id,
          type: 'SOLVE_TOPOLOGY_RESULT',
          stpState,
          ospfState,
          eigrpState,
          bgpState,
          isisState,
          hsrpState,
          mplsState,
          ipsecState,
          vxlanState,
          srv6State,
          wirelessIotState,
          computeLatencyMs,
        };
        self.postMessage(response);
        break;
      }

      case 'SIMULATE_PING': {
        if (!req.srcDevId || !req.dstIp || !Array.isArray(req.devices) || !Array.isArray(req.links)) {
          throw new Error('SIMULATE_PING requires valid srcDevId, dstIp, devices, and links arrays');
        }
        const result = simulatePing(req.srcDevId, req.dstIp, req.devices, req.links);
        const computeLatencyMs = performance.now() - tStart;

        const response: WorkerResponse = {
          id: req.id,
          type: 'SIMULATE_PING_RESULT',
          result,
          computeLatencyMs,
        };
        self.postMessage(response);
        break;
      }

      case 'SIMULATE_DHCP': {
        if (!req.clientDevId || !Array.isArray(req.devices) || !Array.isArray(req.links)) {
          throw new Error('SIMULATE_DHCP requires valid clientDevId, devices, and links arrays');
        }
        const result = simulateDhcp(req.clientDevId, req.devices, req.links);
        const computeLatencyMs = performance.now() - tStart;

        const response: WorkerResponse = {
          id: req.id,
          type: 'SIMULATE_DHCP_RESULT',
          result,
          computeLatencyMs,
        };
        self.postMessage(response);
        break;
      }

      default: {
        const response: WorkerResponse = {
          id: (req as any)?.id || 'unknown',
          type: 'ERROR',
          error: `Unknown worker request type: ${(req as any)?.type}`,
          computeLatencyMs: performance.now() - tStart,
        };
        self.postMessage(response);
      }
    }
  } catch (err: any) {
    const computeLatencyMs = performance.now() - tStart;
    const response: WorkerResponse = {
      id: (req as any)?.id || 'unknown',
      type: 'ERROR',
      error: err?.message || 'Worker computation error',
      stack: err?.stack,
      computeLatencyMs,
    };
    self.postMessage(response);
  }
};
