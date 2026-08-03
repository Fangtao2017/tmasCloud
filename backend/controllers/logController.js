const db = require("../db");
const fs = require("fs");
const { getMqttLogs, getSystemLogs } = require("../adapters/t8000Adapter");
const { listLogFiles, resolveLogFilePath, purgeOldLogFiles, DEFAULT_RETENTION_DAYS } = require("../utils/logFileWriter");

// Map event_mode to severity and LogType for the frontend
function mapEventMode(mode) {
  switch (mode) {
    case "alarm":
      return { severity: "warning", type: "Alarm" };
    case "error":
      return { severity: "error", type: "Communication" };
    case "health":
    case "read_health":
      return { severity: "info", type: "Device" };
    case "status":
    case "count":
      return { severity: "info", type: "System" };
    case "rule":
      return { severity: "warning", type: "Rule" };
    case "setting":
      return { severity: "info", type: "System" };
    default:
      return { severity: "info", type: "System" };
  }
}

// Parse event_data JSON and extract a human-readable summary
function extractSummary(eventMode, rawEventData) {
  let data;
  try {
    data = typeof rawEventData === "string" ? JSON.parse(rawEventData) : rawEventData;
  } catch {
    return `${eventMode} event`;
  }

  if (!data || typeof data !== "object") return `${eventMode} event`;

  // Alarm events
  if (eventMode === "alarm") {
    const param = data.param_id ?? data.point ?? "";
    const val = data.value ?? data.alarm_value ?? "";
    if (param) return `Alarm: ${param}${val !== "" ? ` = ${val}` : ""}`;
    return "Alarm triggered";
  }

  // Error events
  if (eventMode === "error") {
    const code = data.error_code ?? data.code ?? data.err ?? "";
    if (code !== "") return `Error code: ${code}`;
    return "Device communication error";
  }

  // Health events
  if (eventMode === "health" || eventMode === "read_health") {
    const score = data.health_score ?? data.score ?? data.health ?? "";
    const status = data.status ?? data.health_status ?? "";
    if (score !== "") return `Health score: ${score}`;
    if (status !== "") return `Health status: ${status}`;
    return "Health report received";
  }

  // Status events
  if (eventMode === "status") {
    const status = data.status ?? data.state ?? "";
    if (status !== "") return `Status: ${status}`;
    return "Status update received";
  }

  // Rule events
  if (eventMode === "rule") {
    const ruleId = data.rule_id ?? data.rule ?? "";
    const result = data.result ?? data.action ?? "";
    if (ruleId) return `Rule ${ruleId}${result ? `: ${result}` : " triggered"}`;
    return "Rule event";
  }

  // Setting events
  if (eventMode === "setting") {
    const key = data.key ?? data.param ?? data.setting ?? "";
    if (key) return `Setting changed: ${key}`;
    return "Setting event";
  }

  // Fallback: return stringified first meaningful field
  const firstVal = Object.entries(data).find(([, v]) => v !== null && v !== undefined);
  if (firstVal) return `${eventMode}: ${firstVal[0]}=${firstVal[1]}`;
  return `${eventMode} event`;
}

// Severity upgrade for alarm events based on error code or value
function upgradeAlarmSeverity(eventData) {
  try {
    const data = typeof eventData === "string" ? JSON.parse(eventData) : eventData;
    if (!data) return "warning";
    // If there's an explicit critical flag
    if (data.critical === true || data.critical === 1) return "critical";
    // High alarm value threshold heuristic
    const val = parseFloat(data.value ?? data.alarm_value ?? "NaN");
    if (!Number.isNaN(val) && val > 100) return "critical";
    return "warning";
  } catch {
    return "warning";
  }
}

