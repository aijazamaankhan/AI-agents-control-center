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

## Implemented models (Phases 1–3)

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

## Planned models (later phases — design fixed, not yet migrated)

| Model                  | Phase | Notes                                                                             |
| ---------------------- | ----- | --------------------------------------------------------------------------------- |
| `Task`                 | 4     | status `QUEUED                                                                    | RUNNING | WAITING | COMPLETED | FAILED | CANCELLED` |
| `Execution`            | 4     | one run of a task                                                                 |
| `ExecutionEvent`       | 4     | immutable; unique `(organization_id, idempotency_key)`                            |
| `ToolCall`             | 4     | tool name, duration, status (arguments not stored by default)                     |
| `ModelUsage`           | 6     | provider, model, input/output/cached tokens, latency                              |
| `Pricing`              | 6     | provider, model, input/output/cached price per 1M tokens, effective_from, version |
| `CostRecord`           | 6     | per event cost, **`pricing_version`**                                             |
| `UsageDaily`           | 6     | aggregates by (org, date, scope: org/department/agent/model)                      |
| `Approval`             | 7     | requested action, risk, status, decided_by, decided_at                            |
| `Budget`               | 9     | period, amount, thresholds, channels                                              |
| `Alert`                | 9     | type, severity, status, resource                                                  |
| `Integration`          | 9     | type, encrypted config                                                            |
| `Invitation`           | 2/3   | email, role, token hash, expiry (onboarding step 4)                               |
| `OrganizationSettings` | 9     | retention, prompt/argument capture opt-ins                                        |

Any new table must be added here first.
