const mqtt = require("mqtt");
const db = require("../db");
const { writeLogEntry } = require("../utils/logFileWriter");
const dataEvents = require("../utils/dataEvents");

const MQTT_STATUS_CONNECTED = "connected";
const MQTT_STATUS_CONNECTING = "connecting";
const MQTT_STATUS_DISCONNECTED = "disconnected";
const DEFAULT_MQTT_TOPIC = "moe/+/Data";
const DEFAULT_MQTT_CLIENT_ID = `tmas-backend-${process.pid}`;

const MEASUREMENT_MODES = new Set(["scheduled", "read", "change"]);
const EVENT_MODES = new Set(["alarm", "error", "health", "read_health", "status", "rule", "setting", "count"]);

let mqttClient = null;
let mqttListenerStarted = false;

// ── In-memory log ring buffers ────────────────────────────
const MQTT_LOG_MAX = 1000;
const SYSTEM_LOG_MAX = 500;
const mqttLogBuffer = [];  // { id, timestamp, topic, gatewaySn, mode, itemCount, status, error }
const systemLogBuffer = []; // { id, timestamp, level, message }
let mqttLogSeq = 0;
let sysLogSeq = 0;

// Cache of registered gateway SNs — populated on MQTT connect, used to
// silently discard messages from unknown/unregistered gateways before writing any log.
let registeredGatewaySns = new Set();

function pushMqttLog(entry) {
  const record = { id: ++mqttLogSeq, timestamp: new Date().toISOString(), ...entry };
  mqttLogBuffer.unshift(record);
  if (mqttLogBuffer.length > MQTT_LOG_MAX) mqttLogBuffer.pop();
  writeLogEntry("mqtt", record);
}

function pushSystemLog(level, message) {
  const record = { id: ++sysLogSeq, timestamp: new Date().toISOString(), level, message };
  systemLogBuffer.unshift(record);
  if (systemLogBuffer.length > SYSTEM_LOG_MAX) systemLogBuffer.pop();
  writeLogEntry("system", record);
}

function getMqttLogs() {
  return mqttLogBuffer;
}

function getSystemLogs() {
  return systemLogBuffer;
}

class T8000IngestError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.name = "T8000IngestError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function normalizeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toLowerCase();
}

function parseUnixTimestamp(value) {
  const numericValue =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(numericValue)) {
    throw new T8000IngestError("Invalid timestamp in T8000 payload", 400, {
      timestamp: value
    });
  }

  const milliseconds =
    Math.abs(numericValue) < 1_000_000_000_000 ? numericValue * 1000 : numericValue;

  const parsed = new Date(milliseconds);

  if (Number.isNaN(parsed.getTime())) {
    throw new T8000IngestError("Invalid timestamp in T8000 payload", 400, {
      timestamp: value
    });
  }

  return parsed;
}

function parseTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    return new Date();
  }

  if (typeof value === "number") {
    return parseUnixTimestamp(value);
  }

  if (/^-?\d+$/.test(String(value).trim())) {
    return parseUnixTimestamp(value);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new T8000IngestError("Invalid timestamp in T8000 payload", 400, {
      timestamp: value
    });
  }

  return parsed;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "number") {
    if (value === 0 || value === 1) {
      return value;
    }

    throw new T8000IngestError("Boolean point value must be 0 or 1", 422, {
      value
    });
  }

  const normalized = normalizeString(value);

  if (["1", "true", "on", "yes"].includes(normalized)) {
    return 1;
  }

  if (["0", "false", "off", "no"].includes(normalized)) {
    return 0;
  }

  throw new T8000IngestError("Boolean point value is invalid", 422, {
    value
  });
}

function normalizePointValue(point, rawValue) {
  if (rawValue === undefined) {
    throw new T8000IngestError("Measurement value is required", 400);
  }

  const pointType = normalizeString(point.point_type);

  if (pointType === "number") {
    const numericValue =
      typeof rawValue === "number" ? rawValue : Number.parseFloat(String(rawValue));

    if (!Number.isFinite(numericValue)) {
      throw new T8000IngestError("Numeric point value is invalid", 422, {
        pointId: point.id,
        pointName: point.point_name,
        value: rawValue
      });
    }

    return {
      latestValue: String(numericValue),
      valueDouble: numericValue,
      valueText: null
    };
  }

  if (pointType === "boolean") {
    const booleanValue = normalizeBoolean(rawValue);
    const latestValue = String(booleanValue);

    return {
      latestValue,
      valueDouble: booleanValue,
      valueText: latestValue
    };
  }

  const textValue = String(rawValue);

  return {
    latestValue: textValue,
    valueDouble: null,
    valueText: textValue
  };
}

