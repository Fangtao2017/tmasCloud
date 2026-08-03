export interface Tenant {
  id: string;
  name: string;
  logo?: string;
}

export interface Site {
  id: string;
  tenantId: string;
  name: string;
  location: string;
  coordinates: [number, number];
  image?: string;
}

export interface CloudSubDevice {
  id: string;
  gatewayId: string;
  externalDeviceId: string | null;
  gatewaySn: string | null;
  name: string;
  type: string;
  zone: string;
  status: 'online' | 'offline';
  alarm: boolean;
  lastSeenMinutes: number;
  lastSeenAt?: string | null;
  reading: string;
  model?: string | null;
  modbusAddress?: number | null;
  enabled?: number | null;
}

export interface CloudGateway {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  model: string;
  protocol: string;
  ipAddress: string;
  firmware: string;
  status: 'online' | 'offline' | 'degraded';
  healthScore: number;
  lastSeenMinutes: number;
  subDevices: CloudSubDevice[];
}

export const tenants: Tenant[] = [
  { id: 'tenant-edu-east', name: 'East Education Cluster' },
  { id: 'tenant-edu-west', name: 'West Education Cluster' },
  { id: 'tenant-edu-north', name: 'North Education Cluster' },
];

export const sites: Site[] = [
  {
    id: 'site-temasek',
    tenantId: 'tenant-edu-east',
    name: 'Temasek Polytechnic',
    location: '21 Tampines Avenue 1',
    coordinates: [1.3453, 103.9329]
  },
  {
    id: 'site-ite-east',
    tenantId: 'tenant-edu-east',
    name: 'ITE College East',
    location: '10 Simei Avenue',
    coordinates: [1.3427, 103.9987]
  },
  {
    id: 'site-republic',
    tenantId: 'tenant-edu-north',
    name: 'Republic Polytechnic',
    location: '9 Woodlands Avenue 9',
    coordinates: [1.4412, 103.8186]
  },
  {
    id: 'site-ngee-ann',
    tenantId: 'tenant-edu-west',
    name: 'Ngee Ann Polytechnic',
    location: '535 Clementi Road',
    coordinates: [1.333, 103.7754]
  },
];

const createSubDevices = (
  gatewayId: string,
  rows: Array<[string, string, string, 'online' | 'offline', boolean, number, string]>
): CloudSubDevice[] => rows.map(([name, type, zone, status, alarm, lastSeenMinutes, reading], index) => ({
  id: `${gatewayId}-dev-${index + 1}`,
  gatewayId,
  externalDeviceId: null,
  gatewaySn: null,
  name,
  type,
  zone,
  status,
  alarm,
  lastSeenMinutes,
  reading,
}));