// GET /api/logs/events
// Query params: mode, gateway_id, start, end, limit, offset, keyword
async function getEventLogs(req, res) {
  try {
    const { role, siteIds } = req.user;
    const {
      mode,
      gateway_id,
      start,
      end,
      limit = 200,
      offset = 0,
      keyword,
    } = req.query;

    // Non-admin with no sites → return empty immediately
    if (role !== 'admin' && (!siteIds || siteIds.length === 0)) {
      return res.json({ logs: [], total: 0 });
    }

    const params = [];
    // 'setting' events are internal system sync requests (read_setting response from gateway)
    // and should never be shown to users in the log page.
    const conditions = ["e.event_mode <> 'setting'"];

    // Time range — default to last 24 hours
    const endTime = end ? new Date(Number(end) * 1000) : new Date();
    const startTime = start
      ? new Date(Number(start) * 1000)
      : new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    conditions.push("e.source_timestamp >= ?");
    params.push(startTime);
    conditions.push("e.source_timestamp <= ?");
    params.push(endTime);

    if (mode) {
      const modes = String(mode).split(",").map((m) => m.trim()).filter(Boolean);
      if (modes.length === 1) {
        conditions.push("e.event_mode = ?");
        params.push(modes[0]);
      } else if (modes.length > 1) {
        conditions.push(`e.event_mode IN (${modes.map(() => "?").join(",")})`);
        params.push(...modes);
      }
    }

    if (gateway_id) {
      conditions.push("e.gateway_id = ?");
      params.push(Number(gateway_id));
    }

    // Site access filter for non-admin
    if (role !== 'admin') {
      conditions.push(`g.site_id IN (${siteIds.map(() => '?').join(',')})`);
      params.push(...siteIds);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT
         e.id,
         UNIX_TIMESTAMP(e.source_timestamp) AS timestamp,
         e.event_mode,
         e.event_data,
         e.external_device_id,
         g.name   AS gateway_name,
         g.sn     AS gateway_sn,
         g.ip_address AS gateway_ip,
         d.name   AS device_name
       FROM event e
       LEFT JOIN gateway g ON e.gateway_id = g.id
       LEFT JOIN device  d ON e.device_id  = d.id
       ${whereClause}
       ORDER BY e.source_timestamp DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const logs = rows
      .map((row) => {
        const { severity: baseSeverity, type } = mapEventMode(row.event_mode);
        const severity =
          row.event_mode === "alarm"
            ? upgradeAlarmSeverity(row.event_data)
            : baseSeverity;

        const summary = extractSummary(row.event_mode, row.event_data);

        // Keyword filter (post-SQL for simplicity)
        if (keyword) {
          const kw = String(keyword).toLowerCase();
          const searchTarget = [
            summary,
            row.gateway_name ?? "",
            row.device_name ?? "",
            row.external_device_id ?? "",
            row.event_mode,
          ]
            .join(" ")
            .toLowerCase();
          if (!searchTarget.includes(kw)) return null;
        }

        let parsedData = {};
        try {
          parsedData =
            typeof row.event_data === "string"
              ? JSON.parse(row.event_data)
              : row.event_data ?? {};
        } catch {
          parsedData = {};
        }

        return {
          id: String(row.id),
          timestamp: row.timestamp,
          severity,
          type,
          site: "",           // no site info in DB yet
          gateway: row.gateway_name ?? row.gateway_sn ?? "Unknown Gateway",
          device:
            row.device_name ??
            (row.external_device_id ? `Device ${row.external_device_id}` : "–"),
          summary,
          status: "active",   // events don't have an acknowledged status stored
          module:
            type === "Alarm"
              ? "alarm"
              : type === "Communication"
              ? "communication"
              : type === "Rule"
              ? "rule"
              : "system",
          topic: `moe/${row.gateway_sn ?? "?"}/${row.event_mode}`,
          messageId: `EVT-${row.id}`,
          payload: parsedData,
          timeline: [
            { at: row.timestamp, event: "Received" },
          ],
        };
      })
      .filter(Boolean);

    return res.json({ logs, total: logs.length });
  } catch (err) {
    console.error("getEventLogs error:", err);
    return res.status(500).json({ message: "Failed to fetch event logs" });
  }
}

// GET /api/logs/mqtt
// Reads from daily NDJSON log files so data persists across server restarts.
// Falls back to the in-memory buffer for the current day if no file exists yet.
async function getMqttLogsHandler(req, res) {
  try {
    const { role, siteIds } = req.user;
    const { limit = 200, start, end, keyword } = req.query;

    // Non-admin with no sites → return empty immediately
    if (role !== 'admin' && (!siteIds || siteIds.length === 0)) {
      return res.json({ logs: [], total: 0 });
    }

    // Build allowed gateway SN set for non-admin
    let allowedSns = null;
    if (role !== 'admin') {
      const [gwRows] = await db.query(
        `SELECT sn FROM gateway WHERE site_id IN (${siteIds.map(() => '?').join(',')})`,
        siteIds
      );
      allowedSns = new Set(gwRows.map((r) => r.sn));
    }

    // Determine the unix-second time window
    const endTs   = end   ? Number(end)   : Math.floor(Date.now() / 1000);
    const startTs = start ? Number(start) : endTs - 86400;

    // Build the list of calendar dates that overlap the window
    const dates = [];
    const cur = new Date(startTs * 1000);
    cur.setHours(0, 0, 0, 0);
    const endDay = new Date(endTs * 1000);
    while (cur <= endDay) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }

    // Read NDJSON files for each date
    let logs = [];
    for (const dateStr of dates) {
      const filePath = resolveLogFilePath(`${dateStr}_mqtt.jsonl`);
      if (!filePath || !fs.existsSync(filePath)) continue;
      try {
        const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
        for (const line of lines) {
          try { logs.push(JSON.parse(line)); } catch { /* skip malformed */ }
        }
      } catch { /* skip unreadable files */ }
    }

    // If no file data at all, fall back to in-memory buffer (e.g. first run)
    if (logs.length === 0) {
      logs = getMqttLogs();
    }

    // Time filter
    logs = logs.filter((l) => {
      const ts = Number(l.timestamp);
      return ts >= startTs && ts <= endTs;
    });

    // Site access filter
    if (allowedSns !== null) {
      logs = logs.filter((l) => allowedSns.has(l.gatewaySn));
    }

    // Sort newest first
    logs.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

    // Resolve gateway names and filter to registered gateways only.
    // Unregistered SNs (seen in MQTT traffic but not added to the system) are excluded
    // so users never see logs from foreign/unknown devices.
    const uniqueSns = [...new Set(logs.map((l) => l.gatewaySn).filter(Boolean))];
    const snToName = {};
    if (uniqueSns.length > 0) {
      const [gwRows] = await db.query(
        `SELECT sn, name FROM gateway WHERE sn IN (${uniqueSns.map(() => '?').join(',')})`,
        uniqueSns
      );
      gwRows.forEach((r) => { snToName[r.sn] = r.name; });
    }

    // Drop logs from SNs not in the DB (unregistered gateways)
    logs = logs.filter((l) => snToName[l.gatewaySn]);
    logs = logs.map((l) => ({ ...l, gatewayName: snToName[l.gatewaySn] }));

    // Keyword filter
    if (keyword) {
      const kw = String(keyword).toLowerCase();
      logs = logs.filter(
        (l) =>
          (l.topic    ?? '').toLowerCase().includes(kw) ||
          (l.gatewaySn ?? '').toLowerCase().includes(kw) ||
          (l.mode     ?? '').toLowerCase().includes(kw)
      );
    }

    return res.json({ logs: logs.slice(0, Number(limit)), total: logs.length });
  } catch (err) {
    console.error("getMqttLogsHandler error:", err);
    return res.status(500).json({ message: "Failed to fetch MQTT logs" });
  }
}

