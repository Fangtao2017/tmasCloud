# Troubleshooting

## Login or session failure

- Capture `/auth/login` or `/auth/me` status at the exact timestamp.
- Check cookie domain, `Secure`, `SameSite`, proxy origin, and CORS settings.
- Verify the backend session store and user/site assignments.
- Never log passwords, cookies, or session tokens.

## Gateway appears offline

1. Identify tenant, site, gateway serial number, and timestamp.
2. Confirm backend MQTT client status and broker connectivity.
3. Confirm gateway connection and subscriptions.
4. Check MQTT logs and latest gateway heartbeat/state.
5. Correlate with T8000 application/network logs.

## Config write fails

1. Record request payload without credentials.
2. Confirm the target gateway belongs to the authenticated tenant/site.
3. Record MQTT topic, outgoing payload, and `msg_id`.
4. Find the matching ACK by `msg_id`.
5. Treat Error 0 as success; verify other codes in the latest ICD.
6. Distinguish publish failure, broker disconnect, ACK timeout, and non-zero T8000 error.

## Live view stops updating

- Inspect `/api/events/stream` and browser reconnect behavior.
- Check reverse-proxy buffering and idle timeout.
- Check backend subscriber health and event fan-out.
- Compare REST snapshot data with SSE updates.

## Maps fail

- Confirm `VITE_GOOGLE_MAPS_API_KEY` was compiled into the deployed artifact.
- Verify key origin restrictions, API enablement, quotas, and billing with the key owner.