function pushMeasurement(target, entry, context = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new T8000IngestError("Each T8000 measurement must be an object", 400);
  }

  const value = entry.value ?? entry.latestValue ?? entry.latest_value;

  if (value === undefined) {
    throw new T8000IngestError("Each T8000 measurement must include a value", 400, {
      measurement: entry
    });
  }

  target.push({
    deviceId: entry.deviceId ?? entry.device?.id ?? context.deviceId ?? null,
    deviceExternalId:
      entry.deviceExternalId ??
      entry.externalDeviceId ??
      entry.external_device_id ??
      entry.dev_id ??
      entry.device?.externalDeviceId ??
      entry.device?.external_device_id ??
      context.deviceExternalId ??
      null,
    deviceName:
      entry.deviceName ??
      entry.device?.name ??
      context.deviceName ??
      null,
    pointId: entry.pointId ?? entry.point?.id ?? null,
    pointKey:
      entry.pointKey ??
      entry.point?.pointKey ??
      entry.point?.key ??
      entry.point_key ??
      (entry.param_id !== undefined ? String(entry.param_id) : null),
    pointName:
      entry.pointName ??
      entry.point?.name ??
      entry.point_name ??
      null,
    quality: entry.quality ?? context.quality ?? "good",
    timestamp: parseTimestamp(
      entry.timestamp ??
        entry.sourceTimestamp ??
        entry.source_timestamp ??
        entry.time ??
        context.timestamp
    ),
    value
  });
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new T8000IngestError("T8000 request body must be a JSON object", 400);
  }

  const defaultTimestamp =
    payload.timestamp ??
    payload.sourceTimestamp ??
    payload.source_timestamp ??
    payload.time;

  const measurements = [];
  const appendEntries = (entries, context = {}) => {
    if (!Array.isArray(entries)) {
      return;
    }

    for (const entry of entries) {
      pushMeasurement(measurements, entry, context);
    }
  };

  appendEntries(payload.measurements, { timestamp: defaultTimestamp });
  appendEntries(payload.values, { timestamp: defaultTimestamp });
  appendEntries(payload.points, {
    deviceId: payload.deviceId ?? payload.device?.id ?? null,
    deviceExternalId:
      payload.deviceExternalId ??
      payload.externalDeviceId ??
      payload.external_device_id ??
      payload.dev_id ??
      payload.device?.externalDeviceId ??
      payload.device?.external_device_id ??
      null,
    deviceName: payload.deviceName ?? payload.device?.name ?? null,
    timestamp: defaultTimestamp
  });

  if (Array.isArray(payload.devices)) {
    for (const device of payload.devices) {
      if (!device || typeof device !== "object" || Array.isArray(device)) {
        throw new T8000IngestError("Each T8000 device entry must be an object", 400);
      }

      const deviceContext = {
        deviceId: device.id ?? device.deviceId ?? null,
        deviceExternalId:
          device.externalDeviceId ??
          device.external_device_id ??
          device.dev_id ??
          null,
        deviceName: device.name ?? device.deviceName ?? null,
        timestamp:
          device.timestamp ??
          device.sourceTimestamp ??
          device.source_timestamp ??
          device.time ??
          defaultTimestamp
      };

      appendEntries(device.measurements, deviceContext);
      appendEntries(device.values, deviceContext);
      appendEntries(device.points, deviceContext);
      appendEntries(device.data, deviceContext);
    }
  }

  appendEntries(payload.data, {
    deviceId: payload.deviceId ?? payload.device?.id ?? null,
    deviceExternalId:
      payload.deviceExternalId ??
      payload.externalDeviceId ??
      payload.external_device_id ??
      payload.dev_id ??
      payload.device?.externalDeviceId ??
      payload.device?.external_device_id ??
      null,
    deviceName: payload.deviceName ?? payload.device?.name ?? null,
    timestamp: defaultTimestamp
  });

  if (
    measurements.length === 0 &&
    (payload.pointId !== undefined ||
      payload.pointKey !== undefined ||
      payload.point_key !== undefined ||
      payload.param_id !== undefined ||
      payload.pointName !== undefined ||
      payload.point_name !== undefined)
  ) {
    pushMeasurement(measurements, payload, {
      deviceId: payload.deviceId ?? payload.device?.id ?? null,
      deviceExternalId:
        payload.deviceExternalId ??
        payload.externalDeviceId ??
        payload.external_device_id ??
        payload.dev_id ??
        payload.device?.externalDeviceId ??
        payload.device?.external_device_id ??
        null,
      deviceName: payload.deviceName ?? payload.device?.name ?? null,
      timestamp: defaultTimestamp
    });
  }

  if (measurements.length === 0) {
    throw new T8000IngestError(
      "T8000 payload must include at least one measurement",
      400
    );
  }

  return {
    gatewayId: payload.gatewayId ?? payload.gateway?.id ?? null,
    gatewayName: payload.gatewayName ?? payload.gateway?.name ?? null,
    gatewaySn:
      payload.gatewaySn ??
      payload.gateway?.sn ??
      payload.sn ??
      payload.gateway_sn ??
      null,
    gatewayIp:
      payload.gatewayIp ??
      payload.gateway?.ipAddress ??
      payload.gateway?.ip_address ??
      null,
    measurements
  };
}

function buildMqttPayloadFromMessage(topic, messageBuffer) {
  let parsedMessage;

  try {
    parsedMessage = JSON.parse(messageBuffer.toString("utf8"));
  } catch (error) {
    throw new T8000IngestError("MQTT payload is not valid JSON", 400, {
      topic,
      error: error.message
    });
  }

  const topicParts = String(topic).split("/");
  const gatewaySn = topicParts.length >= 2 ? topicParts[1] : null;
  const mode = normalizeString(parsedMessage.mode || "");

  // setting replies use latest_data instead of data
  const dataArray =
    Array.isArray(parsedMessage.data) ? parsedMessage.data :
    Array.isArray(parsedMessage.latest_data) ? parsedMessage.latest_data :
    [];

  return {
    gatewaySn,
    mode,
    timestamp: parsedMessage.time,
    data: dataArray,
    raw: parsedMessage
  };
}