// GET /api/logs/system
// Returns in-memory system log ring buffer
async function getSystemLogsHandler(req, res) {
  try {
    const { limit = 200, keyword } = req.query;

    let logs = getSystemLogs();

    if (keyword) {
      const kw = String(keyword).toLowerCase();
      logs = logs.filter((l) => l.message.toLowerCase().includes(kw));
    }

    return res.json({ logs: logs.slice(0, Number(limit)), total: logs.length });
  } catch (err) {
    console.error("getSystemLogsHandler error:", err);
    return res.status(500).json({ message: "Failed to fetch system logs" });
  }
}

// GET /api/logs/stats
// Returns summary counts for dashboard KPIs
async function getLogStats(req, res) {
  try {
    const { role, siteIds } = req.user;
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);

    // Non-admin with no sites → return zero counts
    if (role !== 'admin' && (!siteIds || siteIds.length === 0)) {
      return res.json({ hours: Number(hours), totalEvents: 0, byMode: { alarm: 0, error: 0, health: 0, read_health: 0, status: 0, rule: 0, setting: 0, count: 0 }, mqttMessages: 0 });
    }

    let siteFilter = '';
    const statsParams = [since];
    if (role !== 'admin') {
      siteFilter = `AND e.gateway_id IN (SELECT id FROM gateway WHERE site_id IN (${siteIds.map(() => '?').join(',')})) `;
      statsParams.push(...siteIds);
    }

    const [rows] = await db.query(
      `SELECT event_mode, COUNT(*) AS cnt FROM event e WHERE source_timestamp >= ? ${siteFilter}GROUP BY event_mode`,
      statsParams
    );

    const counts = {
      alarm: 0,
      error: 0,
      health: 0,
      read_health: 0,
      status: 0,
      rule: 0,
      setting: 0,
      count: 0,
    };

    rows.forEach((r) => {
      if (counts[r.event_mode] !== undefined) counts[r.event_mode] = Number(r.cnt);
    });

    return res.json({
      hours: Number(hours),
      totalEvents:
        Object.values(counts).reduce((a, b) => a + b, 0),
      byMode: counts,
      mqttMessages: getMqttLogs().filter(
        (l) => l.timestamp >= since.getTime() / 1000
      ).length,
    });
  } catch (err) {
    console.error("getLogStats error:", err);
    return res.status(500).json({ message: "Failed to fetch log stats" });
  }
}

