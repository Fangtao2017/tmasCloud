# TMASCloud

TMASCloud is a full-stack, multi-gateway cloud management platform for TCAM T8000 gateways. The backend connects to an MQTT broker, ingests data from multiple registered gateways, stores operational data in MySQL, and exposes authenticated REST and Server-Sent Events (SSE) APIs to the Web frontend.

This project is different from **T8000 Embedded Web**. Embedded Web is served locally by one gateway. TMASCloud provides centralized site, gateway, device, measurement, log, user, and remote-configuration management for multiple T8000 gateways.

## Repository layout

```text
frontend/          React + TypeScript + Vite application
backend/           Express, MySQL, MQTT, authentication, APIs, and log handling
  adapters/        T8000 MQTT ingestion and gateway state handling
  controllers/     API business logic
  middleware/      JWT cookie authentication and role checks
  routes/          REST, authentication, log, and MQTT command routes
  scripts/         Administrator bootstrap utility
  utils/           SSE events and JSONL log writer
  public/          Generated frontend build; not committed
docs/              Architecture, API, deployment, troubleshooting, and handover notes
scripts/           Repository-level packaging utility
```

## Main functions

- Multi-site and multi-gateway overview
- Gateway onboarding and connection status
- Device, model, parameter, point, and device-group management
- MQTT ingestion for scheduled, read, change, alarm, error, health, status, rule, setting, and related modes
- Measurement history and latest-value maintenance
- SSE notifications to refresh live frontend views
- Central event, MQTT, system, and category-based JSONL logs
- Cookie-based JWT authentication and role/site access control
- User administration and site assignments
- Remote T8000 Config write with ACK matching by `msg_id`
- Read-setting requests through `MReq`

## System flow

```text
Browser
  |  HTTPS / cookie session / REST / SSE
  v
TMASCloud Express backend
  |-- MySQL
  |-- JSONL operational logs
  |-- MQTT client
  v
MQTT broker
  v
Multiple registered T8000 gateways
```

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm
- MySQL with the TMASCloud base schema
- MQTT broker reachable from the backend
- T8000 gateways configured for the broker and registered in the TMASCloud database
- HTTPS termination and reverse proxy for production
- Restricted Google Maps browser API key if map views are enabled

The recovered backend performs several startup migrations, but it does not contain a complete base-schema migration set. A database dump or authoritative schema is still required for a new installation.

## First-time setup

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
npm run install:all
```

Fill `backend/.env` using secrets from the approved credential store. Never copy the recovered server `.env` into Git.

### Create the first administrator

The backend has no published default administrator password. Create the first account explicitly:

```powershell
npm run create-admin --prefix backend -- admin "<strong-unique-password>" "System Administrator"
```

The command hashes the password with bcrypt before storing it. Transfer the password through the approved internal credential channel and change it according to company policy.

### Current demo environment

The following account was provided for handover testing:

| Item | Value |
| --- | --- |
| URL | `iot.tmascloud.com:9000` |
| Username | `admin` |
| Password | `Tmascloud123` |

These are demo-environment credentials, not credentials hard-coded by the application. Keep this repository private, rotate the password when ownership changes, and remove this section before making the repository public or sharing the document outside the authorized handover group.

## Development

Start the backend:

```powershell
npm start
```

Start the frontend in another terminal:

```powershell
$env:BACKEND_URL='http://127.0.0.1:3000'
npm run dev
```

The frontend runs at `http://localhost:3001` and proxies `/api` and `/auth` to the backend. The backend defaults to port `3000`.

## Build and production package

```powershell
npm run build
npm run package:backend
```

`package:backend` copies `frontend/dist/` into `backend/public/`. The Express backend serves that directory and falls back to `index.html` for SPA routes.

Deploy the backend source, generated `public/`, production dependencies, and production `.env` through the approved server pipeline. Do not deploy `.git`, source `.env.example` values, developer caches, `node_modules` copied from another machine, or recovered runtime logs.

## Configuration

Configuration templates are documented in:

- `frontend/.env.example`: API base/proxy and Google Maps browser key.
- `backend/.env.example`: database, JWT, CORS, ingest token, MQTT, body limit, and log retention.

Important rules:

- `JWT_SECRET`, `T8000_INGEST_TOKEN`, database credentials, and MQTT credentials are secrets.
- `VITE_*` variables are compiled into browser code and cannot hold secrets.
- Use MQTTs and broker/server certificate validation in production according to company infrastructure policy.
- Restrict the Google Maps browser key by allowed origins and enabled APIs.

## Authentication and authorization

The backend stores an HttpOnly JWT in the `token` cookie. Production cookies are `Secure` and `SameSite=Strict`. Roles are `admin`, `site_admin`, `operator`, and `viewer`. Non-admin users receive explicit site assignments through `user_site_access`.

Authorization and tenant/site isolation must be enforced by the backend on every resource and command. Frontend filtering is not a security boundary.

## T8000 MQTT behavior

- Default ingest subscription: `moe/+/Data`
- Gateway last-will subscription: `moe/+/lastwill`
- Config publish: `moe/{gatewaySn}/Config`
- Config ACK subscription: `moe/+/Ack`
- Read-setting publish: `moe/{gatewaySn}/MReq`

Config responses are matched using `msg_id`. Error `0` is treated as success. Meanings of all other T8000 error codes must be taken from the latest Interface Control Document.

## Logs

The backend writes category-based JSONL files under `backend/logs/` by default and applies scheduled retention. Logs can contain gateway identifiers and operational/customer data. They are excluded from Git and must follow company retention, access, export, and deletion policy.

## Validation status

- Frontend TypeScript and Vite production build passed on 2026-08-03.
- Frontend ESLint has 8 existing errors recorded as technical debt.
- Backend clean dependency installation passed; `npm audit` reports 0 known vulnerabilities after non-major fixes.
- Backend JavaScript syntax validation passed on the recovered source.
- No live MySQL/MQTT/T8000 end-to-end environment was available during final handover.
- Shutdown/reboot is not part of this cloud backend workflow.

## Documentation

- [Architecture](docs/architecture.md)
- [API dependencies](docs/api-dependencies.md)
- [Deployment and rollback](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Known gaps](docs/known-gaps.md)
- [Handover checklist](docs/handover-checklist.md)
- [Legacy cloud-platform design](docs/legacy-cloud-platform-design.md)

## Ownership

Keep this repository private. Confirm the frontend owner, backend owner, MQTT/broker administrator, database owner, production infrastructure owner, deployment approver, and credential custodian during handover.