async function resolveGateway(connection, normalizedPayload) {
  if (normalizedPayload.gatewayId !== null && normalizedPayload.gatewayId !== undefined) {
    const [rows] = await connection.query(
      `
      SELECT id, name, ip_address, sn
      FROM gateway
      WHERE id = ? AND gateway_type = 'T8000'
      LIMIT 1
      `,
      [normalizedPayload.gatewayId]
    );

    if (rows.length === 0) {
      throw new T8000IngestError("T8000 gateway was not found", 404, {
        gatewayId: normalizedPayload.gatewayId
      });
    }

    return rows[0];
  }

  if (normalizedPayload.gatewayName) {
    const [rows] = await connection.query(
      `
      SELECT id, name, ip_address, sn
      FROM gateway
      WHERE name = ? AND gateway_type = 'T8000'
      LIMIT 2
      `,
      [normalizedPayload.gatewayName]
    );

    if (rows.length === 0) {
      throw new T8000IngestError("T8000 gateway was not found", 404, {
        gatewayName: normalizedPayload.gatewayName
      });
    }

    if (rows.length > 1) {
      throw new T8000IngestError("T8000 gateway name is not unique", 409, {
        gatewayName: normalizedPayload.gatewayName
      });
    }

    return rows[0];
  }

  if (normalizedPayload.gatewaySn) {
    const [rows] = await connection.query(
      `
      SELECT id, name, ip_address, sn
      FROM gateway
      WHERE sn = ? AND gateway_type = 'T8000'
      LIMIT 2
      `,
      [normalizedPayload.gatewaySn]
    );

    if (rows.length === 0) {
      throw new T8000IngestError("T8000 gateway was not found", 404, {
        gatewaySn: normalizedPayload.gatewaySn
      });
    }

    if (rows.length > 1) {
      throw new T8000IngestError("T8000 gateway serial number is not unique", 409, {
        gatewaySn: normalizedPayload.gatewaySn
      });
    }

    return rows[0];
  }

  if (normalizedPayload.gatewayIp) {
    const [rows] = await connection.query(
      `
      SELECT id, name, ip_address, sn
      FROM gateway
      WHERE ip_address = ? AND gateway_type = 'T8000'
      LIMIT 2
      `,
      [normalizedPayload.gatewayIp]
    );

    if (rows.length === 0) {
      throw new T8000IngestError("T8000 gateway was not found", 404, {
        gatewayIp: normalizedPayload.gatewayIp
      });
    }

    if (rows.length > 1) {
      throw new T8000IngestError("T8000 gateway IP is not unique", 409, {
        gatewayIp: normalizedPayload.gatewayIp
      });
    }

    return rows[0];
  }

  const [rows] = await connection.query(
    `
    SELECT id, name, ip_address, sn
    FROM gateway
    WHERE gateway_type = 'T8000'
    ORDER BY id ASC
    LIMIT 2
    `
  );

  if (rows.length === 0) {
    throw new T8000IngestError("No T8000 gateway is configured", 404);
  }

  if (rows.length > 1) {
    throw new T8000IngestError(
      "Multiple T8000 gateways are configured, so the payload must identify one gateway",
      400
    );
  }

  return rows[0];
}

async function loadGatewayDevices(connection, gatewayId) {
  const [devices] = await connection.query(
    `
    SELECT id, gateway_id, external_device_id, name
    FROM device
    WHERE gateway_id = ?
    `,
    [gatewayId]
  );

  if (devices.length === 0) {
    throw new T8000IngestError("No devices are configured for the T8000 gateway", 422, {
      gatewayId
    });
  }

  return devices;
}

async function loadGatewayPoints(connection, devices) {
  const deviceIds = devices.map((device) => device.id);
  const placeholders = deviceIds.map(() => "?").join(", ");

  const [points] = await connection.query(
    `
    SELECT id, device_id, param_id, point_name, point_type
    FROM point
    WHERE device_id IN (${placeholders})
    `,
    deviceIds
  );

  return points;
}

function resolveDeviceReference(
  measurement,
  deviceById,
  deviceByExternalId,
  deviceByName,
  defaultDevice
) {
  if (measurement.deviceId !== null && measurement.deviceId !== undefined) {
    return deviceById.get(String(measurement.deviceId)) ?? null;
  }

  if (
    measurement.deviceExternalId !== null &&
    measurement.deviceExternalId !== undefined
  ) {
    const device = deviceByExternalId.get(String(measurement.deviceExternalId)) ?? null;

    if (device) {
      return device;
    }
  }

  if (measurement.deviceName) {
    const device = deviceByName.get(normalizeString(measurement.deviceName)) ?? null;

    if (device) {
      return device;
    }
  }

  return defaultDevice ?? null;
}

function resolvePointReference(
  measurement,
  deviceId,
  pointById,
  pointByKey,
  pointByName,
  defaultPointByDevice
) {
  if (measurement.pointId !== null && measurement.pointId !== undefined) {
    const point = pointById.get(String(measurement.pointId)) ?? null;

    if (point && point.device_id === deviceId) {
      return point;
    }

    return null;
  }

  if (measurement.pointKey) {
    const normalizedPointKey = normalizeString(measurement.pointKey);
    const point =
      pointByKey.get(`${deviceId}:${normalizedPointKey}`) ??
      pointByKey.get(`${deviceId}:param_${normalizedPointKey}`) ??
      pointByKey.get(`${deviceId}:param:${normalizedPointKey}`) ??
      null;

    if (point) {
      return point;
    }
  }

  if (measurement.pointName) {
    const point =
      pointByName.get(`${deviceId}:${normalizeString(measurement.pointName)}`) ?? null;

    if (point) {
      return point;
    }
  }

  return defaultPointByDevice.get(deviceId) ?? null;
}