module.exports = {
  getEventLogs,
  getMqttLogsHandler,
  getSystemLogsHandler,
  getLogStats,
  listLogFilesHandler,
  downloadLogFileHandler,
};

// GET /api/logs/files
// Returns list of available daily log files
async function listLogFilesHandler(req, res) {
  try {
    const files = listLogFiles();
    return res.json({ files });
  } catch (err) {
    console.error("listLogFilesHandler error:", err);
    return res.status(500).json({ message: "Failed to list log files" });
  }
}

// GET /api/logs/files/:filename
// Streams a single .jsonl file as a download attachment
async function downloadLogFileHandler(req, res) {
  try {
    const { filename } = req.params;
    const filePath = resolveLogFilePath(filename);

    if (!filePath) {
      return res.status(400).json({ message: "Invalid filename" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Log file not found" });
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error("downloadLogFileHandler error:", err);
    return res.status(500).json({ message: "Failed to download log file" });
  }
}

// DELETE /api/logs/files/:filename  — delete a specific file
async function deleteLogFileHandler(req, res) {
  try {
    const { filename } = req.params;
    const filePath = resolveLogFilePath(filename);
    if (!filePath) return res.status(400).json({ message: "Invalid filename" });
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Log file not found" });
    fs.unlinkSync(filePath);
    return res.json({ message: `Deleted ${filename}` });
  } catch (err) {
    console.error("deleteLogFileHandler error:", err);
    return res.status(500).json({ message: "Failed to delete log file" });
  }
}

// POST /api/logs/purge  — manually trigger retention purge
async function purgeLogFilesHandler(req, res) {
  try {
    const days = req.body?.days != null ? Number(req.body.days) : DEFAULT_RETENTION_DAYS;
    if (!Number.isFinite(days) || days < 1) {
      return res.status(400).json({ message: "days must be a positive number" });
    }
    const results = purgeOldLogFiles(days);
    const deleted = results.filter((r) => r.deleted).length;
    const failed = results.filter((r) => !r.deleted).length;
    return res.json({ message: `Purged ${deleted} file(s), ${failed} failed`, days, results });
  } catch (err) {
    console.error("purgeLogFilesHandler error:", err);
    return res.status(500).json({ message: "Failed to purge log files" });
  }
}

module.exports = {
  getEventLogs,
  getMqttLogsHandler,
  getSystemLogsHandler,
  getLogStats,
  listLogFilesHandler,
  downloadLogFileHandler,
  deleteLogFileHandler,
  purgeLogFilesHandler,
};
