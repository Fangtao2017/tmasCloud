/**
 * POST /api/gateway/config-write
 * Sends a T8000 config MQTT message and waits for ACK (timeout 8s).
 *
 * Body: { gatewaySn, devId, paramId, value, duration }
 * Response: { success, error, message }
 *
 * ── How to register in server.js ──────────────────────────────────────
 *
 *   const { router: gatewayConfigRouter, setMqttClient } = require('./routes/gatewayConfig');
 *   app.use('/api/gateway', gatewayConfigRouter);
 *
 *   // Inside your mqttClient.on('connect') callback, add:
 *   setMqttClient(mqttClient);
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

let _mqttClient = null;
const pendingAcks = new Map(); // msg_id -> { resolve, timer }

function setMqttClient(client) {
  _mqttClient = client;

  // Subscribe to the ACK topic (separate from moe/+/Data)
  client.subscribe('moe/+/Ack', { qos: 0 }, (err) => {
    if (err) console.error('[gatewayConfig] Failed to subscribe to moe/+/Ack:', err.message);
    else console.log('[gatewayConfig] Subscribed to moe/+/Ack');
  });

  client.on('message', (topic, payload) => {
    if (!/\/Ack$/i.test(topic)) return;
    try {
      const msg = JSON.parse(payload.toString());
      if (msg.msg_type === 'ACK' && pendingAcks.has(msg.msg_id)) {
        const { resolve, timer } = pendingAcks.get(msg.msg_id);
        clearTimeout(timer);
        pendingAcks.delete(msg.msg_id);
        resolve({ success: msg.error === 0, error: msg.error });
      }
    } catch (_) {}
  });
}

let _msgIdCounter = Math.floor(Math.random() * 10000);
function nextMsgId() {
  _msgIdCounter = (_msgIdCounter + 1) % 100000;
  return _msgIdCounter;
}

router.post('/config-write', (req, res) => {
  const { gatewaySn, devId, paramId, value, duration } = req.body;

  if (!gatewaySn || devId == null || paramId == null || value == null || duration == null) {
    return res.status(400).json({ success: false, error: -1, message: 'Missing required fields' });
  }
  if (!_mqttClient || !_mqttClient.connected) {
    return res.status(503).json({ success: false, error: -2, message: 'MQTT client not connected' });
  }

  const msgId = nextMsgId();
  const topic = `moe/${gatewaySn}/Config`;
  const payload = JSON.stringify({
    time: Math.floor(Date.now() / 1000),
    mode: 'config',
    msg_type: 'CON',
    msg_id: msgId,
    pkt: '1/1',
    config: [{
      dev_id: Number(devId),
      param_id: Number(paramId),
      value: Number(value),
      duration: Number(duration),
    }],
  });

  // Wait for ACK from gateway (up to 10 s)
  const resultPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingAcks.delete(msgId);
      resolve({ success: false, error: -3, message: 'ACK timeout — no response from gateway' });
    }, 10000);
    pendingAcks.set(msgId, { resolve, timer });
  });

  _mqttClient.publish(topic, payload, { qos: 1 }, (publishErr) => {
    if (publishErr) {
      const pending = pendingAcks.get(msgId);
      if (pending) { clearTimeout(pending.timer); pendingAcks.delete(msgId); }
      return res.status(500).json({ success: false, error: -4, message: publishErr.message });
    }
  });

  resultPromise.then((result) => {
    if (result.success) return res.json(result);
    res.status(result.error === -3 ? 504 : 422).json(result);
  });
});

/**
 * POST /api/gateway/read-setting
 * Sends a read_setting MQTT request to a specific gateway so it returns its
 * current device list. The response is handled by the adapter's MQTT listener
 * which updates the DB; clients should refresh via SSE or the Refresh button.
 *
 * Body: { gatewayId: number }
 */
router.post('/read-setting', async (req, res) => {
  const { gatewayId } = req.body;
  if (!gatewayId) {
    return res.status(400).json({ success: false, message: 'gatewayId is required' });
  }
  if (!_mqttClient || !_mqttClient.connected) {
    return res.status(503).json({ success: false, message: 'MQTT client not connected' });
  }
  try {
    const [rows] = await db.query(
      `SELECT sn FROM gateway WHERE id = ? AND gateway_type = 'T8000' LIMIT 1`,
      [gatewayId]
    );
    if (rows.length === 0 || !rows[0].sn) {
      return res.status(404).json({ success: false, message: 'Gateway not found or has no serial number' });
    }
    const sn = rows[0].sn;
    const topic = `moe/${sn}/MReq`;
    const payload = JSON.stringify({
      time: Math.floor(Date.now() / 1000),
      mode: 'read_setting',
      msg_type: 'CON',
      msg_id: 1,
      pkt: '1/1',
      device: [],
    });
    _mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: `read_setting sent to ${topic}` });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = { router, setMqttClient };