function buildPointUpdateStatement(pointUpdates) {
  const ids = Array.from(pointUpdates.keys());
  const valueParams = [];
  const timestampParams = [];
  let latestValueCase = "CASE id";
  let latestTimestampCase = "CASE id";

  for (const pointId of ids) {
    const update = pointUpdates.get(pointId);

    latestValueCase += " WHEN ? THEN ?";
    valueParams.push(pointId, update.latestValue);

    latestTimestampCase += " WHEN ? THEN ?";
    timestampParams.push(pointId, update.latestTimestamp);
  }

  latestValueCase += " ELSE latest_value END";
  latestTimestampCase += " ELSE latest_timestamp END";

  const placeholders = ids.map(() => "?").join(", ");

  return {
    sql: `
      UPDATE point
      SET
        latest_value = ${latestValueCase},
        latest_timestamp = ${latestTimestampCase}
      WHERE id IN (${placeholders})
    `,
    params: [...valueParams, ...timestampParams, ...ids]
  };
}

async function updateGatewayConnectionState({
  sn = null,
  mqttStatus = null,
  status = null,
  lastSeen = null,
  connectedAt = null,
  disconnectedAt = null
}) {
  const setClauses = [];
  const params = [];

  if (mqttStatus !== null) {
    setClauses.push("mqtt_status = ?");
    params.push(mqttStatus);
  }

  if (status !== null) {
    setClauses.push("status = ?");
    params.push(status);
  }

  if (lastSeen !== null) {
    setClauses.push("last_seen = ?");
    params.push(lastSeen);
  }

  if (connectedAt !== null) {
    setClauses.push("last_mqtt_connected_at = ?");
    params.push(connectedAt);
  }

  if (disconnectedAt !== null) {
    setClauses.push("last_mqtt_disconnected_at = ?");
    params.push(disconnectedAt);
  }

  if (setClauses.length === 0) {
    return;
  }

  let sql = `UPDATE gateway SET ${setClauses.join(", ")} WHERE gateway_type = 'T8000'`;

  if (sn) {
    sql += " AND sn = ?";
    params.push(sn);
  }

  try {
    await db.query(sql, params);
  } catch (error) {
    console.error("Failed to update T8000 gateway connection state:", error);
  }
}

async function ingestT8000Event(mqttPayload) {
  const { gatewaySn, mode, timestamp, data, raw } = mqttPayload;

  if (!gatewaySn) {
    console.warn("T8000 event ignored: no gateway SN in topic");
    return;
  }

  const [gatewayRows] = await db.query(
    `SELECT id FROM gateway WHERE sn = ? AND gateway_type = 'T8000' LIMIT 1`,
    [gatewaySn]
  );

  if (gatewayRows.length === 0) {
    console.warn(`T8000 event ignored: gateway SN ${gatewaySn} not found`);
    return;
  }

  const gatewayId = gatewayRows[0].id;
  const sourceTimestamp = timestamp ? parseTimestamp(timestamp) : new Date();

  const tsIso = sourceTimestamp.toISOString();

  if (data.length === 0) {
    await db.query(
      `INSERT INTO event (gateway_id, device_id, external_device_id, event_mode, event_data, source_timestamp)
       VALUES (?, NULL, NULL, ?, ?, ?)`,
      [gatewayId, mode, JSON.stringify(raw), sourceTimestamp]
    );
    writeLogEntry(mode, { timestamp: tsIso, gatewaySn, gatewayId, mode, data: raw });
    return;
  }

  const rows = data.map((item) => [
    gatewayId,
    null,
    item.dev_id != null ? String(item.dev_id) : null,
    mode,
    JSON.stringify(item),
    sourceTimestamp
  ]);

  const placeholders = rows.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
  await db.query(
    `INSERT INTO event (gateway_id, device_id, external_device_id, event_mode, event_data, source_timestamp)
     VALUES ${placeholders}`,
    rows.flat()
  );

  // Write each event item to its daily log file
  data.forEach((item) => {
    writeLogEntry(mode, {
      timestamp: tsIso,
      gatewaySn,
      gatewayId,
      mode,
      devId: item.dev_id != null ? String(item.dev_id) : null,
      data: item,
    });
  });

  await updateGatewayConnectionState({
    sn: gatewaySn,
    mqttStatus: MQTT_STATUS_CONNECTED,
    status: "online",
    lastSeen: new Date()
  });
}

