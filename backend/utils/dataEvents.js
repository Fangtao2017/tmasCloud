/**
 * Singleton EventEmitter for internal data-change notifications.
 * Used to push SSE events to connected frontend clients when new
 * measurements are ingested, without coupling adapter code to HTTP.
 *
 * Events:
 *   'measurements:updated' — emitted after a successful measurement ingest
 *                            payload: { gatewayId: number }
 */
const { EventEmitter } = require("events");

const dataEvents = new EventEmitter();
// Allow up to 500 concurrent SSE listeners without warning
dataEvents.setMaxListeners(500);

module.exports = dataEvents;
