# API dependencies

The frontend references these backend areas. This is a route inventory, not a backend contract or guarantee of implementation.

## Authentication and users

- `/auth/login`, `/auth/me`, `/auth/logout`
- `/api/users`, `/api/users/:id`
- `/api/users/me`, `/api/users/me/password`
- `/api/users/:id/reset-password`, `/api/users/:id/sites`

## Sites and gateways

- `/api/sites`, `/api/sites/:id/energy-summary`
- `/api/gateways`, `/api/gateways/:id`
- `/api/gateways/:id/groups`
- `/api/gateway/read-setting`
- `/api/gateway/config-write`

## Devices, models, parameters, and points

- `/api/devices`, `/api/devices/:id`
- `/api/t8000-models`
- `/api/t8000-parameters`
- `/api/points`, `/api/points/:id`

## Measurements, live data, and logs

- `/api/measurements`
- `/api/measurements/latest/device/:deviceId`
- `/api/events/stream`
- `/api/logs/events`
- `/api/logs/mqtt`

Before backend implementation or testing, confirm methods, request/response schemas, pagination, tenant scoping, authorization, errors, and compatibility with the deployed backend version.