async function ingestT8000Payload(payload, receivedAt = new Date(), options = {}) {
  const { updateLatestValue = true } = options;
  const normalizedPayload = normalizePayload(payload);

  const result = await db.withTransaction(async (connection) => {
    const gateway = await resolveGateway(connection, normalizedPayload);

    let devices;
    try {
      devices = await loadGatewayDevices(connection, gateway.id);
    } catch (error) {
      if (error instanceof T8000IngestError && error.statusCode === 422) {
        devices = [];
      } else {
        throw error;
      }
    }

    const points = devices.length > 0
      ? await loadGatewayPoints(connection, devices)
      : [];

    const deviceById = new Map(devices.map((device) => [String(device.id), device]));
    const deviceByExternalId = new Map(
      devices
        .filter((device) => device.external_device_id !== null)
        .map((device) => [String(device.external_device_id), device])
    );
    const deviceByName = new Map(
      devices.map((device) => [normalizeString(device.name), device])
    );
    const pointById = new Map(points.map((point) => [String(point.id), point]));
    const pointByKey = new Map(
      points
        .filter((point) => point.param_id)
        .map((point) => [
          `${point.device_id}:${normalizeString(point.param_id)}`,
          point
        ])
    );
    const pointByName = new Map(
      points.map((point) => [
        `${point.device_id}:${normalizeString(point.point_name)}`,
        point
      ])
    );

    const measurementRows = [];
    const pointUpdates = new Map();
    const touchedDeviceIds = new Set();
    let autoCreatedDevices = 0;
    let autoCreatedPoints = 0;

    for (const measurement of normalizedPayload.measurements) {
      // --- Auto-resolve or auto-create device ---
      let device = resolveDeviceReference(
        measurement,
        deviceById,
        deviceByExternalId,
        deviceByName,
        null
      );

      if (!device) {
        const extId = measurement.deviceExternalId
          ?? measurement.deviceName
          ?? null;

        if (extId === null) {
          continue;
        }

        const deviceName = measurement.deviceName || `Device ${extId}`;
        const [insertResult] = await connection.query(
          `INSERT INTO device (gateway_id, external_device_id, name, device_type, status, created_at, updated_at)
           VALUES (?, ?, ?, 'sensor', 'unknown', NOW(), NOW())`,
          [gateway.id, String(extId), deviceName]
        );

        device = {
          id: insertResult.insertId,
          gateway_id: gateway.id,
          external_device_id: String(extId),
          name: deviceName
        };

        deviceById.set(String(device.id), device);
        deviceByExternalId.set(String(extId), device);
        deviceByName.set(normalizeString(deviceName), device);
        devices.push(device);
        autoCreatedDevices++;

        console.log(
          `Auto-created device: gateway=${gateway.name}, extId=${extId}, name=${deviceName}`
        );
      }

      // --- Auto-resolve or auto-create point ---
      let point = resolvePointReference(
        measurement,
        device.id,
        pointById,
        pointByKey,
        pointByName,
        new Map()
      );

      if (!point) {
        const pointKey = measurement.pointKey
          ?? measurement.pointName
          ?? null;

        if (pointKey === null) {
          continue;
        }

        const pointName = measurement.pointName || `Point ${pointKey}`;
        const guessedType = typeof measurement.value === "number" ? "number" : "text";

        const [insertResult] = await connection.query(
          `INSERT INTO point (gateway_id, device_id, param_id, point_name, point_type)
           VALUES (?, ?, ?, ?, ?)`,
          [gateway.id, device.id, String(pointKey), pointName, guessedType]
        );

        point = {
          id: insertResult.insertId,
          gateway_id: gateway.id,
          device_id: device.id,
          param_id: String(pointKey),
          point_name: pointName,
          point_type: guessedType
        };

        pointById.set(String(point.id), point);
        pointByKey.set(`${device.id}:${normalizeString(point.param_id)}`, point);
        pointByName.set(`${device.id}:${normalizeString(pointName)}`, point);
        autoCreatedPoints++;

        console.log(
          `Auto-created point: device=${device.name}, key=${pointKey}, type=${guessedType}`
        );
      }

      const normalizedValue = normalizePointValue(point, measurement.value);

      measurementRows.push([
        point.id,
        normalizedValue.valueDouble,
        normalizedValue.valueText,
        measurement.quality,
        measurement.timestamp
      ]);

      touchedDeviceIds.add(device.id);

      console.log(`[INGEST] point=${point.id} param_id=${measurement.paramId} value=${normalizedValue.latestValue} deviceTs=${measurement.timestamp} serverTs=${receivedAt.toISOString()}`);

      if (updateLatestValue) {
        pointUpdates.set(point.id, {
          latestValue: normalizedValue.latestValue,
          latestTimestamp: receivedAt  // use server receive time, not device timestamp
        });
      }
    }

    if (measurementRows.length === 0) {
      throw new T8000IngestError("No valid T8000 measurements were provided", 422);
    }

    const valuePlaceholders = measurementRows.map(() => "(?, ?, ?, ?, ?)").join(", ");
    await connection.query(
      `
      INSERT INTO measurement
        (point_id, value_double, value_text, quality, source_timestamp)
      VALUES ${valuePlaceholders}
      `,
      measurementRows.flat()
    );

    if (pointUpdates.size > 0) {
      const pointUpdateStatement = buildPointUpdateStatement(pointUpdates);
      await connection.query(pointUpdateStatement.sql, pointUpdateStatement.params);
    }

    const latestGatewayTimestamp = measurementRows.reduce((latest, row) => {
      if (!latest || row[4] > latest) {
        return row[4];
      }

      return latest;
    }, null);

    await connection.query(
      `
      UPDATE gateway
      SET
        status = 'online',
        mqtt_status = 'connected',
        last_seen = ?,
        last_mqtt_connected_at = COALESCE(last_mqtt_connected_at, ?)
      WHERE id = ?
      `,
      [receivedAt, new Date(), gateway.id]
    );

    // Update last_seen for all devices that received real-time data.
    // Do NOT touch status here — online/offline is solely determined by
    // nwk_status in latest_health via syncDeviceHealthFromGateway.
    if (touchedDeviceIds.size > 0) {
      const deviceIdArray = [...touchedDeviceIds];
      const placeholders = deviceIdArray.map(() => "?").join(", ");
      if (updateLatestValue) {
        await connection.query(
          `UPDATE device SET last_seen = ?, updated_at = NOW()
           WHERE id IN (${placeholders})`,
          [receivedAt, ...deviceIdArray]
        );
      } else {
        // scheduled: record history only, never touch live status / last_seen
        await connection.query(
          `UPDATE device SET updated_at = NOW()
           WHERE id IN (${placeholders})`,
          [...deviceIdArray]
        );
      }
    }

    return {
      gateway: {
        id: gateway.id,
        name: gateway.name,
        ipAddress: gateway.ip_address,
        serialNumber: gateway.sn
      },
      insertedMeasurements: measurementRows.length,
      updatedPoints: pointUpdates.size,
      autoCreatedDevices,
      autoCreatedPoints
    };
  });

  // Notify SSE listeners that data changed (fires after transaction commits)
  if (result.insertedMeasurements > 0) {
    dataEvents.emit("measurements:updated", { gatewayId: result.gateway.id });
  }

  return result;
}

