/**
 * logFileWriter.js
 *
 * Writes log entries to daily rotating NDJSON files.
 * Each log type gets its own file per day:
 *   logs/YYYY-MM-DD_alarm.jsonl
 *   logs/YYYY-MM-DD_error.jsonl
 *   logs/YYYY-MM-DD_mqtt.jsonl
 *   logs/YYYY-MM-DD_system.jsonl
 *   ... etc.
 *
 * The LOG_EXPORT_DIR environment variable overrides the default folder.
 */

const fs = require("fs");
const path = require("path");

const LOG_DIR =
  process.env.LOG_EXPORT_DIR || path.join(__dirname, "..", "logs");

// ── Helpers ───────────────────────────────────────────────

function getDateString(date = new Date()) {
  // YYYY-MM-DD in local time
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getFilePath(type, dateStr = getDateString()) {
  // Sanitize type to prevent path traversal
  const safeType = String(type).replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  return path.join(LOG_DIR, `${dateStr}_${safeType}.jsonl`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── Core write function ───────────────────────────────────

/**
 * Append a single log entry as a JSON line to the daily file for `type`.
 * Silently swallows write errors to avoid crashing the main process.
 *
 * @param {string} type   e.g. "alarm", "mqtt", "system"
 * @param {object} entry  Plain object — will be JSON-serialised
 */
function writeLogEntry(type, entry) {
  try {
    ensureLogDir();
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(getFilePath(type), line, "utf8");
  } catch (err) {
    console.error(`[logFileWriter] Failed to write '${type}' log:`, err.message);
  }
}

// ── File listing ──────────────────────────────────────────

/**
 * Return metadata for all .jsonl files in the log directory,
 * sorted newest-date first, then alphabetically by type.
 */
function listLogFiles() {
  try {
    ensureLogDir();
    return fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.endsWith(".jsonl"))
      .map((filename) => {
        const match = filename.match(/^(\d{4}-\d{2}-\d{2})_(.+)\.jsonl$/);
        let size = 0;
        try {
          size = fs.statSync(path.join(LOG_DIR, filename)).size;
        } catch {
          // file may have been deleted between readdir and stat
        }
        return {
          filename,
          date: match ? match[1] : "",
          type: match ? match[2] : filename,
          size,
          sizeFormatted: formatBytes(size),
        };
      })
      .sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        return dateCmp !== 0 ? dateCmp : a.type.localeCompare(b.type);
      });
  } catch {
    return [];
  }
}

// ── Safe path resolver (used by download endpoint) ───────

/**
 * Resolve the full path for a given filename, or null if the filename
 * is not in the expected pattern (prevents path traversal).
 *
 * @param {string} filename
 * @returns {string|null}
 */
function resolveLogFilePath(filename) {
  // Only allow names that match YYYY-MM-DD_type.jsonl
  if (!/^\d{4}-\d{2}-\d{2}_[a-z0-9_]+\.jsonl$/i.test(filename)) return null;
  const resolved = path.resolve(LOG_DIR, filename);
  // Ensure the resolved path is still inside LOG_DIR (belt-and-suspenders)
  if (!resolved.startsWith(path.resolve(LOG_DIR) + path.sep)) return null;
  return resolved;
}

// ── Retention / purge ─────────────────────────────────────

const DEFAULT_RETENTION_DAYS =
  Number(process.env.LOG_RETENTION_DAYS) || 30;

/**
 * Delete .jsonl files whose date prefix is older than `days` days.
 * Returns an array of {filename, deleted, reason} result objects.
 *
 * @param {number} [days]  Number of days to keep (default LOG_RETENTION_DAYS or 30)
 * @returns {{ filename: string, deleted: boolean, reason?: string }[]}
 */
function purgeOldLogFiles(days = DEFAULT_RETENTION_DAYS) {
  const results = [];
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  let filenames;
  try {
    ensureLogDir();
    filenames = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".jsonl"));
  } catch (err) {
    console.error("[logFileWriter] purge: cannot read log directory:", err.message);
    return results;
  }

  for (const filename of filenames) {
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})_/);
    if (!match) continue;

    const fileDate = new Date(match[1]);
    if (Number.isNaN(fileDate.getTime())) continue;

    if (fileDate.getTime() < cutoffMs) {
      const filePath = path.join(LOG_DIR, filename);
      try {
        fs.unlinkSync(filePath);
        console.log(`[logFileWriter] Purged old log file: ${filename}`);
        results.push({ filename, deleted: true });
      } catch (err) {
        console.error(`[logFileWriter] Failed to purge ${filename}:`, err.message);
        results.push({ filename, deleted: false, reason: err.message });
      }
    }
  }

  return results;
}

/**
 * Schedule daily purge at midnight (local time).
 * Call once on server startup.
 */
function scheduleDailyPurge() {
  const runPurge = () => {
    const deleted = purgeOldLogFiles();
    if (deleted.length > 0) {
      console.log(`[logFileWriter] Daily purge complete — removed ${deleted.filter((r) => r.deleted).length} file(s)`);
    }
  };

  // Run once immediately so old files are cleaned on restart
  runPurge();

  // Then schedule to run again 24 h later, repeating
  const scheduleNext = () => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(), now.getMonth(), now.getDate() + 1,
      0, 1, 0  // 00:01 local time — just after midnight
    );
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();
    setTimeout(() => {
      runPurge();
      scheduleNext(); // reschedule for next day
    }, msUntilMidnight);
  };

  scheduleNext();
}

module.exports = {
  writeLogEntry,
  listLogFiles,
  resolveLogFilePath,
  purgeOldLogFiles,
  scheduleDailyPurge,
  LOG_DIR,
  DEFAULT_RETENTION_DAYS,
  getDateString,
};
