## Backend changes required

### 1. routes/gatewayConfig.js
Copy `backend-patch/routes/gatewayConfig.js` to `/home/tcam/project/tmas-backend/routes/gatewayConfig.js`

### 2. server.js — register route and pass MQTT client
Add near the top (with other requires):
```js
const { router: gatewayConfigRouter, setMqttClient: setConfigMqttClient } = require('./routes/gatewayConfig');
```

Add with other route registrations:
```js
app.use('/api/gateway', gatewayConfigRouter);
```

Inside `mqttClient.on('connect', ...)` callback, add:
```js
setConfigMqttClient(mqttClient);
```

### 3. measurements route — add `rw` to latest-by-device query
In the SQL query for `/api/measurements/latest/device/:deviceId`,
find the JOIN on `t8000_parameter` and add `tp.rw` to the SELECT:
```sql
SELECT
  ...existing fields...,
  tp.rw
FROM point p
LEFT JOIN t8000_parameter tp ON tp.param_id = p.param_id
...
```
