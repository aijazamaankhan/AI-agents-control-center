# Database

PostgreSQL 16 + Prisma 7. Schema: `prisma/schema.prisma`. Migrations:
`prisma/migrations/` (always generated with `npm run db:migrate`, never hand-edited
after merge).

## Conventions

- **IDs**: string primary keys with a type prefix and a time-sortable body
  (`org_01J…`, `usr_01J…`, `agt_01J…`), generated in `src/lib/ids.ts`. IDs are
  permanent and never reused.
- **Tenancy**: every tenant-owned table has a non-null `organization_id` FK with an
  index leading on it. Child tables that reach the org only through a parent
  still carry `organization_id` directly (denormalized on purpose) so every query
  can be scoped without a join and composite FKs can enforce consistency.
- **Naming**: Prisma models `PascalCase`, fields `camelCase`, mapped to
  `snake_case` tables/columns via `@@map`/`@map`.
- **Timestamps**: `created_at`, `updated_at` (`timestamptz`). Immutable tables
  (events, audit logs, cost records) have no `updated_at`.
- **Money**: `Decimal(18, 8)` USD — never floats.
- **Tokens**: `BigInt` for aggregates, `Int` for single calls.
- **Secrets**: never stored in plaintext. Agent credentials: AES-256-GCM envelope
  (`ENCRYPTION_KEY`). Session tokens and API keys: stored as SHA-256 hashes.

## Implemented models (Phases 1–7)

| Model          | Table           | Purpose                                                                                     |
| -------------- | --------------- | ------------------------------------------------------------------------------------------- |
| `User`         | `users`         | Global identity (email unique, scrypt password hash)                                        |
| `Organization` | `organizations` | Tenant: name, slug, industry, size, country, timezone                                       |
| `Membership`   | `memberships`   | User ↔ Organization with `role`; unique `(organization_id, user_id)`                        |
| `Session`      | `sessions`      | Server-side session; `token_hash` unique; `active_organization_id`; expiry                  |
| `AuditLog`     | `audit_logs`    | Immutable audit trail (actor, org, action, resource, metadata, ip, ua)                      |
| `Department`   | `departments`   | Phase 2: `organization_id`, `name`, `name_key` (lower-cased, unique per org), `description` |

`Role` enum: `OWNER | ADMIN | MANAGER | MEMBER | VIEWER`.

`AuditLog.organization_id` is nullable only for pre-tenant events (signup, login
before an org exists); all org-scoped actions set it.

| `Agent` | `agents` | Phase 3: department (restrict delete), provider/model, connection type, endpoint, auth type, status (default `OFFLINE`), heartbeat/verification timestamps; unique `(organization_id, name_key)` |
| `AgentCredential` | `agent_credentials` | Phase 3: AES-256-GCM `ciphertext`/`iv`/`auth_tag`, `key_version`, display `hint`; AAD = `agent-credential:{org}:{agent}` |
| `AgentApiKey` | `agent_api_keys` | Phase 3: `prefix`, `key_hash` (SHA-256, unique), `revoked_at`, `last_used_at` |
| `AgentCapability` | `agent_capabilities` | Phase 3: `key`, `label`, `rule` (`ALLOWED`/`DENIED`/`APPROVAL_REQUIRED`); unique `(agent_id, key)` |
| `Inquiry` | `inquiries` | Public (non-tenant) website enquiries & demo requests; stored before emailing, with delivery status |

| `Task` | `tasks` | Phase 4: agent, department snapshot, status, timing, token counters (incremented per event), call counts, small `result`, `error` |
| `Execution` | `executions` | Phase 4: one run of a task |
| `ExecutionEvent` | `execution_events` | Phase 4: **immutable** (Phase 7 adds `APPROVAL_DECIDED`, written when a person decides); unique `(organization_id, idempotency_key)` + `payload_hash`; type, tokens, latency, tool, short `summary`, redacted `metadata` |
| `ModelPrice` | `model_prices` | Phase 6: platform-wide price list (USD per 1M input/output/cached tokens), `price_key` (normalised `provider/model`), `version` (unique per key), `effective_from`, `note`. Never edited in place — a change adds the next version |
| `CostRecord` | `cost_records` | Phase 6: one per LLM-call event (unique `event_id`), org-local `day`, tokens, exact `cost_usd` (numeric 24,12), `price_id` + **`pricing_version`** (null = unpriced, cost 0) |
| `Approval` | `approvals` | Phase 7: one per `approval.requested` event (unique `event_id`); agent, department, task, `action`, `reason`, `risk` (LOW/MEDIUM/HIGH), matched `capability_key`, `status` (PENDING/APPROVED/REJECTED/CANCELLED), `decision_source` (HUMAN/POLICY/SYSTEM), `decided_by_id`, `decision_note`, `requested_at`, `decided_at` |
| `UsageDaily` | `usage_daily` | Phase 6: aggregates keyed `(organization_id, day, agent_id, department_id, price_key)`: calls, unpriced calls, input/output/cached tokens, cost. Incremented with `INSERT … ON CONFLICT` in the event's transaction |

**Cost rules (Phase 6).** Cost = input × input price + output × output price + cached ×
cached price (per 1M tokens), computed exactly (integer micro-dollars in code, `numeric` in
SQL). A call is priced with the version whose `effective_from` is the latest ≤ the call's
time. Adding a price only fills in **unpriced** records inside its window and recomputes
their daily rows; records already priced keep their version forever (auditable history).
The migration backfilled cost records and daily rows for all earlier LLM calls as unpriced.
Usage rows keep no FK to agents/departments so history survives deletes ("Deleted agent").

## Planned models (later phases — design fixed, not yet migrated)

| Model                  | Phase | Notes                                                         |
| ---------------------- | ----- | ------------------------------------------------------------- |
| `ToolCall`             | 4     | tool name, duration, status (arguments not stored by default) |
| `Budget`               | 9     | period, amount, thresholds, channels                          |
| `Alert`                | 9     | type, severity, status, resource                              |
| `Integration`          | 9     | type, encrypted config                                        |
| `Invitation`           | 2/3   | email, role, token hash, expiry (onboarding step 4)           |
| `OrganizationSettings` | 9     | retention, prompt/argument capture opt-ins                    |

Any new table must be added here first.