async function publishReadSettingToAllGateways(client) {
  try {
    const [rows] = await db.query(
      `SELECT sn FROM gateway WHERE gateway_type = 'T8000' AND sn IS NOT NULL AND sn <> ''`
    );

    if (rows.length === 0) {
      console.log("[read_setting] No registered T8000 gateways to query.");
      return;
    }

    // Refresh the in-memory SN whitelist so unregistered gateways are ignored
    registeredGatewaySns = new Set(rows.map((r) => r.sn).filter(Boolean));

    const payload = JSON.stringify({
      time: Math.floor(Date.now() / 1000),
      mode: "read_setting",
      msg_type: "CON",
      msg_id: 1,
      pkt: "1/1",
      latest_data: []
    });

    for (const { sn } of rows) {
      const topic = `moe/${sn}/MReq`;
      await new Promise((resolve, reject) => {
        client.publish(topic, payload, { qos: 1 }, (err) => {
          if (err) {
            console.error(`[read_setting] Failed to publish to ${topic}:`, err.message);
            reject(err);
          } else {
            console.log(`[read_setting] Sent to ${topic}`);
            pushSystemLog("info", `read_setting sent to gateway ${sn}`);
            resolve();
          }
        });
      }).catch(() => { /* log already emitted, continue with next gateway */ });
    }
  } catch (err) {
    console.error("[read_setting] Failed to query gateways:", err.message);
    pushSystemLog("error", `read_setting broadcast failed: ${err.message}`);
  }
}