export const cloudGateways: CloudGateway[] = [
  {
    id: 'gw-tp-01',
    tenantId: 'tenant-edu-east',
    siteId: 'site-temasek',
    name: 'Gateway TP-Block 22',
    model: 'T8000 Edge Gateway',
    protocol: 'Modbus',
    ipAddress: '10.24.18.12',
    firmware: 'v2.4.1',
    status: 'online',
    healthScore: 96,
    lastSeenMinutes: 1,
    subDevices: createSubDevices('gw-tp-01', [
      ['Lecture Hall AHU-01', 'Air Quality Sensor', 'Block 22', 'online', false, 1, 'PM2.5 14 ug/m3'],
      ['Maker Lab Meter', 'Power Meter', 'Design Lab', 'online', false, 2, '7.8 kW'],
      ['Studio CO2 Probe', 'CO2 Sensor', 'South Wing', 'online', true, 1, '1180 ppm'],
      ['Chiller Return Temp', 'Temperature Sensor', 'Plant Room', 'online', false, 3, '11.4 C'],
    ])
  },
  {
    id: 'gw-tp-02',
    tenantId: 'tenant-edu-east',
    siteId: 'site-temasek',
    name: 'Gateway TP-Library',
    model: 'T8000 Edge Gateway',
    protocol: 'MQTT',
    ipAddress: '10.24.19.30',
    firmware: 'v2.4.0',
    status: 'degraded',
    healthScore: 82,
    lastSeenMinutes: 4,
    subDevices: createSubDevices('gw-tp-02', [
      ['Archive Room TH-01', 'Temperature Sensor', 'Level 2', 'online', false, 4, '22.1 C'],
      ['Library Occupancy', 'People Counter', 'Level 3', 'online', false, 2, '86 pax'],
      ['West Wing Humidity', 'Humidity Sensor', 'Level 1', 'offline', true, 16, 'No signal'],
      ['Escalator Panel Meter', 'Power Meter', 'Lobby', 'online', false, 5, '2.4 kW'],
    ])
  },
  {
    id: 'gw-ite-01',
    tenantId: 'tenant-edu-east',
    siteId: 'site-ite-east',
    name: 'Gateway ITE-Workshop',
    model: 'T8000 Edge Gateway',
    protocol: 'Modbus',
    ipAddress: '10.28.11.42',
    firmware: 'v2.3.9',
    status: 'online',
    healthScore: 91,
    lastSeenMinutes: 2,
    subDevices: createSubDevices('gw-ite-01', [
      ['CNC Workshop Meter', 'Power Meter', 'Workshop A', 'online', false, 1, '11.2 kW'],
      ['Fabrication Lab Temp', 'Temperature Sensor', 'Workshop B', 'online', false, 2, '24.0 C'],
      ['Welding Bay VOC', 'Air Quality Sensor', 'Welding Bay', 'online', true, 1, 'VOC high'],
      ['Auto Lab Door Sensor', 'DI Module', 'Automotive Lab', 'online', false, 3, 'Closed'],
    ])
  },
  {
    id: 'gw-rp-01',
    tenantId: 'tenant-edu-north',
    siteId: 'site-republic',
    name: 'Gateway RP-Campus Core',
    model: 'T8000 Edge Gateway',
    protocol: 'MQTT',
    ipAddress: '10.31.8.18',
    firmware: 'v2.4.1',
    status: 'online',
    healthScore: 95,
    lastSeenMinutes: 1,
    subDevices: createSubDevices('gw-rp-01', [
      ['Forum Cooling Meter', 'Power Meter', 'Forum', 'online', false, 1, '9.6 kW'],
      ['Studio East IAQ', 'Air Quality Sensor', 'Studio East', 'online', false, 2, 'AQI 48'],
      ['North Block Occupancy', 'People Counter', 'North Block', 'online', false, 1, '54 pax'],
      ['Campus Water Temp', 'Temperature Sensor', 'Utilities', 'online', false, 2, '18.7 C'],
    ])
  },
  {
    id: 'gw-rp-02',
    tenantId: 'tenant-edu-north',
    siteId: 'site-republic',
    name: 'Gateway RP-Sports Hall',
    model: 'T8000 Edge Gateway',
    protocol: 'Modbus',
    ipAddress: '10.31.9.26',
    firmware: 'v2.2.7',
    status: 'offline',
    healthScore: 61,
    lastSeenMinutes: 23,
    subDevices: createSubDevices('gw-rp-02', [
      ['Sports Hall Temp', 'Temperature Sensor', 'Hall A', 'offline', false, 23, 'No update'],
      ['Spectator CO2', 'CO2 Sensor', 'Upper Stand', 'offline', true, 21, 'No update'],
      ['Lighting Panel Meter', 'Power Meter', 'Control Room', 'offline', false, 24, 'No update'],
    ])
  },
  {
    id: 'gw-np-01',
    tenantId: 'tenant-edu-west',
    siteId: 'site-ngee-ann',
    name: 'Gateway NP-Engineering',
    model: 'T8000 Edge Gateway',
    protocol: 'MQTT',
    ipAddress: '10.36.4.15',
    firmware: 'v2.4.2',
    status: 'online',
    healthScore: 93,
    lastSeenMinutes: 1,
    subDevices: createSubDevices('gw-np-01', [
      ['Mechanical Lab Temp', 'Temperature Sensor', 'Lab 3', 'online', false, 1, '23.2 C'],
      ['Clean Energy Meter', 'Power Meter', 'Energy Lab', 'online', false, 2, '6.1 kW'],
      ['West Atrium Occupancy', 'People Counter', 'Atrium', 'online', false, 2, '112 pax'],
      ['Server Room Humidity', 'Humidity Sensor', 'Block 27A', 'online', true, 1, '74 %'],
    ])
  },
];

export const getTenantById = (tenantId: string) => tenants.find((tenant) => tenant.id === tenantId);

export const getSiteById = (siteId: string) => sites.find((site) => site.id === siteId);

export const getGatewaysBySite = (siteId: string) => cloudGateways.filter((gateway) => gateway.siteId === siteId);

export const getGlobalStats = () => {
  const totalGateways = cloudGateways.length;
  const onlineGateways = cloudGateways.filter((gateway) => gateway.status === 'online').length;
  const degradedGateways = cloudGateways.filter((gateway) => gateway.status === 'degraded').length;
  const totalSubDevices = cloudGateways.reduce((sum, gateway) => sum + gateway.subDevices.length, 0);
  const activeAlarms = cloudGateways.reduce(
    (sum, gateway) => sum + gateway.subDevices.filter((device) => device.alarm).length,
    0
  );

  return {
    totalGateways,
    onlineGateways,
    degradedGateways,
    totalSubDevices,
    activeAlarms,
    totalSites: sites.length,
  };
};

export const getSiteStats = (siteId: string) => {
  const gateways = getGatewaysBySite(siteId);
  const totalGateways = gateways.length;
  const onlineGateways = gateways.filter((gateway) => gateway.status === 'online').length;
  const subDevices = gateways.flatMap((gateway) => gateway.subDevices);
  const activeAlarms = subDevices.filter((device) => device.alarm).length;

  return {
    totalGateways,
    onlineGateways,
    totalSubDevices: subDevices.length,
    activeAlarms,
  };
};
