import { useCallback, useEffect, useRef, useState } from "react";
import { getGateways, getDevices, getLatestByDevice, getSites } from "../services/api";
import type { Gateway, Device, LatestPointValue, Site as ApiSite } from "../types/api";
import type { CloudGateway, CloudSubDevice } from "../data/cloudData";
import { sites } from "../data/cloudData";

export type { ApiSite };

/** Fetch real sites from the backend; falls back to empty array on error */
export function useSites(): ApiSite[] {
  const [apiSites, setApiSites] = useState<ApiSite[]>([]);
  useEffect(() => {
    getSites()
      .then((data) => setApiSites(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
  return apiSites;
}

// ── Helpers ──────────────────────────────────────────────

function minutesAgo(dateStr: string | null): number {
  if (!dateStr) return 999;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.round(diff / 60_000));
}

function mapStatus(raw: string | null): CloudGateway["status"] {
  const s = (raw ?? "").toLowerCase();
  if (s === "online") return "online";
  if (s === "degraded") return "degraded";
  return "offline";
}

function mapDeviceStatus(raw: string | null): "online" | "offline" {
  return (raw ?? "").toLowerCase() === "online" ? "online" : "offline";
}

function buildSubDevice(
  device: Device,
  latestMap: Map<number, LatestPointValue[]>,
): CloudSubDevice {
  const points = latestMap.get(device.id) ?? [];

  // Build reading string from all points that have values
  const pointReadings = points
    .filter((p) => p.latest_value !== null)
    .map((p) => {
      const label = p.parameter_name ?? p.param_id ?? p.point_name ?? "?";
      const unit = p.unit ? ` ${p.unit}` : "";
      return `${label}: ${p.latest_value}${unit}`;
    });
  const reading = pointReadings.length > 0 ? pointReadings.join(" | ") : "—";

  // Determine device freshness from most recent point timestamp
  const mostRecentTs = points.reduce<string | null>((best, p) => {
    if (!p.latest_timestamp) return best;
    if (!best) return p.latest_timestamp;
    return p.latest_timestamp > best ? p.latest_timestamp : best;
  }, device.last_seen);

  const lastMins = minutesAgo(mostRecentTs);
  const isOnline = mapDeviceStatus(device.status) === "online";

  return {
    id: String(device.id),
    gatewayId: String(device.gateway_id),
    externalDeviceId: device.external_device_id ?? null,
    gatewaySn: device.gateway_sn ?? null,
    name: device.name,
    type: device.device_type ?? device.model ?? "Unknown",
    zone: device.zone ?? "—",
    status: isOnline ? "online" : "offline",
    alarm: false,
    lastSeenMinutes: lastMins,
    lastSeenAt: mostRecentTs,
    reading,
    model: device.model ?? null,
    modbusAddress: device.modbus_address ?? null,
    enabled: device.enabled ?? 1,
  };
}

function buildCloudGateway(
  gw: Gateway,
  devices: Device[],
  latestMap: Map<number, LatestPointValue[]>,
): CloudGateway {
  const subs = devices.map((d) => buildSubDevice(d, latestMap));
  const onlineCount = subs.filter((s) => s.status === "online").length;
  const total = subs.length;
  const healthScore =
    total === 0 ? 100 : Math.round((onlineCount / total) * 100);

  return {
    id: String(gw.id),
    tenantId: "",
    siteId: gw.site_id ? String(gw.site_id) : "",
    name: gw.name,
    model: gw.gateway_type ?? "Gateway",
    protocol: gw.gateway_type ?? "Unknown",
    ipAddress: gw.ip_address,
    firmware: "",
    status: mapStatus(gw.status),
    healthScore,
    lastSeenMinutes: minutesAgo(gw.last_seen),
    subDevices: subs,
  };
}

// ── Hook ─────────────────────────────────────────────────

export interface GatewayData {
  gateways: CloudGateway[];
  /** Raw point data keyed by device ID (numeric) */
  pointsByDevice: Map<number, LatestPointValue[]>;
  loading: boolean;
  error: string | null;
  /** Call to re-fetch all data */
  refresh: () => void;
}

export function useGatewayData(): GatewayData {
  const [gateways, setGateways] = useState<CloudGateway[]>([]);
  const [pointsByDevice, setPointsByDevice] = useState<Map<number, LatestPointValue[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // Track whether the very first fetch has completed.
  // Background refreshes (SSE-triggered) must NOT set loading=true to avoid UI flicker.
  const hasLoadedOnce = useRef(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Only show the full-screen spinner on the initial mount.
      if (!hasLoadedOnce.current) setLoading(true);
      setError(null);

      try {
        // 1. Fetch gateways + all devices in parallel
        const [rawGateways, rawDevices] = await Promise.all([
          getGateways(),
          getDevices(),
        ]);

        if (cancelled) return;

        // 2. Group devices by gateway
        const devicesByGw = new Map<number, Device[]>();
        for (const d of rawDevices) {
          const list = devicesByGw.get(d.gateway_id) ?? [];
          list.push(d);
          devicesByGw.set(d.gateway_id, list);
        }

        // 3. Fetch latest values for all devices (parallel, best-effort)
        const latestMap = new Map<number, LatestPointValue[]>();
        const latestResults = await Promise.allSettled(
          rawDevices.map((d) =>
            getLatestByDevice(d.id).then((vals) => ({ deviceId: d.id, vals })),
          ),
        );
        for (const result of latestResults) {
          if (result.status === "fulfilled") {
            latestMap.set(result.value.deviceId, result.value.vals);
          }
        }

        if (cancelled) return;

        // 4. Build CloudGateway array
        const mapped = rawGateways.map((gw) =>
          buildCloudGateway(gw, devicesByGw.get(gw.id) ?? [], latestMap),
        );

        setGateways(mapped);
        setPointsByDevice(latestMap);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          hasLoadedOnce.current = true;
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // Subscribe to SSE: re-fetch only when backend pushes a data-change event.
  // This replaces polling — the UI updates only when real data arrives.
  useEffect(() => {
    const es = new EventSource("/api/events/stream", { withCredentials: true });
    es.onmessage = () => setTick((t) => t + 1);
    es.onerror = () => {}; // EventSource auto-reconnects; silence the noise
    return () => es.close();
  }, []);

  return { gateways, pointsByDevice, loading, error, refresh };
}

// ── Re-export site helpers (kept from mock until backend supports sites) ──

export type { LatestPointValue };

export { sites };

export const getSiteById = (siteId: string) =>
  sites.find((site) => site.id === siteId);

export const getTenantById = (_tenantId: string) => undefined;

export function getStatsFromGateways(gateways: CloudGateway[]) {
  const totalGateways = gateways.length;
  const onlineGateways = gateways.filter((g) => g.status === "online").length;
  const degradedGateways = gateways.filter((g) => g.status === "degraded").length;
  const totalSubDevices = gateways.reduce((s, g) => s + g.subDevices.length, 0);
  const activeAlarms = gateways.reduce(
    (s, g) => s + g.subDevices.filter((d) => d.alarm).length,
    0,
  );

  return {
    totalGateways,
    onlineGateways,
    degradedGateways,
    totalSubDevices,
    activeAlarms,
    totalSites: sites.length,
  };
}
