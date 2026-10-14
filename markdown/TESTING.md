# WireCraft Testing Methodology & Test Suite Guide

> [📖 Doc Hub](./INDEX.md) • [🏗️ Architecture](./ARCHITECTURE.md) • [💻 CLI Reference](./CLI_REFERENCE.md) • [🔌 REST API](./API.md) • [🧪 Testing](./TESTING.md) • [🚀 Deployment](./DEPLOYMENT.md) • [🔒 Security](./SECURITY.md) • [🗺️ Roadmap](./ROADMAP.md) • [🏷️ Brand Guide](./BRAND_LOC.md) • [🤝 Contributing](./CONTRIBUTING.md)

WireCraft employs an industrial testing strategy combining **deterministic unit testing**, **protocol conformance assertions**, and **generative property-based fuzzing**.

---

## 1. Test Architecture & Toolchain

- **Test Runner**: [Vitest](https://vitest.dev/) (`v5.0.3+`) – High-speed Vite-native ESM test runner.
- **Property-Based Testing**: [fast-check](https://fast-check.dev/) (`v4.10.2+`) – Generates hundreds of randomized network topologies and packet paths to prove mathematical invariants (e.g., absence of routing loops under STP).
- **Type Checking**: TypeScript Compiler (`tsc --noEmit`) running in strict mode.

---

## 2. Test Suites Overview

All tests are located in `src/engine/__tests__/`:

| Test Suite | File | Focus & Assertions |
|---|---|---|
| **CLI Parser & Execution** | `cliEngine.test.ts` | Tests prompt mode transitions (`user` -> `priv` -> `config` -> `config-if`), autocompletion, pipe filtering (`| include`), and banner generation on `reload` and `show version`. |
| **OSPFv2 SPF Engine** | `ospf.test.ts` | Validates Dijkstra algorithm, DR/BDR election tie-breaks, Area 0 adjacency, MTU/subnet mismatch detection, and dynamic route table population. |
| **Spanning Tree (802.1D)** | `stp.test.ts` | Asserts root bridge election by lowest priority + MAC, root port selection by cumulative path cost, and blocking of redundant loop links. |
| **Per-VLAN Spanning Tree** | `pvst.test.ts` | Verifies independent STP instances per VLAN ID and trunk forwarding behavior. |
| **Virtual Clock Mechanics** | `virtualClock.test.ts` | Tests virtual time progression, pause/play semantics, tick intervals, and 1x, 5x, 10x acceleration. |
| **Security & Sanitization** | `securityAndSanitization.test.ts` | Tests input length clipping, exclusion of script tags, and prompt injection isolation boundaries. |
| **Property-Based Invariants** | `robustnessPropertyBased.test.ts` | Fuzzes random multi-switch loops and random multi-router meshed topologies with `fast-check` to mathematically prove loop-free convergence. |

---

## 3. Running Tests

### Standard Test Execution
Run all 58+ unit and property tests:

```bash
npm test
```

### Interactive Watch Mode
Automatically re-runs tests on file changes during development:

```bash
npm run test:watch
```

### Running Specific Test Suites
Target an individual test file:

```bash
# Test only the OSPF SPF engine
npx vitest run src/engine/__tests__/ospf.test.ts

# Test only the CLI parser
npx vitest run src/engine/__tests__/cliEngine.test.ts

# Test only property-based fuzzing
npx vitest run src/engine/__tests__/robustnessPropertyBased.test.ts
```

### Code Coverage Reporting
Generate detailed branch and line coverage reports:

```bash
npx vitest run --coverage
```

---

## 4. Writing New Tests

### Example 1: Unit Test for a New CLI Command

```typescript
import { describe, it, expect } from 'vitest';
import { createDevice } from '../deviceSpecs';
import { executeCliCommand, createCliSession } from '../cliEngine';

describe('CLI: ip domain-lookup', () => {
  it('disables domain lookups in global config', () => {
    const router = createDevice('router', 'R1', 100, 100);
    const session = createCliSession('router');

    executeCliCommand(router, session, 'enable');
    executeCliCommand(router, session, 'configure terminal');
    const res = executeCliCommand(router, session, 'no ip domain-lookup');

    expect(res.error).toBeUndefined();
    expect(router.config.domainLookupEnabled).toBe(false);
  });
});
```

### Example 2: Property-Based Invariant Test with `fast-check`

```typescript
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { computeStp } from '../stpEngine';
import { createDevice } from '../deviceSpecs';

describe('STP Invariant: Exactly One Root Bridge', () => {
  it('always elects a unique root bridge regardless of switch count or priorities', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 65535 }), { minLength: 2, maxLength: 8 }), (priorities) => {
        const switches = priorities.map((p, idx) => {
          const sw = createDevice('switch', `SW${idx}`, 100 * idx, 100);
          sw.config.spanningTreePriority = p;
          return sw;
        });

        const links = []; // Connect in ring
        for (let i = 0; i < switches.length; i++) {
          links.push({
            id: `link_${i}`,
            fromDevice: switches[i].id,
            fromPort: 'Fa0/1',
            toDevice: switches[(i + 1) % switches.length].id,
            toPort: 'Fa0/2',
            cable: 'straight' as const,
          });
        }

        const result = computeStp(switches, links);
        const roots = Object.values(result).filter((s) => s.isRootBridge);
        return roots.length === 1; // Invariant: exactly one root
      })
    );
  });
});
```

---

## 5. Continuous Integration (CI) Automation

In GitHub Actions or automated CI pipelines, tests run in parallel across isolated Node.js environments:

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```
