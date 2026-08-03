const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config();

// ── Timestamp-prefixed console output ─────────────────────
function tsNow() {
  return new Date().toLocaleString("sv-SE").replace("T", " "); // YYYY-MM-DD HH:mm:ss
}
["log", "info", "warn", "error"].forEach((method) => {
  const original = console[method].bind(console);
  console[method] = (...args) => original(`[${tsNow()}]`, ...args);
});

const gatewayRoutes = require("./routes/gatewayRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const pointRoutes = require("./routes/pointRoutes");
const measurementRoutes = require("./routes/measurementRoutes");
const t8000Routes = require("./routes/t8000Routes");
const t8000ParameterRoutes = require("./routes/t8000ParameterRoutes");
const t8000ModelRoutes = require("./routes/t8000ModelRoutes");
const siteRoutes = require("./routes/siteRoutes");
const logRoutes = require("./routes/logRoutes");
const { getSiteEnergySummary } = require("./controllers/energySummaryController");
const { startT8000MqttListener, pushSystemLog } = require("./adapters/t8000Adapter");
const dataEvents = require("./utils/dataEvents");
const { router: gatewayConfigRouter, setMqttClient: setConfigMqttClient } = require("./routes/gatewayConfig");
const { scheduleDailyPurge, DEFAULT_RETENTION_DAYS } = require("./utils/logFileWriter");
const authRoutes = require("./routes/authRoutes");const userRoutes = require('./routes/userRoutes');const { authenticate } = require("./middleware/authenticate");
const db = require("./db");

async function runMigrations() {
  try {
    // Add modbus_address column if it doesn't exist yet
    await db.query(`
      ALTER TABLE device
      ADD COLUMN IF NOT EXISTS modbus_address INT NULL DEFAULT NULL
        COMMENT 'Primary Modbus address (pri_addr from T8000)'
    `);

    // Add enabled flag for devices (1 = enabled, 0 = disabled)
    await db.query(`
      ALTER TABLE device
      ADD COLUMN IF NOT EXISTS enabled TINYINT(1) NOT NULL DEFAULT 1
        COMMENT 'Whether device is enabled for monitoring'
    `);

    // Extend user_account with auth fields
    await db.query(`
      ALTER TABLE user_account
        ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) NULL AFTER username,
        ADD COLUMN IF NOT EXISTS last_login   TIMESTAMP  NULL,
        ADD COLUMN IF NOT EXISTS created_by   INT        NULL
    `);

    // Migrate legacy role values before modifying ENUM
    await db.query(`UPDATE user_account SET role = 'operator' WHERE role = 'engineer'`);

    // Expand role ENUM to 4 tiers
    await db.query(`
      ALTER TABLE user_account
        MODIFY COLUMN role ENUM('admin','site_admin','operator','viewer') NOT NULL DEFAULT 'viewer'
    `);

    // Site-level access control for non-admin users
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_site_access (
        user_id INT NOT NULL,
        site_id INT NOT NULL,
        PRIMARY KEY (user_id, site_id),
        FOREIGN KEY (user_id) REFERENCES user_account(id) ON DELETE CASCADE,
        FOREIGN KEY (site_id) REFERENCES site(id)         ON DELETE CASCADE
      )
    `);

    // Device groups (persisted per gateway, owned by frontend users)
    await db.query(`
      CREATE TABLE IF NOT EXISTS device_group (
        id         VARCHAR(64)  NOT NULL,
        gateway_id INT          NOT NULL,
        name       VARCHAR(100) NOT NULL,
        color      VARCHAR(20)  NOT NULL DEFAULT '#003A70',
        device_ids JSON         NOT NULL,
        collapsed  TINYINT(1)   NOT NULL DEFAULT 0,
        sort_order INT          NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        FOREIGN KEY (gateway_id) REFERENCES gateway(id) ON DELETE CASCADE
      )
    `);

    console.log("DB migrations OK");
  } catch (err) {
    console.error("DB migration error:", err.message);
  }
}

const app = express();
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "1mb";

// Allow credentials (cookies) from the frontend origin
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3001").split(",").map((o) => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin requests (no Origin header) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: jsonBodyLimit }));

app.get("/", (req, res) => {
  res.send("TMAS Common Backend Running");
});

// ── Auth (public) ─────────────────────────────────────────
app.use("/auth", authRoutes);

// ── All API routes require authentication ─────────────────
app.use("/api", authenticate);

app.use("/api/users", userRoutes);
app.use("/api/gateways", gatewayRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/points", pointRoutes);
app.use("/api/measurements", measurementRoutes);
app.use("/api/t8000", t8000Routes);
app.use("/api/t8000-parameters", t8000ParameterRoutes);
app.use("/api/t8000-models", t8000ModelRoutes);
app.use("/api/sites", siteRoutes);
app.get("/api/sites/:site_id/energy-summary", getSiteEnergySummary);
app.use("/api/logs", logRoutes);
app.use("/api/gateway", gatewayConfigRouter);

// ── SSE: push data-change notifications to connected frontends ──
// Clients subscribe to GET /api/events/stream and receive a 'data: update\n\n'
// event whenever new measurements are ingested — no polling needed.
app.get("/api/events/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering in prod
  res.flushHeaders();

  // Send a heartbeat comment every 25 s to keep the connection alive
  // through proxies that close idle connections.
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25_000);

  const send = () => res.write("data: update\n\n");
  dataEvents.on("measurements:updated", send);

  req.on("close", () => {
    clearInterval(heartbeat);
    dataEvents.off("measurements:updated", send);
  });
});

// ── Serve frontend build (production) ────────────────────
const frontendPath = path.join(__dirname, "public");
app.use(express.static(frontendPath));
app.get("/{*path}", (req, res, next) => {
  // Let API 404s fall through to the error handler
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "Invalid JSON body" });
  }

  console.error("Unhandled application error:", error);
  return res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`TMAS backend running on port ${PORT}`);
  pushSystemLog("info", `TMAS backend started on port ${PORT}`);
  await runMigrations();
  const mqttClient = startT8000MqttListener();
  if (mqttClient) setConfigMqttClient(mqttClient);
  scheduleDailyPurge();
  console.log(`Log file retention: ${DEFAULT_RETENTION_DAYS} days (set LOG_RETENTION_DAYS to override)`);
});
