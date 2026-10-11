/**
 * Discrete-Event Simulation (DES) Virtual Clock Engine.
 *
 * Replaces non-deterministic browser wall-clock timers (setInterval/setTimeout)
 * with a strictly monotonic tick-based simulation clock.
 *
 * Guarantees:
 * 1. Zero timer drift across inactive or throttled browser tabs.
 * 2. Deterministic priority queue event dispatching (BPDUs, OSPF Hellos, ARP aging).
 * 3. Pause, fast-forward (0.5x, 1x, 2x, 5x, 10x), and single-tick stepping.
 */

export interface NetworkSimEvent {
  id: string;
  targetTick: number;
  type: 'STP_BPDU' | 'OSPF_HELLO' | 'OSPF_DEAD_CHECK' | 'ARP_AGE' | 'DHCP_LEASE' | 'LINK_FLAP' | 'CUSTOM';
  deviceId?: string;
  sourceInterface?: string;
  description: string;
  payload?: any;
}

export interface VirtualClockSnapshot {
  currentTick: number;
  virtualTimeMs: number;
  formattedTime: string;
  speedMultiplier: number;
  paused: boolean;
  scheduledEventsCount: number;
  lastComputeLatencyMs: number;
  engineMode: 'worker' | 'main-thread';
}

export class DiscreteVirtualClock {
  private currentTick = 0;
  private readonly tickDurationMs: number; // Virtual ms represented by 1 tick (default: 50ms)
  private speedMultiplier = 1;
  private isPaused = true;
  private eventQueue: NetworkSimEvent[] = [];
  private lastComputeLatencyMs = 0;
  private engineMode: 'worker' | 'main-thread' = 'worker';
  private listeners: Set<(snapshot: VirtualClockSnapshot) => void> = new Set();

  constructor(tickDurationMs = 50) {
    this.tickDurationMs = tickDurationMs;
  }

  public getSnapshot(): VirtualClockSnapshot {
    const totalMs = this.currentTick * this.tickDurationMs;
    const totalSecs = Math.floor(totalMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const millis = Math.floor((totalMs % 1000) / 10);

    const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;

    return {
      currentTick: this.currentTick,
      virtualTimeMs: totalMs,
      formattedTime,
      speedMultiplier: this.speedMultiplier,
      paused: this.isPaused,
      scheduledEventsCount: this.eventQueue.length,
      lastComputeLatencyMs: this.lastComputeLatencyMs,
      engineMode: this.engineMode,
    };
  }

  public subscribe(listener: (snapshot: VirtualClockSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((cb) => cb(snapshot));
  }

  public play(): void {
    this.isPaused = false;
    this.notify();
  }

  public pause(): void {
    this.isPaused = true;
    this.notify();
  }

  public togglePlayPause(): void {
    this.isPaused = !this.isPaused;
    this.notify();
  }

  public setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(multiplier, 20));
    this.notify();
  }

  public setEngineMode(mode: 'worker' | 'main-thread'): void {
    this.engineMode = mode;
    this.notify();
  }

  public recordComputeLatency(ms: number): void {
    this.lastComputeLatencyMs = Math.round(ms * 100) / 100;
    this.notify();
  }

  public reset(): void {
    this.currentTick = 0;
    this.eventQueue = [];
    this.isPaused = true;
    this.notify();
  }

  /**
   * Schedules a deterministic protocol event to fire at (currentTick + delayTicks).
   */
  public scheduleEvent(
    type: NetworkSimEvent['type'],
    delayMs: number,
    description: string,
    deviceId?: string,
    payload?: any
  ): string {
    const delayTicks = Math.max(1, Math.round(delayMs / this.tickDurationMs));
    const targetTick = this.currentTick + delayTicks;
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const event: NetworkSimEvent = {
      id,
      targetTick,
      type,
      deviceId,
      description,
      payload,
    };

    // Insert sorted by targetTick (min-priority queue)
    const idx = this.eventQueue.findIndex((e) => e.targetTick > targetTick);
    if (idx === -1) {
      this.eventQueue.push(event);
    } else {
      this.eventQueue.splice(idx, 0, event);
    }

    this.notify();
    return id;
  }

  /**
   * Advances the clock by a fixed number of ticks and pops all due events.
   */
  public advanceTicks(ticks = 1): NetworkSimEvent[] {
    const executedEvents: NetworkSimEvent[] = [];
    for (let i = 0; i < ticks; i++) {
      this.currentTick += 1;
      while (this.eventQueue.length > 0 && this.eventQueue[0].targetTick <= this.currentTick) {
        executedEvents.push(this.eventQueue.shift()!);
      }
    }
    this.notify();
    return executedEvents;
  }

  public getCurrentTick(): number {
    return this.currentTick;
  }

  public getVirtualTimeMs(): number {
    return this.currentTick * this.tickDurationMs;
  }

  public isClockPaused(): boolean {
    return this.isPaused;
  }

  public getSpeed(): number {
    return this.speedMultiplier;
  }

  public getTickDurationMs(): number {
    return this.tickDurationMs;
  }
}
