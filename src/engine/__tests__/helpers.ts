import { Device, Link } from '../../types/network';
import { createDevice } from '../deviceSpecs';

let n = 0;
export const mk = (type: Parameters<typeof createDevice>[0], name: string) => {
  const d = createDevice(type, name, 0, 0);
  d.id = `${name}_${++n}`; // deterministic, unique
  return d;
};

export function setIp(d: Device, port: string, ip: string, mask = '255.255.255.0') {
  const i = d.config.interfaces[port];
  if (!i) throw new Error(`${d.name} has no ${port}`);
  i.ip = ip;
  i.mask = mask;
  i.status = 'up';
}

export function link(a: Device, ap: string, b: Device, bp: string): Link {
  for (const [d, p] of [[a, ap], [b, bp]] as const) {
    if (!d.config.interfaces[p]) throw new Error(`${d.name} has no ${p}`);
    d.config.interfaces[p].status = 'up';
  }
  return { id: `l_${a.name}_${ap}_${b.name}_${bp}`, fromDevice: a.id, fromPort: ap, toDevice: b.id, toPort: bp, cable: 'auto' };
}

export function enableOspf(d: Device, nets: [string, string, number][], extra: Partial<NonNullable<Device['config']['ospf']>> = {}) {
  d.config.ospf = { processId: 1, networks: nets.map(([network, wildcard, area]) => ({ network, wildcard, area })), ...extra };
  d.config.ipRoutingEnabled = true;
}

/** PC1 - R1 - R2 - R3 - PC2, OSPF area 0 everywhere. */
export function threeRouterLine() {
  const r1 = mk('router', 'R1'), r2 = mk('router', 'R2'), r3 = mk('router', 'R3');
  const pc1 = mk('pc', 'PC1'), pc2 = mk('pc', 'PC2');
  setIp(r1, 'Gi0/0', '10.0.12.1', '255.255.255.252');
  setIp(r2, 'Gi0/0', '10.0.12.2', '255.255.255.252');
  setIp(r2, 'Gi0/1', '10.0.23.1', '255.255.255.252');
  setIp(r3, 'Gi0/0', '10.0.23.2', '255.255.255.252');
  setIp(r1, 'Gi0/1', '192.168.1.1');
  setIp(r3, 'Gi0/1', '192.168.3.1');
  setIp(pc1, 'Fa0/0', '192.168.1.10');
  setIp(pc2, 'Fa0/0', '192.168.3.10');
  pc1.config.defaultGateway = '192.168.1.1';
  pc2.config.defaultGateway = '192.168.3.1';
  enableOspf(r1, [['10.0.12.0', '0.0.0.3', 0], ['192.168.1.0', '0.0.0.255', 0]]);
  enableOspf(r2, [['10.0.12.0', '0.0.0.3', 0], ['10.0.23.0', '0.0.0.3', 0]]);
  enableOspf(r3, [['10.0.23.0', '0.0.0.3', 0], ['192.168.3.0', '0.0.0.255', 0]]);
  const links = [
    link(pc1, 'Fa0/0', r1, 'Gi0/1'),
    link(r1, 'Gi0/0', r2, 'Gi0/0'),
    link(r2, 'Gi0/1', r3, 'Gi0/0'),
    link(r3, 'Gi0/1', pc2, 'Fa0/0'),
  ];
  return { r1, r2, r3, pc1, pc2, devices: [r1, r2, r3, pc1, pc2], links };
}
