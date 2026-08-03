# Architecture

## Runtime components

```text
Browser
  | HTTPS, HttpOnly JWT cookie, REST, SSE
  v
Express backend (:3000)
  |-- controllers/routes --> MySQL
  |-- dataEvents ---------> SSE clients
  |-- logFileWriter ------> JSONL logs
  |-- t8000Adapter -------> MQTT broker
  v
Registered T8000 gateways
```

In production, Express serves the generated frontend from `backend/public/`. In development, Vite serves the frontend on port `3001` and proxies `/api` and `/auth` to port `3000`.

## Data and events

The MQTT adapter subscribes to `moe/+/Data` and `moe/+/lastwill`. It rejects or ignores unregistered gateway data, normalizes payloads, stores measurements/events, updates gateway/device state, writes operational logs, and emits `measurements:updated`. SSE clients receive an update signal and then refresh through REST.

## Commands

Config write publishes to `moe/{gatewaySn}/Config` with QoS 1 and waits for a message on `moe/+/Ack` carrying the same `msg_id`. The in-memory pending map times out after ten seconds. `read-setting` publishes an `MReq` message and subsequent setting data is processed by the main adapter.

## Authentication and access

The backend signs an eight-hour JWT stored in an HttpOnly cookie. `admin` receives access to all sites; other roles carry allowed site IDs loaded from `user_site_access`. Every controller must independently apply the correct site/resource restriction.

## Database

MySQL stores users, sites, gateways, devices, points, measurements, groups, T8000 models/parameters, and related records. Startup code adds several columns/tables, but a complete initial schema is not present in this repository.
