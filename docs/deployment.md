# Deployment and rollback

## Build

```powershell
npm run install:all
npm run lint
npm run build
npm run package:backend
```

The final SPA is copied to `backend/public/` and served by Express.

## Pre-deployment

1. Record frontend and backend commit, Node.js version, database schema version, broker environment, and supported T8000 firmware.
2. Back up the database and current application artifact.
3. Review startup migrations against the target MySQL version and schema.
4. Configure production secrets outside Git.
5. Confirm broker ACLs for Data, lastwill, Config, Ack, and MReq topics.
6. Confirm HTTPS, cookie, CORS, reverse-proxy SSE, log retention, monitoring, and rollback settings.

## Install and start

Install production dependencies in `backend/` using the lockfile, supply the production environment, and start `backend/server.js` through the approved process supervisor. The recovered snapshot did not include its systemd/container/CI definition, so the production owner must supply the authoritative command and service identity.

## Smoke test

1. Verify health/root response and database connection.
2. Log in and verify role/site restrictions.
3. Verify site, gateway, device, point, and measurement APIs.
4. Confirm MQTT connection and subscriptions.
5. Confirm data from two registered gateways remains correctly associated.
6. Confirm SSE refresh and reconnect.
7. Send one authorized reversible Config command and match ACK by `msg_id`.
8. Confirm JSONL logs and retention without leaking secrets.

## Rollback

Stop the new application through the approved supervisor, restore the previous artifact and environment, and restore the database only when the migration/data rollback plan requires it. Re-run read-only smoke tests and record timestamps, affected tenants/gateways, broker state, and result.
