# Known gaps

- The recovered backend does not include a complete base-schema migration or database dump. Startup migrations only extend an existing schema.
- No automated backend tests are defined; `npm test` is still a placeholder.
- No confirmed frontend/backend/T8000 firmware compatibility matrix is available.
- No live MySQL, MQTT broker, or T8000 environment was available for end-to-end verification.
- Several frontend navigation entries are disabled or marked under development.
- Presentation/mock data remains in `frontend/src/data/`; each consumer must be classified before production use.
- The frontend's main JavaScript bundle is approximately 3.73 MB minified and needs code splitting.
- Production service definition, container/systemd files, reverse proxy, TLS certificates, CI/CD, monitoring, backup, and disaster recovery were not recovered.
- Broker ACLs, MQTT certificate policy, credential rotation, and production secret ownership require confirmation.
- JSONL logs were recovered from the server but intentionally excluded because they may contain customer/operational data.
- ACK tracking is in memory; process restart loses pending commands, and multi-instance behavior requires design review.
- The generated `msg_id` is process-local and must be reviewed for collision behavior under multi-instance or high-concurrency deployment.
