import { Device, DeviceInterface, Link, Srv6Config } from '../../types/network';

export interface Srv6LocatorEntry {
  name: string;
  prefix: string;
  length: number;
  sids: {
    sid: string;
    behavior: 'End' | 'End.X' | 'End.DT4';
    context?: string;
  }[];
}

export interface Srv6ComputedState {
  locators: Record<string, Srv6LocatorEntry[]>;
  activeSids: Record<string, string[]>;
}

/**
 * Computes SRv6 locators and active Segment Identifiers across network devices.
 */
export function computeSrv6State(devices: Device[]): Srv6ComputedState {
  const locators: Record<string, Srv6LocatorEntry[]> = {};
  const activeSids: Record<string, string[]> = {};

  const srv6Devices = (devices || []).filter((d) => d.config?.srv6 && d.config.srv6.enabled);

  for (const dev of srv6Devices) {
    locators[dev.id] = [];
    activeSids[dev.id] = [];

    const cfg = dev.config.srv6!;
    if (cfg.locator) {
      const locEntry: Srv6LocatorEntry = {
        name: cfg.locator.name,
        prefix: cfg.locator.prefix,
        length: cfg.locator.length,
        sids: (cfg.sids || []).map((s) => ({
          sid: s.sid,
          behavior: s.behavior,
          context: s.outInterface || s.nextHop,
        })),
      };
      locators[dev.id].push(locEntry);
      activeSids[dev.id] = locEntry.sids.map((s) => s.sid);
    }
  }

  return { locators, activeSids };
}

/**
 * Executes SRv6 source-routing packet transformation:
 * Adds or processes Segment Routing Header (SRH) with ordered SID list.
 */
export function processSrv6Packet(
  dev: Device,
  currentSids: string[]
): { nextSid?: string; remainingSids: string[]; behavior: string } {
  if (!currentSids || currentSids.length === 0) {
    return { remainingSids: [], behavior: 'None' };
  }

  const activeSid = currentSids[0];
  const remainingSids = currentSids.slice(1);

  // Check matching SID on current device
  const localSid = dev.config?.srv6?.sids?.find((s) => s.sid === activeSid);
  const behavior = localSid ? localSid.behavior : 'Forward';

  return {
    nextSid: remainingSids[0],
    remainingSids,
    behavior,
  };
}
