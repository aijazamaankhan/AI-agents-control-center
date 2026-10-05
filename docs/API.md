# API

## Error envelope (all JSON endpoints)

```json
{ "error": { "code": "RESOURCE_NOT_FOUND", "message": "Agent not found" } }
```

Codes: `BAD_REQUEST`, `VALIDATION_ERROR` (adds `details.fieldErrors`),
`UNAUTHENTICATED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `CONFLICT`,
`IDEMPOTENCY_KEY_REQUIRED`, `RATE_LIMITED`, `INTERNAL_ERROR`.
Never includes stack traces, SQL, file paths or secrets.

## Implemented (Phase 1)

### `GET /api/health`

Public liveness/readiness probe.

```json
{ "status": "ok", "checks": { "database": { "status": "ok", "latencyMs": 2 } }, "time": "…" }
```

Returns `503` with `"status": "degraded"` when the database check fails.

Web mutations (signup, login, logout, organization, departments) are **server actions**.

### Departments (Phase 2) — `/api/v1/departments`

Session-cookie authenticated (for the web/desktop/mobile clients). Mutations require a
same-origin `Origin` header (CSRF) — otherwise `403 FORBIDDEN`. Writes require
`departments:manage` (OWNER, ADMIN). Another organization's id returns `404`.

| Method & path                    | Body                                     | Success                      |
| -------------------------------- | ---------------------------------------- | ---------------------------- |
| `GET /api/v1/departments`        | —                                        | `200 { data: Department[] }` |
| `POST /api/v1/departments`       | `{ name, description? }`                 | `201 { data: Department }`   |
| `GET /api/v1/departments/:id`    | —                                        | `200 { data: Department }`   |
| `PATCH /api/v1/departments/:id`  | `{ name?, description? }` (at least one) | `200 { data: Department }`   |
| `DELETE /api/v1/departments/:id` | —                                        | `204`                        |

`Department = { id, name, description, createdAt, updatedAt }`. Duplicate name
(case-insensitive) → `409 CONFLICT`; invalid body → `422 VALIDATION_ERROR` with
`details.fieldErrors`.

## Planned

| Method & path                                                          | Phase | Auth          | Notes                                                                  |
| ---------------------------------------------------------------------- | ----- | ------------- | ---------------------------------------------------------------------- |
| `GET/POST /api/v1/agents`, `GET/PATCH/DELETE /api/v1/agents/:id`       | 3     | session       |                                                                        |
| `POST /api/v1/agents/:id/test-connection`                              | 3     | session       |                                                                        |
| `POST /api/agent-events`                                               | 4     | agent API key | requires `Idempotency-Key`; duplicate → `200` with original `event_id` |
| `POST /api/agent/heartbeat`                                            | 4     | agent API key | `agent_id`, `timestamp`, `status`, `current_task_id`                   |
| `GET /api/v1/activity/stream`                                          | 5     | session       | Server-Sent Events                                                     |
| `GET /api/v1/tasks`, `GET /api/v1/tasks/:id`                           | 5     | session       | filters: department, agent, status, provider, model, date              |
| `GET /api/v1/usage`, `GET /api/v1/costs`                               | 6     | session       | period: today, 7d, 30d, 90d, custom                                    |
| `GET /api/v1/approvals`, `POST /api/v1/approvals/:id/{approve,reject}` | 7     | session       | audited                                                                |
| `GET /api/v1/analytics/*` (+ `?format=csv`)                            | 8     | session       |                                                                        |
| `GET/POST /api/v1/budgets`, `GET /api/v1/alerts`                       | 9     | session       |                                                                        |

### `POST /api/agent-events` (contract fixed now)

```json
{
  "event_type": "llm.call",
  "agent_id": "agt_xxx",
  "task_id": "task_xxx",
  "execution_id": "exec_xxx",
  "provider": "anthropic",
  "model": "claude-sonnet",
  "input_tokens": 12430,
  "output_tokens": 2840,
  "cached_tokens": 0,
  "latency_ms": 1820,
  "occurred_at": "2026-10-05T10:42:13Z"
}
```

`organization_id` is derived from the API key; `agent_id` must belong to it.
