import { calculateStp, calculatePvst } from '../engine/stpEngine';
import { computeOspf } from '../engine/ospfEngine';
import { simulatePing, simulateDhcp } from '../engine/simulationEngine';
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
      computeLatencyMs: number;
    };

// Handle incoming messages on worker thread
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (!req || !req.id) return;

  const tStart = performance.now();

  try {
    switch (req.type) {
      case 'SOLVE_TOPOLOGY': {
        const stpState = calculatePvst(req.devices, req.links);
        const ospfState = computeOspf(req.devices, req.links, stpState);
        const computeLatencyMs = performance.now() - tStart;

        const response: WorkerResponse = {
          id: req.id,
          type: 'SOLVE_TOPOLOGY_RESULT',
          stpState,
          ospfState,
          computeLatencyMs,
        };
        self.postMessage(response);
        break;
      }

      case 'SIMULATE_PING': {
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
          id: (req as any).id,
          type: 'ERROR',
          error: `Unknown worker request type: ${(req as any).type}`,
          computeLatencyMs: performance.now() - tStart,
        };
        self.postMessage(response);
      }
    }
  } catch (err: any) {
    const computeLatencyMs = performance.now() - tStart;
    const response: WorkerResponse = {
      id: req.id,
      type: 'ERROR',
      error: err?.message || 'Worker computation error',
      computeLatencyMs,
    };
    self.postMessage(response);
  }
};
