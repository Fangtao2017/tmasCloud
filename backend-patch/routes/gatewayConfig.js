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

let _mqttClient = null;
const pendingAcks = new Map(); // msg_id -> { resolve, timer }

function setMqttClient(client) {
  _mqttClient = client;

  client.on('message', (topic, payload) => {
    try {
      const msg = JSON.parse(payload.toString());
      if (msg.mode === 'ACK' && msg.msg_type === 'ACK' && pendingAcks.has(msg.msg_id)) {
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

  const resultPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingAcks.delete(msgId);
      resolve({ success: false, error: -3, message: 'ACK timeout — no response from gateway' });
    }, 8000);
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
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.error === -3 ? 504 : 422).json(result);
    }
  });
});

module.exports = { router, setMqttClient };

