import { Device, DeviceInterface, Link, WirelessConfig, IotConfig } from '../../types/network';

export interface WirelessAssociationState {
  clientDeviceId: string;
  clientMac: string;
  clientIp?: string;
  apDeviceId: string;
  apName: string;
  ssid: string;
  rssiDbm: number;
  snrDb: number;
  channel: number;
  band: '2.4GHz' | '5GHz';
  protocol: '802.11ax' | '802.11ac' | '802.11n';
  security: 'open' | 'wpa2-psk' | 'wpa3';
  state: 'Associated' | 'Authenticating' | 'Disconnected';
}

export interface MqttMessage {
  topic: string;
  payload: Record<string, any>;
  timestamp: number;
  publisherId: string;
  qos: 0 | 1 | 2;
}

export interface WirelessIotComputedState {
  associations: WirelessAssociationState[];
  registeredAps: { apId: string; apName: string; wlcId: string; capwapState: 'RUN' | 'DISCOVER' }[];
  activeMqttMessages: MqttMessage[];
  iotSensorsStatus: {
    deviceId: string;
    deviceName: string;
    sensorType: string;
    telemetry: Record<string, any>;
    brokerIp: string;
    status: 'Connected' | 'Publishing' | 'Offline';
  }[];
}

/**
 * Computes 802.11 wireless client associations, WLC CAPWAP tunnels, and IoT MQTT telemetry.
 */
export function computeWirelessIotNetworkState(devices: Device[], links: Link[]): WirelessIotComputedState {
  const associations: WirelessAssociationState[] = [];
  const registeredAps: { apId: string; apName: string; wlcId: string; capwapState: 'RUN' | 'DISCOVER' }[] = [];
  const activeMqttMessages: MqttMessage[] = [];
  const iotSensorsStatus: WirelessIotComputedState['iotSensorsStatus'] = [];

  const wlcDev = devices.find((d) => d.type === 'wlc' || d.config.wireless?.wlanProfiles);
  const apDevices = devices.filter((d) => d.type === 'ap' || d.type === 'home_router');
  const clientDevices = devices.filter(
    (d) => d.type === 'laptop' || d.type === 'pc' || d.type === 'iot_sensor'
  );
  const iotGateways = devices.filter((d) => d.type === 'iot_gateway' || d.config.iot?.role === 'gateway');
  const iotSensors = devices.filter((d) => d.type === 'iot_sensor' || d.config.iot?.role === 'sensor');

  // 1. Establish WLC <-> AP CAPWAP management sessions
  if (wlcDev) {
    for (const ap of apDevices) {
      registeredAps.push({
        apId: ap.id,
        apName: ap.name,
        wlcId: wlcDev.id,
        capwapState: 'RUN',
      });
    }
  }

  // 2. Discover wireless client associations based on proximity or links to APs
  const defaultSsid = wlcDev?.config.wireless?.wlanProfiles?.[0]?.ssid || 'Enterprise-Secure-WiFi';

  for (const client of clientDevices) {
    // Check if client is linked to an AP or has wireless active
    const linkedToAp = links.some(
      (l) =>
        (l.fromDevice === client.id && apDevices.some((a) => a.id === l.toDevice)) ||
        (l.toDevice === client.id && apDevices.some((a) => a.id === l.fromDevice))
    );

    const firstAp = apDevices[0];
    if (linkedToAp || (firstAp && client.type === 'laptop')) {
      const targetAp = firstAp;
      const clientIface = Object.values(client.config.interfaces || {})[0];

      associations.push({
        clientDeviceId: client.id,
        clientMac: clientIface?.mac || '0050.7966.6801',
        clientIp: clientIface?.ip || client.config.defaultGateway || '192.168.10.50',
        apDeviceId: targetAp ? targetAp.id : 'ap-1',
        apName: targetAp ? targetAp.name : 'AP-1',
        ssid: defaultSsid,
        rssiDbm: -54,
        snrDb: 38,
        channel: 36,
        band: '5GHz',
        protocol: '802.11ax',
        security: 'wpa2-psk',
        state: 'Associated',
      });
    }
  }

  // 3. Process IoT MQTT Telemetry
  const brokerIp =
    iotGateways[0]?.config?.interfaces?.['Eth0']?.ip ||
    Object.values(iotGateways[0]?.config?.interfaces || {})[0]?.ip ||
    '192.168.1.50';

  for (const sensor of iotSensors) {
    const sensorCfg = sensor.config.iot;
    const telemetry = sensorCfg?.telemetry || {
      temperature: 22.8 + Math.round(Math.random() * 40) / 10,
      humidity: 45,
      motionDetected: false,
      alert: 'Nominal',
    };

    iotSensorsStatus.push({
      deviceId: sensor.id,
      deviceName: sensor.name,
      sensorType: sensorCfg?.sensorType || 'Environmental',
      telemetry,
      brokerIp,
      status: 'Publishing',
    });

    // Generate simulated MQTT publish message
    activeMqttMessages.push({
      topic: `iot/sensors/${sensor.name.toLowerCase()}/telemetry`,
      payload: telemetry,
      timestamp: Date.now(),
      publisherId: sensor.id,
      qos: 1,
    });
  }

  return { associations, registeredAps, activeMqttMessages, iotSensorsStatus };
}
