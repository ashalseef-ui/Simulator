import { Device, Link, SimulationStep } from '../../types/network';

export function simulateDhcp(
  clientDeviceId: string,
  devices: Device[],
  _links: Link[]
): { steps: SimulationStep[]; allocatedConfig?: { ip: string; mask: string; gateway: string; dns: string }; error?: string } {
  if (!clientDeviceId || typeof clientDeviceId !== 'string') {
    return { steps: [], error: 'Invalid client device ID' };
  }
  if (!Array.isArray(devices)) {
    return { steps: [], error: 'Topology devices array is invalid' };
  }

  const client = devices.find((d) => d && d.id === clientDeviceId);
  if (!client || !client.config) return { steps: [], error: 'Client device not found or unconfigured' };

  // Locate DHCP Server (either Server device with DHCP enabled, or Router with DHCP pool)
  let dhcpServer: Device | undefined;
  let serverPoolConfig: { ip: string; mask: string; gateway: string; dns: string } | undefined;

  for (const d of devices) {
    if (!d || !d.config) continue;
    if (d.type === 'server' && d.config.services?.dhcp?.enabled) {
      dhcpServer = d;
      const s = d.config.services.dhcp;
      if (s) {
        serverPoolConfig = {
          ip: s.startIp || '192.168.1.100',
          mask: s.mask || '255.255.255.0',
          gateway: s.defaultGateway || '192.168.1.1',
          dns: s.dnsServer || '8.8.8.8',
        };
      }
      break;
    }
    // Check if router has DHCP pool
    if ((d.type.startsWith('router') || d.type === 'l3switch') && d.config.dhcpPools) {
      const pools = Object.values(d.config.dhcpPools);
      if (pools.length > 0) {
        dhcpServer = d;
        const pool = pools[0];
        serverPoolConfig = {
          ip: pool.network ? `${pool.network.split('.').slice(0, 3).join('.')}.50` : '192.168.1.50',
          mask: pool.mask || '255.255.255.0',
          gateway: pool.defaultRouter || (pool.network ? `${pool.network.split('.').slice(0, 3).join('.')}.1` : '192.168.1.1'),
          dns: pool.dnsServer || '8.8.8.8',
        };
        break;
      }
    }
  }

  if (!dhcpServer || !serverPoolConfig) {
    return {
      steps: [
        {
          id: `dhcp_fail_${Date.now()}`,
          stepIndex: 1,
          totalSteps: 1,
          type: 'DHCP',
          stage: 'DHCP Discover (Failed)',
          fromDeviceId: client.id,
          toDeviceId: client.id,
          fromPort: 'Fa0/0',
          toPort: 'Fa0/0',
          status: 'drop',
          message: 'DHCP Discover broadcast timed out. No active DHCP server or router pool responded on this network segment.',
          l2Frame: { preamble: '10101011', srcMac: '00:00:00:00:00:00', dstMac: 'FF:FF:FF:FF:FF:FF', type: '0x0800' },
          l3Packet: { version: 4, ihl: 5, tos: 0, totalLength: 328, ttl: 128, protocol: 'UDP', srcIp: '0.0.0.0', dstIp: '255.255.255.255' },
          l4Payload: { protocol: 'DHCP', summary: 'DHCP Discover (Timed Out)', details: { note: 'APIPA 169.254.x.x would be assigned' } },
        },
      ],
      error: 'DHCP failed. No DHCP server found on network.',
    };
  }

  const steps: SimulationStep[] = [];
  const clientIface = Object.values(client.config.interfaces)[0];
  const clientMac = clientIface?.mac || '00:50:79:66:68:00';
  const serverIface = Object.values(dhcpServer.config.interfaces)[0];
  const serverMac = serverIface?.mac || '00:60:2f:aa:bb:cc';
  const serverIp = serverIface?.ip || serverPoolConfig.gateway;

  // Stage 1: DHCP DISCOVER
  steps.push({
    id: `dhcp_disc_${Date.now()}`,
    stepIndex: 1,
    totalSteps: 4,
    type: 'DHCP',
    stage: 'DHCP Discover (Broadcast)',
    fromDeviceId: client.id,
    toDeviceId: dhcpServer.id,
    fromPort: clientIface?.name || 'Fa0/0',
    toPort: serverIface?.name || 'Fa0/0',
    status: 'broadcast',
    message: 'DHCP Discover: Client broadcasts looking for DHCP servers',
    l2Frame: {
      preamble: '10101011',
      srcMac: clientMac,
      dstMac: 'FF:FF:FF:FF:FF:FF',
      type: '0x0800 (IPv4)',
    },
    l3Packet: {
      version: 4,
      ihl: 5,
      tos: 0,
      totalLength: 328,
      ttl: 128,
      protocol: 'UDP',
      srcIp: '0.0.0.0',
      dstIp: '255.255.255.255',
    },
    l4Payload: {
      protocol: 'DHCP',
      summary: 'DHCP Discover (Type 1)',
      details: {
        op: 'BOOTREQUEST (1)',
        htype: 'Ethernet (1)',
        xid: '0x3903f326',
        clientMac,
        flags: 'Broadcast (0x8000)',
      },
    },
  });

  // Stage 2: DHCP OFFER
  steps.push({
    id: `dhcp_off_${Date.now()}`,
    stepIndex: 2,
    totalSteps: 4,
    type: 'DHCP',
    stage: 'DHCP Offer (Unicast/Broadcast)',
    fromDeviceId: dhcpServer.id,
    toDeviceId: client.id,
    fromPort: serverIface?.name || 'Fa0/0',
    toPort: clientIface?.name || 'Fa0/0',
    status: 'forward',
    message: `DHCP Offer: Server offers IP ${serverPoolConfig.ip} with Gateway ${serverPoolConfig.gateway}`,
    l2Frame: {
      preamble: '10101011',
      srcMac: serverMac,
      dstMac: 'FF:FF:FF:FF:FF:FF',
      type: '0x0800 (IPv4)',
    },
    l3Packet: {
      version: 4,
      ihl: 5,
      tos: 0,
      totalLength: 328,
      ttl: 64,
      protocol: 'UDP',
      srcIp: serverIp,
      dstIp: '255.255.255.255',
    },
    l4Payload: {
      protocol: 'DHCP',
      summary: 'DHCP Offer (Type 2)',
      details: {
        op: 'BOOTREPLY (2)',
        yourIp: serverPoolConfig.ip,
        serverIp,
        subnetMask: serverPoolConfig.mask,
        router: serverPoolConfig.gateway,
        dns: serverPoolConfig.dns,
        leaseTime: '86400s (24 hours)',
      },
    },
  });

  // Stage 3: DHCP REQUEST
  steps.push({
    id: `dhcp_req_${Date.now()}`,
    stepIndex: 3,
    totalSteps: 4,
    type: 'DHCP',
    stage: 'DHCP Request (Broadcast)',
    fromDeviceId: client.id,
    toDeviceId: dhcpServer.id,
    fromPort: clientIface?.name || 'Fa0/0',
    toPort: serverIface?.name || 'Fa0/0',
    status: 'forward',
    message: `DHCP Request: Client formally accepts offer ${serverPoolConfig.ip}`,
    l2Frame: {
      preamble: '10101011',
      srcMac: clientMac,
      dstMac: 'FF:FF:FF:FF:FF:FF',
      type: '0x0800 (IPv4)',
    },
    l3Packet: {
      version: 4,
      ihl: 5,
      tos: 0,
      totalLength: 328,
      ttl: 128,
      protocol: 'UDP',
      srcIp: '0.0.0.0',
      dstIp: '255.255.255.255',
    },
    l4Payload: {
      protocol: 'DHCP',
      summary: 'DHCP Request (Type 3)',
      details: {
        op: 'BOOTREQUEST (1)',
        requestedIp: serverPoolConfig.ip,
        serverIdentifier: serverIp,
        clientMac,
      },
    },
  });

  // Stage 4: DHCP ACK
  steps.push({
    id: `dhcp_ack_${Date.now()}`,
    stepIndex: 4,
    totalSteps: 4,
    type: 'DHCP',
    stage: 'DHCP Acknowledgment (ACK)',
    fromDeviceId: dhcpServer.id,
    toDeviceId: client.id,
    fromPort: serverIface?.name || 'Fa0/0',
    toPort: clientIface?.name || 'Fa0/0',
    status: 'success',
    message: `DHCP ACK: Server confirms IP configuration ${serverPoolConfig.ip}`,
    l2Frame: {
      preamble: '10101011',
      srcMac: serverMac,
      dstMac: clientMac,
      type: '0x0800 (IPv4)',
    },
    l3Packet: {
      version: 4,
      ihl: 5,
      tos: 0,
      totalLength: 328,
      ttl: 64,
      protocol: 'UDP',
      srcIp: serverIp,
      dstIp: serverPoolConfig.ip,
    },
    l4Payload: {
      protocol: 'DHCP',
      summary: 'DHCP ACK (Type 5)',
      details: {
        op: 'BOOTREPLY (2)',
        confirmedIp: serverPoolConfig.ip,
        subnetMask: serverPoolConfig.mask,
        defaultGateway: serverPoolConfig.gateway,
        dnsServer: serverPoolConfig.dns,
        status: 'Lease active',
      },
    },
  });

  return { steps, allocatedConfig: serverPoolConfig };
}
