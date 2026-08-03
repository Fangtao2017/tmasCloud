import type {
  EnergySummary,
  Site,
  Gateway,
  GatewayCreatePayload,
  GatewayUpdatePayload,
  Device,
  Point,
  Measurement,
  LatestPointValue,
} from "../types/api";

// ── Helper ───────────────────────────────────────────────

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      (body as { message?: string })?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// ── Gateways ─────────────────────────────────────────────

export async function getSites(): Promise<Site[]> {
  return request<Site[]>("/api/sites");
}

export async function getSiteEnergySummary(siteId: number): Promise<EnergySummary> {
  return request<EnergySummary>(`/api/sites/${siteId}/energy-summary`);
}

export async function getGateways(): Promise<Gateway[]> {
  return request<Gateway[]>("/api/gateways");
}

export async function getGatewayById(id: number): Promise<Gateway> {
  return request<Gateway>(`/api/gateways/${id}`);
}

export async function createGateway(data: GatewayCreatePayload): Promise<Gateway> {
  return request<Gateway>("/api/gateways", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateGateway(
  id: number,
  data: GatewayUpdatePayload,
): Promise<Gateway> {
  return request<Gateway>(`/api/gateways/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteGateway(id: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/gateways/${id}`, { method: "DELETE" });
}

// ── Devices ──────────────────────────────────────────────

export async function getDevices(gatewayId?: number): Promise<Device[]> {
  return request<Device[]>(`/api/devices${qs({ gateway_id: gatewayId })}`);
}

export async function getDeviceById(id: number): Promise<Device> {
  return request<Device>(`/api/devices/${id}`);
}

export async function updateDevice(
  id: number,
  data: { name?: string; zone?: string; enabled?: boolean },
): Promise<Device> {
  return request<Device>(`/api/devices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteDevice(id: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/devices/${id}`, { method: 'DELETE' });
}

export interface DeviceCreatePayload {
  gateway_id: number;
  name: string;
  model?: string | null;
  modbus_address?: number | null;
  zone?: string | null;
  enabled?: number;
  external_device_id?: string | null;
}

export async function createDevice(data: DeviceCreatePayload): Promise<Device> {
  return request<Device>('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export interface T8000Model {
  id: number;
  brand: string | null;
  model: string | null;
  dev_type: string | null;
  interface: number | null;
}

export async function getT8000Models(): Promise<T8000Model[]> {
  return request<T8000Model[]>('/api/t8000-models');
}

export interface T8000Parameter {
  id: number;
  model_id: string | number;
  parameter: string | null;
  attr: string | null;
  unit: string | null;
  data_type: number | null;
  rw: number | null;
  source: string | null;
  channel: number | null;
}

export async function getT8000Parameters(model_id?: string): Promise<T8000Parameter[]> {
  return request<T8000Parameter[]>(`/api/t8000-parameters${qs({ model_id })}`);
}

export async function requestReadSetting(
  gatewayId: number,
): Promise<{ success: boolean; message?: string }> {
  return request<{ success: boolean; message?: string }>('/api/gateway/read-setting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gatewayId }),
  });
}

// ── Points ───────────────────────────────────────────────

export async function getPoints(filters?: {
  gateway_id?: number;
  device_id?: number;
}): Promise<Point[]> {
  return request<Point[]>(`/api/points${qs(filters ?? {})}`);
}

export async function getPointById(id: number): Promise<Point> {
  return request<Point>(`/api/points/${id}`);
}

// ── Measurements ─────────────────────────────────────────

export async function getMeasurements(filters?: {
  point_id?: number;
  device_id?: number;
  gateway_id?: number;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<Measurement[]> {
  return request<Measurement[]>(`/api/measurements${qs(filters ?? {})}`);
}

export async function getLatestByDevice(
  deviceId: number,
): Promise<LatestPointValue[]> {
  return request<LatestPointValue[]>(
    `/api/measurements/latest/device/${deviceId}`,
  );
}

// ── Device Groups ─────────────────────────────────────────

export interface DeviceGroupRecord {
  id: string;
  name: string;
  color: string;
  deviceIds: string[];
  collapsed?: boolean;
}

export async function getDeviceGroups(gatewayId: string): Promise<DeviceGroupRecord[]> {
  return request<DeviceGroupRecord[]>(`/api/gateways/${gatewayId}/groups`);
}

export async function putDeviceGroups(gatewayId: string, groups: DeviceGroupRecord[]): Promise<DeviceGroupRecord[]> {
  return request<DeviceGroupRecord[]>(`/api/gateways/${gatewayId}/groups`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(groups),
  });
}

// ── T8000 Config Write ────────────────────────────────────

export interface ConfigWritePayload {
  gatewaySn: string;
  devId: number;
  paramId: number;
  value: number;
  duration: number;
}

export interface ConfigWriteResult {
  success: boolean;
  error: number;
  message?: string;
}

export async function sendConfigToGateway(
  payload: ConfigWritePayload,
): Promise<ConfigWriteResult> {
  return request<ConfigWriteResult>('/api/gateway/config-write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

