export interface EnergySummary {
  current_load_kw: number;
  today_energy_kwh: number;
  peak_demand_kw: number;
  peak_time: string | null;
  meter_count: number;
}

// ── Site ─────────────────────────────────────────────────
export interface Site {
  id: number;
  name: string;
  code: string | null;
  address: string | null;
  description: string | null;
  created_at: string;
  gateway_count: number;
  online_gateways: number;
}

// ── Gateway ──────────────────────────────────────────────
export interface Gateway {
  id: number;
  site_id: number | null;
  name: string;
  sn: string | null;
  gateway_type: string;
  ip_address: string;
  port: number;
  username: string | null;
  status: string;
  mqtt_status: string | null;
  polling_interval_sec: number;
  last_seen: string | null;
  last_mqtt_connected_at: string | null;
  last_mqtt_disconnected_at: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface GatewayCreatePayload {
  site_id?: number | null;
  name: string;
  sn?: string | null;
  gateway_type?: string;
  ip_address: string;
  port?: number;
  username?: string | null;
  password?: string | null;
  status?: string;
  polling_interval_sec?: number;
  remarks?: string | null;
}

export type GatewayUpdatePayload = GatewayCreatePayload;

// ── Device ───────────────────────────────────────────────
export interface Device {
  id: number;
  gateway_id: number;
  external_device_id: string | null;
  name: string;
  device_type: string | null;
  model: string | null;
  modbus_address: number | null;
  zone: string | null;
  status: string | null;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
  enabled: number | null;
  // joined fields
  gateway_name: string;
  gateway_sn: string | null;
}

// ── Point ────────────────────────────────────────────────
export interface Point {
  id: number;
  gateway_id: number;
  device_id: number;
  param_id: string | null;
  point_name: string | null;
  point_type: string | null;
  unit: string | null;
  latest_value: string | null;
  latest_timestamp: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  device_name: string;
  external_device_id: string | null;
  gateway_name: string;
  gateway_sn: string | null;
}

// ── Measurement ──────────────────────────────────────────
export interface Measurement {
  id: number;
  point_id: number;
  value_double: number | null;
  value_text: string | null;
  quality: string | null;
  source_timestamp: string;
  // joined fields
  param_id: string | null;
  point_name: string | null;
  gateway_id: number;
  device_name: string;
  external_device_id: string | null;
}

export interface LatestPointValue {
  point_id: number;
  param_id: string | null;
  point_name: string | null;
  point_type: string | null;
  latest_value: string | null;
  latest_timestamp: string | null;
  // joined from t8000_parameter
  parameter_name: string | null;
  unit: string | null;
  attr: string | null;
  lower_limit: number | null;
  upper_limit: number | null;
  rw: number | null;
}
