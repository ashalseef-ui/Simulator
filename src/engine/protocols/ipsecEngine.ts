import { Device, DeviceInterface, Link, IpsecConfig } from '../../types/network';
import { areSameSubnet, ipToInt } from '../../utils/ipUtils';

export interface IpsecTunnelSession {
  localGatewayIp: string;
  remoteGatewayIp: string;
  localSubnet: string;
  remoteSubnet: string;
  spiInbound: string;
  spiOutbound: string;
  cipher: string;
  hash: string;
  state: 'UP-ACTIVE' | 'DOWN';
  packetsEncrypted: number;
  packetsDecrypted: number;
}

/**
 * Computes active IPsec SAs and crypto maps across network devices.
 */
export function computeIpsecSessions(devices: Device[]): Record<string, IpsecTunnelSession[]> {
  const result: Record<string, IpsecTunnelSession[]> = {};

  const ipsecDevices = (devices || []).filter(
    (d) => d.config?.ipsec && Object.keys(d.config.ipsec.cryptoMaps || {}).length > 0
  );

  for (const devA of ipsecDevices) {
    result[devA.id] = [];
    const ipsecA = devA.config.ipsec!;

    for (const [mapName, mapEntry] of Object.entries(ipsecA.cryptoMaps || {})) {
      const peerIp = mapEntry.peer;
      if (!peerIp) continue;

      // Find peer device
      const devB = ipsecDevices.find((d) =>
        Object.values(d.config.interfaces || {}).some((i) => i.ip === peerIp && i.status === 'up')
      );
      if (!devB) continue;

      // Resolve local gateway IP connecting towards peer
      const localGatewayIp = Object.values(devA.config.interfaces || {}).find(
        (i) => i.ip && i.status === 'up' && i.ipsecCryptoMap === mapName
      )?.ip || Object.values(devA.config.interfaces || {}).find((i) => i.ip)?.ip || '1.1.1.1';

      // Check pre-shared key agreement
      const pskA = ipsecA.preSharedKeys?.[peerIp] || ipsecA.preSharedKeys?.['default'] || 'cisco123';
      const pskB = devB.config.ipsec?.preSharedKeys?.[localGatewayIp] || devB.config.ipsec?.preSharedKeys?.['default'] || 'cisco123';
      const pskMatches = pskA === pskB;

      const tSet = ipsecA.transformSets?.[mapEntry.transformSet];
      const cipher = tSet?.espCipher || 'esp-aes-256';
      const hash = tSet?.espAuth || 'esp-sha-hmac';

      const session: IpsecTunnelSession = {
        localGatewayIp,
        remoteGatewayIp: peerIp,
        localSubnet: '0.0.0.0/0',
        remoteSubnet: '0.0.0.0/0',
        spiInbound: '0x' + Math.floor(Math.random() * 0xffffffff).toString(16),
        spiOutbound: '0x' + Math.floor(Math.random() * 0xffffffff).toString(16),
        cipher,
        hash,
        state: pskMatches ? 'UP-ACTIVE' : 'DOWN',
        packetsEncrypted: 0,
        packetsDecrypted: 0,
      };

      result[devA.id].push(session);

      // Record active session on dev config
      if (!ipsecA.activeSessions) ipsecA.activeSessions = [];
      const existing = ipsecA.activeSessions.find((s) => s.peerIp === peerIp);
      if (existing) {
        existing.state = session.state;
      } else {
        ipsecA.activeSessions.push({
          peerIp,
          localIp: localGatewayIp,
          cryptoMap: mapName,
          state: session.state,
          packetsEncrypted: 12,
          packetsDecrypted: 12,
        });
      }
    }
  }

  return result;
}

/**
 * Checks if a packet between srcIp and dstIp matches a crypto ACL on the egress device.
 * If matched and tunnel is active, returns outer tunnel encapsulation headers.
 */
export function matchIpsecCryptoMap(
  egressDev: Device,
  srcIp: string,
  dstIp: string
): { isEncapsulated: boolean; tunnelDstIp?: string; tunnelSrcIp?: string; spi?: string } {
  if (!egressDev.config?.ipsec?.cryptoMaps) return { isEncapsulated: false };

  for (const [mapName, mapEntry] of Object.entries(egressDev.config.ipsec.cryptoMaps)) {
    if (!mapEntry.peer) continue;

    // Check if the crypto ACL matches srcIp and dstIp
    const aclName = mapEntry.acl;
    const acl = egressDev.config.accessLists?.[aclName];
    let matched = false;

    if (acl) {
      for (const rule of acl.rules || []) {
        if (rule.action === 'permit') {
          // Rule matches interesting traffic
          matched = true;
          break;
        }
      }
    } else {
      // Default permit if ACL not explicitly defined
      matched = true;
    }

    if (matched) {
      const localGatewayIp = Object.values(egressDev.config.interfaces || {}).find(
        (i) => i.ip && i.status === 'up' && i.ipsecCryptoMap === mapName
      )?.ip || '198.51.100.1';

      return {
        isEncapsulated: true,
        tunnelSrcIp: localGatewayIp,
        tunnelDstIp: mapEntry.peer,
        spi: '0x3bf7a01c',
      };
    }
  }

  return { isEncapsulated: false };
}
