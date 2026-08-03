const express = require("express");
const {
  getEventLogs,
  getMqttLogsHandler,
  getSystemLogsHandler,
  getLogStats,
  listLogFilesHandler,
  downloadLogFileHandler,
  deleteLogFileHandler,
  purgeLogFilesHandler,
} = require("../controllers/logController");

const router = express.Router();

// GET  /api/logs/events              — alarm, error, health, rule, status events from event table
router.get("/events", getEventLogs);

// GET  /api/logs/mqtt                — recent raw MQTT messages (in-memory ring buffer)
router.get("/mqtt", getMqttLogsHandler);

// GET  /api/logs/system              — backend system messages (in-memory ring buffer)
router.get("/system", getSystemLogsHandler);

// GET  /api/logs/stats               — usage counts for KPI cards
router.get("/stats", getLogStats);

// GET  /api/logs/files               — list available daily log files
router.get("/files", listLogFilesHandler);

// GET  /api/logs/files/:filename     — download a specific daily log file
router.get("/files/:filename", downloadLogFileHandler);

// DELETE /api/logs/files/:filename   — delete a specific daily log file
router.delete("/files/:filename", deleteLogFileHandler);

// POST /api/logs/purge               — manually trigger retention purge { days?: number }
router.post("/purge", purgeLogFilesHandler);

module.exports = router;
