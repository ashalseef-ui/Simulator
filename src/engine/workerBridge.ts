import { Device, Link, StpTopologyState } from '../types/network';
import { calculateStp, calculatePvst } from './stpEngine';
import { computeOspf, OspfState } from './ospfEngine';
import { simulatePing, simulateDhcp } from './simulationEngine';
import { DiscreteVirtualClock } from './virtualClock';
import { WorkerRequest, WorkerResponse } from '../workers/simulationWorker';

export interface TopologySolveResult {
  stpState: StpTopologyState;
  ospfState: OspfState;
  computeLatencyMs: number;
  engineMode: 'worker' | 'main-thread';
}

class SimulationWorkerBridge {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private isWorkerSupported = false;
  public clock = new DiscreteVirtualClock(50); // 50ms tick duration

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../workers/simulationWorker.ts', import.meta.url), {
          type: 'module',
        });

        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const res = event.data;
          if (!res || !res.id) return;

          const pending = this.pendingRequests.get(res.id);
          if (pending) {
            this.pendingRequests.delete(res.id);
            if (res.type === 'ERROR') {
              pending.reject(new Error(res.error));
            } else {
              pending.resolve(res);
            }
          }
        };

        this.worker.onerror = (err) => {
          console.warn('Simulation Web Worker encountered an error, falling back to main-thread:', err);
          this.isWorkerSupported = false;
          this.clock.setEngineMode('main-thread');
        };

        this.isWorkerSupported = true;
        this.clock.setEngineMode('worker');
      } catch (e) {
        console.warn('Simulation Web Worker initialization skipped (environment without worker support):', e);
        this.isWorkerSupported = false;
        this.clock.setEngineMode('main-thread');
      }
    } else {
      this.isWorkerSupported = false;
      this.clock.setEngineMode('main-thread');
    }
  }

  private sendWorkerRequest<T extends WorkerResponse>(req: WorkerRequest): Promise<T> {
    if (!this.worker || !this.isWorkerSupported) {
      return Promise.reject(new Error('Worker not available'));
    }

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(req.id, { resolve, reject });
      this.worker!.postMessage(req);
    });
  }

  /**
   * Solves Spanning Tree Protocol (STP) and OSPF shortest-path link state
   * asynchronously off the main UI thread.
   */
  public async solveTopology(
    devices: Device[],
    links: Link[],
    vlanId = 1
  ): Promise<TopologySolveResult> {
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tStart = performance.now();

    if (this.worker && this.isWorkerSupported) {
      try {
        const response = await this.sendWorkerRequest<Extract<WorkerResponse, { type: 'SOLVE_TOPOLOGY_RESULT' }>>({
          id,
          type: 'SOLVE_TOPOLOGY',
          devices,
          links,
          vlanId,
        });

        this.clock.recordComputeLatency(response.computeLatencyMs);
        return {
          stpState: response.stpState,
          ospfState: response.ospfState,
          computeLatencyMs: response.computeLatencyMs,
          engineMode: 'worker',
        };
      } catch (err) {
        console.warn('Worker solveTopology failed, fallback to in-thread calculation:', err);
      }
    }

    // Deterministic in-thread fallback (PVST+ across all active VLANs)
    const stpState = calculatePvst(devices, links);
    const ospfState = computeOspf(devices, links, stpState);
    const latency = performance.now() - tStart;
    this.clock.recordComputeLatency(latency);

    return {
      stpState,
      ospfState,
      computeLatencyMs: latency,
      engineMode: 'main-thread',
    };
  }

  /**
   * Simulates an end-to-end ping trace off the main UI thread.
   */
  public async simulatePingAsync(
    srcDevId: string,
    dstIp: string,
    devices: Device[],
    links: Link[]
  ): Promise<ReturnType<typeof simulatePing> & { computeLatencyMs: number; engineMode: 'worker' | 'main-thread' }> {
    const id = `ping_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tStart = performance.now();

    if (this.worker && this.isWorkerSupported) {
      try {
        const response = await this.sendWorkerRequest<Extract<WorkerResponse, { type: 'SIMULATE_PING_RESULT' }>>({
          id,
          type: 'SIMULATE_PING',
          srcDevId,
          dstIp,
          devices,
          links,
        });

        this.clock.recordComputeLatency(response.computeLatencyMs);
        return {
          ...response.result,
          computeLatencyMs: response.computeLatencyMs,
          engineMode: 'worker',
        };
      } catch (err) {
        console.warn('Worker simulatePing failed, fallback to in-thread execution:', err);
      }
    }

    const result = simulatePing(srcDevId, dstIp, devices, links);
    const latency = performance.now() - tStart;
    this.clock.recordComputeLatency(latency);

    return {
      ...result,
      computeLatencyMs: latency,
      engineMode: 'main-thread',
    };
  }

  /**
   * Simulates dynamic 4-way DHCP DORA exchange off the main UI thread.
   */
  public async simulateDhcpAsync(
    clientDevId: string,
    devices: Device[],
    links: Link[]
  ): Promise<ReturnType<typeof simulateDhcp> & { computeLatencyMs: number; engineMode: 'worker' | 'main-thread' }> {
    const id = `dhcp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tStart = performance.now();

    if (this.worker && this.isWorkerSupported) {
      try {
        const response = await this.sendWorkerRequest<Extract<WorkerResponse, { type: 'SIMULATE_DHCP_RESULT' }>>({
          id,
          type: 'SIMULATE_DHCP',
          clientDevId,
          devices,
          links,
        });

        this.clock.recordComputeLatency(response.computeLatencyMs);
        return {
          ...response.result,
          computeLatencyMs: response.computeLatencyMs,
          engineMode: 'worker',
        };
      } catch (err) {
        console.warn('Worker simulateDhcp failed, fallback to in-thread execution:', err);
      }
    }

    const result = simulateDhcp(clientDevId, devices, links);
    const latency = performance.now() - tStart;
    this.clock.recordComputeLatency(latency);

    return {
      ...result,
      computeLatencyMs: latency,
      engineMode: 'main-thread',
    };
  }
}

export const workerBridge = new SimulationWorkerBridge();
