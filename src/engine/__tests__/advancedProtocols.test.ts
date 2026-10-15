import { describe, it, expect } from 'vitest';
import { Device, Link } from '../../types/network';
import { createDefaultDeviceConfig } from '../deviceSpecs';
import { calculateEigrpMetric, computeEigrpNetworkState } from '../protocols/eigrpEngine';
import { selectBestBgpPath, computeBgpNetworkState, BgpRibEntry } from '../protocols/bgpEngine';
import { generateHsrpVirtualMac, computeHsrpNetworkState, resolveHsrpGateway } from '../protocols/hsrpEngine';
import { computeMplsNetworkState } from '../protocols/mplsEngine';
import { computeIpsecSessions, matchIpsecCryptoMap } from '../protocols/ipsecEngine';
import { computeVxlanState, matchVxlanOverlay } from '../protocols/vxlanEngine';
import { computeSrv6State, processSrv6Packet } from '../protocols/srv6Engine';
import { parseIsisNet, computeIsisNetworkState } from '../protocols/isisEngine';
import { computeWirelessIotNetworkState } from '../protocols/wirelessIotEngine';

describe('Advanced Enterprise & Service Provider Protocol Engines', () => {
  // 1. EIGRP
  describe('EIGRP (Enhanced Interior Gateway Routing Protocol)', () => {
    it('should accurately calculate classic composite metric', () => {
      // 1000 Mbps = 1,000,000 Kbps. BW term = 10,000,000 / 1,000,000 = 10. Delay = 100. Metric = 256 * (10 + 100) = 28,160
      const metric = calculateEigrpMetric(1000000, 100);
      expect(metric).toBe(28160);
    });

    it('should form neighbor adjacencies and select DUAL successors in the same AS and subnet', () => {
      const r1: Device = {
        id: 'r1',
        name: 'R1',
        type: 'router',
        x: 0,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('router', 'R1'),
          eigrp: {
            asNumber: 100,
            networks: [{ network: '10.0.0.0', wildcard: '0.0.0.255' }],
          },
        },
      };
      r1.config.interfaces['Gi0/0'].ip = '10.0.0.1';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r1.config.interfaces['Gi0/0'].status = 'up';

      const r2: Device = {
        id: 'r2',
        name: 'R2',
        type: 'router',
        x: 100,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('router', 'R2'),
          eigrp: {
            asNumber: 100,
            networks: [{ network: '10.0.0.0', wildcard: '0.0.0.255' }],
          },
        },
      };
      r2.config.interfaces['Gi0/0'].ip = '10.0.0.2';
      r2.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r2.config.interfaces['Gi0/0'].status = 'up';

      const link: Link = {
        id: 'l1',
        fromDevice: 'r1',
        fromPort: 'Gi0/0',
        toDevice: 'r2',
        toPort: 'Gi0/0',
        cable: 'straight',
      };

      const result = computeEigrpNetworkState([r1, r2], [link]);
      expect(result.neighbors['r1'].length).toBe(1);
      expect(result.neighbors['r1'][0].neighborIp).toBe('10.0.0.2');
      expect(result.neighbors['r2'][0].neighborIp).toBe('10.0.0.1');
    });
  });

  // 2. BGP & BGP EVPN
  describe('BGP & BGP EVPN (Border Gateway Protocol)', () => {
    it('should apply BGP best-path decision algorithm based on weight and local-pref', () => {
      const path1: BgpRibEntry = {
        prefix: '192.168.1.0',
        mask: '255.255.255.0',
        nextHop: '10.0.0.1',
        asPath: [65001, 65002],
        origin: 'IGP',
        localPref: 100,
        med: 0,
        weight: 32768,
        isBest: false,
        isExternal: true,
        learnedFrom: 'Local',
      };

      const path2: BgpRibEntry = {
        prefix: '192.168.1.0',
        mask: '255.255.255.0',
        nextHop: '10.0.0.2',
        asPath: [65003],
        origin: 'IGP',
        localPref: 100,
        med: 0,
        weight: 0,
        isBest: false,
        isExternal: true,
        learnedFrom: 'Peer',
      };

      const best = selectBestBgpPath([path1, path2]);
      expect(best).toBe(path1); // Higher weight (32768 vs 0) wins!
    });

    it('should generate EVPN Type 2 (MAC/IP) and Type 3 (IMET) routes when l2vpn-evpn address-family is active', () => {
      const leaf1: Device = {
        id: 'leaf1',
        name: 'LEAF-1',
        type: 'nexus9000',
        x: 0,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('nexus9000', 'LEAF-1'),
          bgp: {
            asn: 65001,
            routerId: '10.255.255.1',
            neighbors: [{ ip: '10.255.255.2', remoteAs: 65001, state: 'Established' }],
            networks: [],
            addressFamilies: { l2vpnEvpn: true },
          },
          vxlan: {
            sourceInterface: 'Loopback0',
            vniMembers: { 10010: { vni: 10010, vlan: 10 } },
          },
          macTable: [{ vlan: 10, mac: '0050.56aa.0001', type: 'DYNAMIC', port: 'Eth1/1' }],
        },
      };

      const state = computeBgpNetworkState([leaf1], []);
      expect(state.evpnTable['leaf1'].length).toBeGreaterThanOrEqual(2);
      expect(state.evpnTable['leaf1'].some((r) => r.type === 'type-2' && r.vni === 10010)).toBe(true);
      expect(state.evpnTable['leaf1'].some((r) => r.type === 'type-3' && r.vni === 10010)).toBe(true);
    });
  });

  // 3. HSRP
  describe('HSRP (Hot Standby Router Protocol)', () => {
    it('should format RFC 2281 Cisco virtual MAC with hex group', () => {
      expect(generateHsrpVirtualMac(1)).toBe('0000.0c07.ac01');
      expect(generateHsrpVirtualMac(10)).toBe('0000.0c07.ac0a');
    });

    it('should elect higher priority router as Active and assign Virtual IP gateway', () => {
      const r1: Device = {
        id: 'r1',
        name: 'R1-Master',
        type: 'router',
        x: 0,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('router', 'R1-Master'),
        },
      };
      r1.config.interfaces['Gi0/0'].ip = '192.168.1.2';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r1.config.interfaces['Gi0/0'].status = 'up';
      r1.config.interfaces['Gi0/0'].hsrp = {
        group: 1,
        virtualIp: '192.168.1.1',
        priority: 120,
        preempt: true,
        state: 'Active',
      };

      const r2: Device = {
        id: 'r2',
        name: 'R2-Backup',
        type: 'router',
        x: 100,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('router', 'R2-Backup'),
        },
      };
      r2.config.interfaces['Gi0/0'].ip = '192.168.1.3';
      r2.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r2.config.interfaces['Gi0/0'].status = 'up';
      r2.config.interfaces['Gi0/0'].hsrp = {
        group: 1,
        virtualIp: '192.168.1.1',
        priority: 100,
        preempt: false,
        state: 'Standby',
      };

      const state = computeHsrpNetworkState([r1, r2], []);
      const gatewayRes = resolveHsrpGateway('192.168.1.1', [r1, r2]);
      expect(gatewayRes).not.toBeNull();
      expect(gatewayRes?.activeDevice.id).toBe('r1');
      expect(gatewayRes?.virtualMac).toBe('0000.0c07.ac01');
    });
  });

  // 4. MPLS & LDP
  describe('Full MPLS & LDP (Label Distribution Protocol)', () => {
    it('should establish LDP sessions and generate LFIB entries', () => {
      const pe1: Device = {
        id: 'pe1',
        name: 'PE-1',
        type: 'router',
        x: 0,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('router', 'PE-1'),
          mpls: { enabled: true, routerId: '10.255.0.1' },
        },
      };
      pe1.config.interfaces['Gi0/0'].ip = '10.0.0.1';
      pe1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      pe1.config.interfaces['Gi0/0'].status = 'up';
      pe1.config.interfaces['Gi0/0'].mplsEnabled = true;

      const p1: Device = {
        id: 'p1',
        name: 'P-1',
        type: 'router',
        x: 100,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('router', 'P-1'),
          mpls: { enabled: true, routerId: '10.255.0.2' },
        },
      };
      p1.config.interfaces['Gi0/0'].ip = '10.0.0.2';
      p1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      p1.config.interfaces['Gi0/0'].status = 'up';
      p1.config.interfaces['Gi0/0'].mplsEnabled = true;

      const link: Link = {
        id: 'l_mpls',
        fromDevice: 'pe1',
        fromPort: 'Gi0/0',
        toDevice: 'p1',
        toPort: 'Gi0/0',
        cable: 'straight',
      };

      const result = computeMplsNetworkState([pe1, p1], [link]);
      expect(result.ldpSessions['pe1'].length).toBe(1);
      expect(result.ldpSessions['pe1'][0].peerRouterId).toBe('10.255.0.2');
      expect(result.ldpSessions['pe1'][0].state).toBe('Operational');
    });
  });

  // 5. IPsec VPN
  describe('IPsec VPN (IKE Phase 1/2 & ESP Encapsulation)', () => {
    it('should match crypto ACL and encapsulate packet towards remote gateway', () => {
      const gw: Device = {
        id: 'gw1',
        name: 'GW-1',
        type: 'router',
        x: 0,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('router', 'GW-1'),
          ipsec: {
            cryptoMaps: {
              'VPN-MAP': {
                name: 'VPN-MAP',
                seq: 10,
                acl: 'VPN-ACL',
                peer: '198.51.100.2',
                transformSet: 'TS-AES',
              },
            },
          },
          accessLists: {
            'VPN-ACL': {
              idOrName: 'VPN-ACL',
              type: 'extended',
              rules: [{ action: 'permit', protocol: 'ip', source: '192.168.10.0 0.0.0.255', destination: '192.168.20.0 0.0.0.255' }],
            },
          },
        },
      };

      const match = matchIpsecCryptoMap(gw, '192.168.10.5', '192.168.20.10');
      expect(match.isEncapsulated).toBe(true);
      expect(match.tunnelDstIp).toBe('198.51.100.2');
    });
  });

  // 6. VXLAN
  describe('VXLAN (Virtual Extensible LAN overlay)', () => {
    it('should map VLAN to VNI and resolve VTEP endpoints', () => {
      const spine: Device = {
        id: 'sw1',
        name: 'SW-1',
        type: 'nexus9000',
        x: 0,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('nexus9000', 'SW-1'),
          vxlan: {
            sourceInterface: 'Loopback0',
            vniMembers: { 10010: { vni: 10010, vlan: 10 } },
            vtepPeers: [{ ip: '10.255.255.2', vni: 10010, state: 'Up' }],
          },
        },
      };

      const match = matchVxlanOverlay(spine, 10);
      expect(match.isVxlan).toBe(true);
      expect(match.vni).toBe(10010);
      expect(match.remoteVtepIp).toBe('10.255.255.2');
    });
  });

  // 7. SRv6
  describe('SRv6 (Segment Routing over IPv6)', () => {
    it('should compute active SIDs and execute End behavior on segment decrement', () => {
      const srv6Router: Device = {
        id: 'r_srv6',
        name: 'R-SRV6',
        type: 'router',
        x: 0,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('router', 'R-SRV6'),
          srv6: {
            enabled: true,
            locator: { name: 'MAIN-LOC', prefix: '2001:db8:c001::', length: 48 },
            sids: [
              { sid: '2001:db8:c001:1::', behavior: 'End' },
              { sid: '2001:db8:c001:2::', behavior: 'End.X' },
            ],
          },
        },
      };

      const state = computeSrv6State([srv6Router]);
      expect(state.activeSids['r_srv6']).toContain('2001:db8:c001:1::');

      const packetRes = processSrv6Packet(srv6Router, ['2001:db8:c001:1::', '2001:db8:c001:2::']);
      expect(packetRes.behavior).toBe('End');
      expect(packetRes.nextSid).toBe('2001:db8:c001:2::');
    });
  });

  // 8. IS-IS
  describe('IS-IS (Intermediate System to Intermediate System)', () => {
    it('should parse ISO Network Entity Title (NET) address', () => {
      const net = parseIsisNet('49.0001.1921.6800.1001.00');
      expect(net).not.toBeNull();
      expect(net?.areaId).toBe('490001');
      expect(net?.systemId).toBe('1921.6800.1001');
      expect(net?.nsel).toBe('00');
    });

    it('should establish Level-2 IS-IS adjacency across routers', () => {
      const r1: Device = {
        id: 'isis1',
        name: 'IS-1',
        type: 'router',
        x: 0,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('router', 'IS-1'),
          isis: { net: '49.0001.0000.0000.0001.00', isType: 'level-2' },
        },
      };
      r1.config.interfaces['Gi0/0'].ip = '10.1.1.1';
      r1.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r1.config.interfaces['Gi0/0'].status = 'up';

      const r2: Device = {
        id: 'isis2',
        name: 'IS-2',
        type: 'router',
        x: 100,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('router', 'IS-2'),
          isis: { net: '49.0002.0000.0000.0002.00', isType: 'level-2' },
        },
      };
      r2.config.interfaces['Gi0/0'].ip = '10.1.1.2';
      r2.config.interfaces['Gi0/0'].mask = '255.255.255.0';
      r2.config.interfaces['Gi0/0'].status = 'up';

      const link: Link = {
        id: 'l_isis',
        fromDevice: 'isis1',
        fromPort: 'Gi0/0',
        toDevice: 'isis2',
        toPort: 'Gi0/0',
        cable: 'straight',
      };

      const result = computeIsisNetworkState([r1, r2], [link]);
      expect(result.neighbors['isis1'].length).toBe(1);
      expect(result.neighbors['isis1'][0].level).toBe('L2');
      expect(result.neighbors['isis1'][0].state).toBe('Up');
    });
  });

  // 9. Wireless & IoT
  describe('Wireless 802.11 & IoT MQTT Telemetry', () => {
    it('should associate wireless clients and publish IoT sensor telemetry', () => {
      const wlc: Device = {
        id: 'wlc1',
        name: 'WLC-1',
        type: 'wlc',
        x: 0,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('wlc', 'WLC-1'),
          wireless: {
            wlanProfiles: [{ id: 1, ssid: 'Corp-WiFi', status: 'enabled', security: 'wpa2-psk', vlanId: 10 }],
          },
        },
      };

      const ap: Device = {
        id: 'ap1',
        name: 'AP-1',
        type: 'ap',
        x: 100,
        y: 0,
        config: createDefaultDeviceConfig('ap', 'AP-1'),
      };

      const laptop: Device = {
        id: 'lap1',
        name: 'Laptop-1',
        type: 'laptop',
        x: 150,
        y: 0,
        config: createDefaultDeviceConfig('laptop', 'Laptop-1'),
      };

      const sensor: Device = {
        id: 'sens1',
        name: 'Sensor-Temp',
        type: 'iot_sensor',
        x: 200,
        y: 0,
        config: {
          ...createDefaultDeviceConfig('iot_sensor', 'Sensor-Temp'),
          iot: {
            role: 'sensor',
            sensorType: 'temperature',
            mqttBroker: '192.168.1.50',
            telemetry: { temperature: 24.2, humidity: 45 },
          },
        },
      };

      const state = computeWirelessIotNetworkState([wlc, ap, laptop, sensor], []);
      expect(state.registeredAps.length).toBe(1);
      expect(state.registeredAps[0].capwapState).toBe('RUN');
      expect(state.associations.length).toBeGreaterThanOrEqual(1);
      expect(state.iotSensorsStatus.length).toBe(1);
      expect(state.activeMqttMessages.length).toBe(1);
    });
  });
});
