import { describe, it, expect } from 'vitest';
import { generateRunningConfig, executeCliCommand, createCliSession } from '../cliEngine';
import { createDevice } from '../deviceSpecs';
import { DeviceConfig } from '../../types/network';

describe('Pillar 5: Security & Sanitization', () => {
  it('masks enable secret by default in generateRunningConfig', () => {
    const router = createDevice('router', 'R1-HQ', 100, 100);
    router.config.enableSecret = 'SuperSecret123';

    const defaultRunConfig = generateRunningConfig(router);
    expect(defaultRunConfig).not.toContain('SuperSecret123');
    expect(defaultRunConfig).toContain('enable secret 5');

    const adminRunConfig = generateRunningConfig(router, true);
    expect(adminRunConfig).toContain('SuperSecret123');
  });

  it('generates 2048-bit RSA key and enables SSH 2.0 by default', () => {
    const router = createDevice('router', 'R1-HQ', 100, 100);
    const session = createCliSession();
    session.mode = 'config';
    const noopConfig = (_c: DeviceConfig) => {};

    const res = executeCliCommand('crypto key generate rsa', router, [router], session, noopConfig, []);
    expect(res.output).toContain('Key size: 2048 bits');
    expect(res.output).toContain('SSH 2.0 has been enabled');
  });

  it('supports custom RSA modulus size', () => {
    const router = createDevice('router', 'R1-HQ', 100, 100);
    const session = createCliSession();
    session.mode = 'config';
    const noopConfig = (_c: DeviceConfig) => {};

    const res = executeCliCommand('crypto key generate rsa modulus 4096', router, [router], session, noopConfig, []);
    expect(res.output).toContain('Key size: 4096 bits');
  });
});
