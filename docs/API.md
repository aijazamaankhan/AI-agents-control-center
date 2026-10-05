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

| Method & path                                                                        | Phase | Auth          | Notes                                                                                          |
| ------------------------------------------------------------------------------------ | ----- | ------------- | ---------------------------------------------------------------------------------------------- |
| `GET/POST /api/v1/agents`, `GET/PATCH/DELETE /api/v1/agents/:id`                     | 3     | session       |                                                                                                |
| `POST /api/v1/agents/:id/test-connection`                                            | 3     | session       |                                                                                                |
| `POST /api/agent-events`                                                             | 4     | agent API key | requires `Idempotency-Key`; duplicate → `200` with original `event_id`                         |
| `POST /api/agent/heartbeat`                                                          | 4     | agent API key | `agent_id`, `timestamp`, `status`, `current_task_id`                                           |
| `GET /api/v1/activity/stream`                                                        | 5     | session       | Server-Sent Events                                                                             |
| `GET /api/v1/tasks`, `GET /api/v1/tasks/:id`                                         | 5     | session       | filters: department, agent, status, provider, model, date                                      |
| `GET /api/v1/usage` — implemented                                                    | 6     | session       | `period=7d\|30d\|90d` (default 30d); `costs:read` (owner/admin/manager)                        |
| `GET /api/v1/approvals`, `POST /api/v1/approvals/:id/{approve,reject}` — implemented | 7     | session       | `?status=pending\|approved\|rejected\|all`; decide = owner/admin/manager, same-origin, audited |
| `GET /api/agent/approvals/:id` — implemented                                         | 7     | agent API key | the agent polls its own approval                                                               |
| `GET /api/v1/analytics/*` (+ `?format=csv`)                                          | 8     | session       |                                                                                                |
| `GET/POST /api/v1/budgets`, `GET /api/v1/alerts`                                     | 9     | session       |                                                                                                |

### `POST /api/agent-events` — implemented (Phase 4)

Headers: `Authorization: Bearer aos_live_…` (the agent's API key — the organization,
agent and department are derived from it, never from the body), `Idempotency-Key`
(1–200 chars `[A-Za-z0-9_-:.]`, **required**), `Content-Type: application/json`.

| `event_type`         | Fields (besides optional `agent_id`, `occurred_at`, `metadata` ≤ 4 KB)                            |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `task.started`       | `name`, `description?`, `task_id?` (`task_<8–40 alnum>`, else generated)                          |
| `llm.call`           | `provider`, `model`, `input_tokens`, `output_tokens`, `cached_tokens?`, `latency_ms?`, `task_id?` |
| `tool.call`          | `tool_name`, `latency_ms?`, `success?` (default true), `task_id?`                                 |
| `approval.requested` | `action`, `capability?` (capability key), `reason?`, `risk?` (`low`/`medium`/`high`), `task_id?`  |
| `task.completed`     | `task_id`, `result?` (JSON ≤ 4 KB)                                                                |
| `task.failed`        | `task_id`, `error?`                                                                               |
| `task.cancelled`     | `task_id`, `reason?`                                                                              |
| `log`                | `message`, `level?`                                                                               |

Token semantics: `input_tokens` = uncached input tokens, `cached_tokens` = input tokens
served from the provider's prompt cache (billed at the cached price), `output_tokens` =
generated tokens. Each `llm.call` is costed from the versioned price list (Phase 6).

Example:

```json
{
  "event_type": "llm.call",
  "agent_id": "agt_xxx",
  "task_id": "task_xxx",
  "provider": "anthropic",
  "model": "claude-sonnet",
  "input_tokens": 12430,
  "output_tokens": 2840,
  "cached_tokens": 0,
  "latency_ms": 1820,
  "occurred_at": "2026-10-05T10:42:13Z"
}
```

Responses: `201 { data: { event_id, task_id, execution_id, duplicate: false } }`;
same key + same payload again → `200` with the **original** ids and `duplicate: true`
(no tokens, activity or events are added); same key + different payload → `409
CONFLICT`. Errors: `401` bad/revoked key, `400 IDEMPOTENCY_KEY_REQUIRED`, `422`
validation (incl. `occurred_at` > 5 min in the future or > 7 days old), `404` task not
found **for this agent**, `409` finishing an already finished task, `429` rate limit
(1,200/min per key).

### Approvals (Phase 7) — implemented

`approval.requested` creates an approval. The response adds `approval_id` and
`approval_status`. The agent's capability rules decide first — the capability is the
`capability` key if sent, otherwise the `action` text matched against capability keys/labels:

| Rule                           | Result                                             | Task / agent                              |
| ------------------------------ | -------------------------------------------------- | ----------------------------------------- |
| `ALLOWED`                      | `approved` immediately (`decision_source: policy`) | keep running                              |
| `DENIED`                       | `rejected` immediately (`decision_source: policy`) | keep running (agent must stop the action) |
| `APPROVAL_REQUIRED` / no match | `pending` — shown in **Approvals**                 | task `WAITING`, agent `WAITING`           |

**`GET /api/agent/approvals/:id`** (agent key; only the requesting agent) →
`{ data: { approval_id, status: "pending"|"approved"|"rejected"|"cancelled", action, task_id,
decision_source: "human"|"policy"|"system"|null, decision_note, requested_at, decided_at } }`.
Poll every few seconds (the SDK's `approval.waitForDecision()` does this).

**`POST /api/v1/approvals/:id/approve`** / **`/reject`** (session, same-origin,
`approvals:decide`) — body `{ "note"?: string ≤ 500 }` → `{ data: { id, status } }`. `409`
if already decided. A decision resumes the task (`WAITING → RUNNING`) and the agent when
nothing else is pending, adds an `APPROVAL_DECIDED` event to the task trace/activity, and is
audited (`approval.approved` / `approval.rejected`). When a task finishes, its undecided
approvals become `cancelled`. **`GET /api/v1/approvals?status=pending&page=1`** lists them.

### `POST /api/agent/heartbeat` — implemented

Body: `{ "status": "ONLINE" | "WORKING" | "IDLE" | "WAITING" | "FAILED", "current_task_id"?, "agent_id"?, "timestamp"? }`
→ `200 { data: { ok, status, received_at, next_heartbeat_in_s: 30 } }`. Any event also
counts as a heartbeat. No heartbeat/event for **2 minutes** → the agent is shown
`OFFLINE` (it is never deleted or failed).

### `GET /api/v1/activity/stream` — implemented (SSE)

Session-authenticated Server-Sent Events for the signed-in organization:
`event: activity` (one per new execution event, with agent/department names, summary,
tokens) and `event: status` (`{ agentId: status }` for agents whose status changed).
Polls the database every 2 s; connections recycle every 5 min (EventSource reconnects).

### `GET /api/v1/usage` — implemented (Phase 6)

Session auth, `costs:read`. Query `period=7d|30d|90d` (default `30d`). Returns
`{ data: { period, days, from, to, totals, previous, series[], departments[], agents[], models[] } }`
where totals/rows carry `cost` (USD), `inputTokens`, `outputTokens`, `cachedTokens`,
`tokens`, `llmCalls`, `unpricedCalls`. Days are in the organization's timezone; `previous`
is the same-length period before. Read from `usage_daily` aggregates only.