async function publishReadDeviceSettingToAllGateways(client) {
  try {
    const [rows] = await db.query(
      `SELECT sn FROM gateway WHERE gateway_type = 'T8000' AND sn IS NOT NULL AND sn <> ''`
    );

    if (rows.length === 0) return;

    const payload = JSON.stringify({
      time: Math.floor(Date.now() / 1000),
      mode: "read_setting",
      msg_type: "CON",
      msg_id: 1,
      pkt: "1/1",
      device: []
    });

    for (const { sn } of rows) {
      const topic = `moe/${sn}/MReq`;
      await new Promise((resolve, reject) => {
        client.publish(topic, payload, { qos: 1 }, (err) => {
          if (err) {
            console.error(`[read_device_setting] Failed to publish to ${topic}:`, err.message);
            reject(err);
          } else {
            console.log(`[read_device_setting] Sent to ${topic}`);
            pushSystemLog("info", `read_device_setting sent to gateway ${sn}`);
            resolve();
          }
        });
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[read_device_setting] Failed to query gateways:", err.message);
    pushSystemLog("error", `read_device_setting broadcast failed: ${err.message}`);
  }
}

/**
 * Sync device online/offline status from the T8000 gateway's latest_health list.
 * Called every time a mode=setting response arrives (every ~5 min from read_setting).
 * latest_health[].dev_id maps to device.external_device_id
 * latest_health[].nwk_status: 1=online, 0=offline
 * latest_health[].last_heard: Unix timestamp of last device communication
 */
async function syncDeviceHealthFromGateway(gatewayId, latestHealth) {
  if (!Array.isArray(latestHealth) || latestHealth.length === 0) return;

  let updated = 0;
  for (const entry of latestHealth) {
    const externalId = entry.dev_id != null ? String(entry.dev_id) : null;
    if (!externalId) continue;

    const isOnline = entry.nwk_status === 1;
    const lastHeard = entry.last_heard ? new Date(entry.last_heard * 1000) : null;

    if (isOnline && lastHeard) {
      const [r] = await db.query(
        `UPDATE device
            SET status    = 'online',
                last_seen = ?,
                updated_at = NOW()
          WHERE gateway_id        = ?
            AND external_device_id = ?`,
        [lastHeard, gatewayId, externalId]
      );
      if (r.affectedRows > 0) updated++;
    } else {
      const [r] = await db.query(
        `UPDATE device
            SET status    = 'offline',
                updated_at = NOW()
          WHERE gateway_id        = ?
            AND external_device_id = ?`,
        [gatewayId, externalId]
      );
      if (r.affectedRows > 0) updated++;
    }
  }

  console.log(`[health_sync] gateway=${gatewayId}: synced ${updated}/${latestHealth.length} devices`);
}

async function syncDeviceInfoFromGateway(gatewayId, deviceArray) {
  if (!Array.isArray(deviceArray) || deviceArray.length === 0) return;

  let updated = 0;
  for (const item of deviceArray) {
    if (item.id == null) continue;

    const externalId = String(item.id);
    const newName = item.device_id != null ? String(item.device_id) : null;
    const newModel = item.model_id != null ? String(item.model_id) : null;
    const newModbusAddress = item.pri_addr != null ? item.pri_addr : null;

    const [result] = await db.query(
      `UPDATE device
          SET name           = COALESCE(?, name),
              model          = COALESCE(?, model),
              modbus_address = ?,
              updated_at     = NOW()
        WHERE gateway_id          = ?
          AND external_device_id  = ?`,
      [newName, newModel, newModbusAddress, gatewayId, externalId]
    );

    if (result.affectedRows > 0) updated++;
  }

  console.log(`[sync_device] gateway=${gatewayId}: updated ${updated}/${deviceArray.length} devices`);
  pushSystemLog("info", `Device info synced for gateway ${gatewayId}: ${updated} updated`);
}

function createMqttOptions() {
  return {
    protocol:
      normalizeString(process.env.MQTT_SSL) === "true" ||
      normalizeString(process.env.MQTT_PROTOCOL) === "mqtts"
        ? "mqtts"
        : "mqtt",
    host: process.env.MQTT_HOST,
    port: Number.parseInt(process.env.MQTT_PORT || "1883", 10),
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId: process.env.MQTT_CLIENT_ID || DEFAULT_MQTT_CLIENT_ID,
    clean: true,
    connectTimeout: Number.parseInt(
      process.env.MQTT_CONNECT_TIMEOUT_MS || "10000",
      10
    ),
    reconnectPeriod: Number.parseInt(
      process.env.MQTT_RECONNECT_PERIOD_MS || "5000",
      10
    )
  };
}

function isMqttEnabled() {
  return normalizeString(process.env.T8000_MQTT_ENABLED || "true") !== "false";
}

function startT8000MqttListener() {
  if (mqttListenerStarted || !isMqttEnabled()) {
    return mqttClient;
  }

  if (!process.env.MQTT_HOST) {
    throw new Error("Missing required environment variable: MQTT_HOST");
  }

  mqttListenerStarted = true;

  const topic = process.env.MQTT_TOPIC || DEFAULT_MQTT_TOPIC;
  const qos = Number.parseInt(process.env.MQTT_QOS || "0", 10);
  const mqttOptions = createMqttOptions();

  mqttClient = mqtt.connect(mqttOptions);

  updateGatewayConnectionState({
    mqttStatus: MQTT_STATUS_CONNECTING
  });

  mqttClient.on("connect", async () => {
    console.log(`Connected to MQTT broker ${mqttOptions.host}:${mqttOptions.port}`);
    pushSystemLog("info", `Connected to MQTT broker ${mqttOptions.host}:${mqttOptions.port}`);

    try {
      const lastwillTopic = 'moe/+/lastwill';
      await new Promise((resolve, reject) => {
        mqttClient.subscribe([topic, lastwillTopic], { qos }, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      console.log(`Subscribed to MQTT topics: ${topic}, ${lastwillTopic}`);
      pushSystemLog("info", `Subscribed to MQTT topics: ${topic}, ${lastwillTopic}`);
      await updateGatewayConnectionState({
        mqttStatus: MQTT_STATUS_CONNECTED,
        connectedAt: new Date()
      });
      await publishReadSettingToAllGateways(mqttClient);
      await publishReadDeviceSettingToAllGateways(mqttClient);
    } catch (error) {
      console.error("Failed to subscribe to T8000 MQTT topic:", error);
      pushSystemLog("error", `Failed to subscribe to MQTT topic: ${error.message}`);
    }
  });

  mqttClient.on("reconnect", () => {
    console.log("Reconnecting to MQTT broker...");
    pushSystemLog("warning", "Reconnecting to MQTT broker...");
    updateGatewayConnectionState({
      mqttStatus: MQTT_STATUS_CONNECTING
    });
  });

  mqttClient.on("close", () => {
    console.warn("MQTT connection closed");
    pushSystemLog("warning", "MQTT connection closed");
    updateGatewayConnectionState({
      mqttStatus: MQTT_STATUS_DISCONNECTED,
      disconnectedAt: new Date()
    });
  });

  mqttClient.on("offline", () => {
    console.warn("MQTT client is offline");
    pushSystemLog("warning", "MQTT client is offline");
    updateGatewayConnectionState({
      mqttStatus: MQTT_STATUS_DISCONNECTED,
      disconnectedAt: new Date()
    });
  });

  mqttClient.on("error", (error) => {
    console.error("MQTT client error:", error);
    pushSystemLog("error", `MQTT client error: ${error.message}`);
  });

  mqttClient.on("message", async (topicName, messageBuffer) => {
    const receivedAt = new Date();
    const receivedTs = Math.floor(receivedAt.getTime() / 1000);

    // ── Lastwill: gateway went offline ───────────────────────
    const lastwillMatch = topicName.match(/^moe\/([^/]+)\/lastwill$/i);
    if (lastwillMatch) {
      const gatewaySn = lastwillMatch[1];
      await updateGatewayConnectionState({ sn: gatewaySn, status: 'offline' });
      pushSystemLog('warning', `Gateway ${gatewaySn} went offline (lastwill received)`);
      dataEvents.emit('measurements:updated', { gatewaySn });
      console.log(`[MQTT] lastwill received — gateway ${gatewaySn} marked offline`);
      return;
    }

    try {
      const mqttPayload = buildMqttPayloadFromMessage(topicName, messageBuffer);
      const mode = mqttPayload.mode;

      console.log(`[MQTT] topic=${topicName} mode="${mode}" rawMode="${mqttPayload.raw?.mode}" items=${mqttPayload.data.length}`);

      // Silently discard messages from gateways not registered in the system.
      // The cache is populated on connect; if empty (first boot race) we allow through.
      if (mqttPayload.gatewaySn && registeredGatewaySns.size > 0 && !registeredGatewaySns.has(mqttPayload.gatewaySn)) {
        return;
      }

      // Record every incoming message in the MQTT ring buffer
      // For change/scheduled messages, also capture a trimmed snapshot of the
      // device values so the Log Detail drawer can display them without an
      // extra round-trip to the DB.
      const logItems = (mode === 'change' || mode === 'scheduled' || mode === 'read_health')
        ? mqttPayload.data.slice(0, 30).map((item) => ({
            devId:   item.dev_id   ?? item.deviceId   ?? null,
            paramId: item.param_id ?? item.paramId     ?? null,
            value:   item.value    ?? item.latest_value ?? null,
          }))
        : [];
      pushMqttLog({
        timestamp: receivedTs,
        topic: topicName,
        gatewaySn: mqttPayload.gatewaySn ?? "",
        mode: mode || "unknown",
        itemCount: mqttPayload.data.length,
        status: "ok",
        error: null,
        items: logItems,
      });

      if (EVENT_MODES.has(mode)) {
        await ingestT8000Event(mqttPayload);

        if (mode === "setting") {
          const raw = mqttPayload.raw;

          // latest_data present → also ingest as measurements
          if (mqttPayload.data.length > 0) {
            await ingestT8000Payload(mqttPayload, receivedAt, { updateLatestValue: true });
          }

          // Fetch gateway DB id once for both syncs below
          const hasDeviceInfo = Array.isArray(raw?.device) && raw.device.length > 0;
          const hasHealth     = Array.isArray(raw?.latest_health) && raw.latest_health.length > 0;

          if (hasDeviceInfo || hasHealth) {
            const [gwRows] = await db.query(
              `SELECT id FROM gateway WHERE sn = ? AND gateway_type = 'T8000' LIMIT 1`,
              [mqttPayload.gatewaySn]
            );
            if (gwRows.length > 0) {
              const gwId = gwRows[0].id;

              // Sync name / model / modbus_address from device array
              if (hasDeviceInfo) {
                await syncDeviceInfoFromGateway(gwId, raw.device);
              }

              // Sync online/offline status from latest_health (primary source of truth)
              if (hasHealth) {
                await syncDeviceHealthFromGateway(gwId, raw.latest_health);
                // Notify SSE so the frontend refreshes device cards
                dataEvents.emit("measurements:updated", { gatewayId: gwId });
              }
            }
          }
        }

        console.log(
          `T8000 MQTT event stored: sn=${mqttPayload.gatewaySn}, mode=${mode}, items=${mqttPayload.data.length}`
        );
      } else if (MEASUREMENT_MODES.has(mode) || mode === "") {
        // Only update point.latest_value for confirmed-current modes.
        // - change / read / setting: device-confirmed values → update latest
        // - scheduled: may carry stale unacknowledged data → history only
        const result = await ingestT8000Payload(
          mqttPayload,
          receivedAt,
          { updateLatestValue: mode !== "scheduled" }
        );

        await updateGatewayConnectionState({
          sn: result.gateway.serialNumber,
          mqttStatus: MQTT_STATUS_CONNECTED,
          status: "online",
          lastSeen: new Date()
        });

        console.log(
          `T8000 MQTT payload processed: gateway=${result.gateway.serialNumber}, mode=${mode || "unknown"}, inserted=${result.insertedMeasurements}`
        );
      } else {
        console.log(
          `T8000 MQTT unknown mode ignored: sn=${mqttPayload.gatewaySn}, mode=${mode}`
        );
      }
    } catch (error) {
      // Silently discard messages from unregistered gateways —
      // a 404 "not found" means the gateway hasn't been added to the system,
      // so there is nothing to log or alert about.
      if (error instanceof T8000IngestError && error.statusCode === 404) {
        if (mqttLogBuffer.length > 0 && mqttLogBuffer[0].timestamp === receivedTs) {
          mqttLogBuffer.shift();
        }
        return;
      }

      // Mark the last MQTT log entry as failed (it was just pushed)
      if (mqttLogBuffer.length > 0 && mqttLogBuffer[0].timestamp === receivedTs) {
        mqttLogBuffer[0].status = "error";
        mqttLogBuffer[0].error = error.message;
      }

      if (error instanceof T8000IngestError) {
        console.error("T8000 MQTT payload rejected:", {
          topic: topicName,
          message: error.message,
          details: error.details
        });
        pushSystemLog("error", `MQTT payload rejected [${topicName}]: ${error.message}`);
        return;
      }

      console.error("Unexpected MQTT processing error:", error);
      pushSystemLog("error", `Unexpected MQTT error [${topicName}]: ${error.message}`);
    }
  });

  return mqttClient;
}

module.exports = {
  T8000IngestError,
  buildMqttPayloadFromMessage,
  ingestT8000Payload,
  ingestT8000Event,
  startT8000MqttListener,
  getMqttLogs,
  getSystemLogs,
  pushSystemLog,
};
