# Handover checklist

## Repository and ownership

- [ ] Private GitHub repository and maintainer access confirmed
- [ ] Frontend, backend, broker, database, infrastructure, and credential owners recorded
- [ ] No `.env`, API keys, broker credentials, cookies, tokens, logs, customer data, or dependencies committed

## Build

- [ ] Clean dependency installation succeeds
- [x] ESLint result recorded: 8 existing errors, 0 warnings
- [x] TypeScript and Vite production build succeeds
- [ ] Production artifact and source commit are traceable
- [x] Backend clean dependency installation succeeds
- [x] Backend dependency audit reports 0 known vulnerabilities
- [x] Backend JavaScript syntax validation succeeds

## Backend and infrastructure

- [x] Recovered backend source included under `backend/`
- [ ] Authoritative historical backend repository/branch identified
- [ ] Complete base database schema or dump located
- [ ] Broker ACL, credential, and certificate process documented
- [ ] Production service definition and CI/CD pipeline located
- [ ] Backend automated tests added

## End-to-end verification — pending

- [ ] Login/session and tenant isolation verified
- [ ] Multiple gateways connect through MQTT
- [ ] SSE live updates and reconnect verified
- [ ] Site/gateway/device/point/measurement APIs verified
- [ ] Config write ACK matched by `msg_id`
- [ ] Non-zero errors and timeouts verified
- [ ] No cross-tenant data leakage
- [ ] Frontend and backend rollback verified

No backend, broker test environment, or T8000 device was available during repository preparation.
