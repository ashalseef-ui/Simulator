import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidIp,
  ipToInt,
  cidrToMask,
  maskToCidr,
  parseInterfaceRange,
  areSameSubnet,
} from '../../utils/ipUtils';
import { deepClone } from '../../utils/deepClone';
import { lookupRoute, simulatePing } from '../simulationEngine';
import { executeCliCommand, createCliSession } from '../cliEngine';
import { createDevice } from '../deviceSpecs';
import { Device, DeviceConfig } from '../../types/network';

describe('Pillar 4: Property-Based & Fuzz Robustness Suite', () => {
  describe('ipUtils robustness under arbitrary inputs', () => {
    it('parseInterfaceRange never throws on arbitrary random string inputs', () => {
      fc.assert(
        fc.property(fc.string(), (randomStr) => {
          const result = parseInterfaceRange(randomStr, {});
          expect(Array.isArray(result)).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it('parseInterfaceRange correctly parses valid dash ranges', () => {
      const res = parseInterfaceRange('Fa0/1-4, Gi0/1');
      expect(res).toEqual(['Fa0/1', 'Fa0/2', 'Fa0/3', 'Fa0/4', 'Gi0/1']);
    });

    it('isValidIp and ipToInt never throw on arbitrary random inputs', () => {
      fc.assert(
        fc.property(fc.string(), (randomStr) => {
          const isValid = isValidIp(randomStr);
          expect(typeof isValid).toBe('boolean');
          const intVal = ipToInt(randomStr);
          expect(typeof intVal).toBe('number');
          expect(Number.isFinite(intVal)).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it('areSameSubnet never throws on random strings', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), fc.string(), (ip1, ip2, mask) => {
          const res = areSameSubnet(ip1, ip2, mask);
          expect(typeof res).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });

    it('maskToCidr and cidrToMask handle any arbitrary inputs safely', () => {
      fc.assert(
        fc.property(fc.integer({ min: -50, max: 100 }), (num) => {
          const mask = cidrToMask(num);
          expect(typeof mask).toBe('string');
          expect(typeof maskToCidr(mask)).toBe('number');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('DeepClone immunity to circular references and data loss', () => {
    it('handles circular references without stack overflow', () => {
      const circularObj: any = { name: 'Router1', nested: {} };
      circularObj.nested.parent = circularObj;

      expect(() => {
        const cloned = deepClone(circularObj);
        expect(cloned.name).toBe('Router1');
        expect(cloned.nested.parent).toBe(cloned);
      }).not.toThrow();
    });

    it('preserves Map, Set, and Date objects independently', () => {
      const original = {
        date: new Date(1700000000000),
        set: new Set(['Fa0/1', 'Gi0/0']),
        map: new Map([['key1', { count: 42 }]]),
      };

      const cloned = deepClone(original);
      expect(cloned.date.getTime()).toBe(original.date.getTime());
      expect(cloned.set.has('Fa0/1')).toBe(true);
      expect(cloned.map.get('key1')?.count).toBe(42);

      // Mutate clone and ensure original is untouched
      cloned.set.add('Gi0/1');
      expect(original.set.has('Gi0/1')).toBe(false);
    });
  });

  describe('Routing Engine Defensiveness (lookupRoute & simulatePing)', () => {
    it('lookupRoute never throws on malformed devices or invalid destination IPs', () => {
      fc.assert(
        fc.property(fc.string(), (randomDst) => {
          // Empty / minimal device
          const emptyDev = { id: 'd1', name: 'R', type: 'router', x: 0, y: 0, config: {} as any } as Device;
          const match1 = lookupRoute(emptyDev, randomDst, []);
          expect(match1).toBeNull();

          // Normal device with missing protocol blocks
          const router = createDevice('router', 'R1', 100, 100);
          delete (router.config as any).eigrp;
          delete (router.config as any).ospf;
          delete (router.config as any).bgp;
          const match2 = lookupRoute(router, randomDst, []);
          expect(match2 === null || typeof match2 === 'object').toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('simulatePing never throws on arbitrary random inputs', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (srcId, dstIp) => {
          const res = simulatePing(srcId, dstIp, [], []);
          expect(res).toBeDefined();
          expect(res.success).toBe(false);
          expect(Array.isArray(res.steps)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('CLI Engine Parser Fuzzing', () => {
    it('executeCliCommand never throws an unhandled exception on arbitrary string commands', () => {
      const router = createDevice('router', 'R1', 100, 100);
      const allDevs = [router];
      const noopConfig = (_cfg: DeviceConfig) => {};

      fc.assert(
        fc.property(fc.string(), (arbitraryCmd) => {
          const session = createCliSession();
          const result = executeCliCommand(arbitraryCmd, router, allDevs, session, noopConfig, []);
          expect(result).toBeDefined();
          expect(typeof result.output).toBe('string');
          expect(result.newSession).toBeDefined();
        }),
        { numRuns: 150 }
      );
    });
  });
});
