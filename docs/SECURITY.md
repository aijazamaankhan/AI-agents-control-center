# Security

Security is a first-class requirement. This document is binding.

## 1. Never

- expose API keys or secrets to the client, logs, errors or Git;
- store credentials or session tokens in plaintext;
- trust an `organization_id` (or any tenant identifier) sent by the client;
- return another organization's data;
- return stack traces, SQL errors, file paths or credentials in responses.

## 2. Authentication

Decision: in-house, database-backed sessions (instead of Auth.js v5 beta, whose
credentials provider only supports stateless JWTs that cannot be revoked).

- **Passwords**: `scrypt` (Node `crypto`, N=2^15, r=8, p=1, 64-byte key, 16-byte
  random salt), compared with `timingSafeEqual`. Min length 10, max 128.
- **Sessions**: 32 random bytes → base64url token in cookie; DB stores only
  `SHA-256(token)`. Fixed 30-day lifetime (sliding refresh is a later
  enhancement). Expired rows are deleted on lookup. Logout deletes the row.
  Lookups by hash ⇒ no timing oracle on the token.
- **Org context**: the session's active organization is re-validated against
  `memberships` on every request; a stale or tampered value falls back to the
  user's earliest real membership.
- **Cookie**: `agentos_session`, `HttpOnly`, `SameSite=Lax`, `Secure` in
  production, `Path=/`. In production the name is prefixed `__Host-`.
- **Login errors** are generic ("Invalid email or password") to avoid account
  enumeration; signup with an existing email returns a generic conflict message.
- **Rate limiting**: login and signup are limited per IP and per email
  (`src/lib/security/rate-limit.ts`; in-memory in Phase 1, Redis in Phase 4).

## 3. Authorization (RBAC)

Server-side only (`src/lib/security/permissions.ts`). The UI hides controls for
convenience but is never the enforcement point.

| Permission                                    | OWNER | ADMIN | MANAGER | MEMBER | VIEWER |
| --------------------------------------------- | :---: | :---: | :-----: | :----: | :----: |
| `org:read`                                    |   ✓   |   ✓   |    ✓    |   ✓    |   ✓    |
| `org:update`                                  |   ✓   |   ✓   |         |        |        |
| `org:billing` / `org:security` / `org:delete` |   ✓   |       |         |        |        |
| `members:manage`                              |   ✓   |   ✓   |         |        |        |
| `departments:manage`                          |   ✓   |   ✓   |         |        |        |
| `agents:manage`                               |   ✓   |   ✓   |         |        |        |
| `integrations:manage`                         |   ✓   |   ✓   |         |        |        |
| `budgets:manage`                              |   ✓   |       |         |        |        |
| `approvals:decide`                            |   ✓   |   ✓   |   ✓¹    |   ✓²   |        |
| `analytics:read`                              |   ✓   |   ✓   |   ✓¹    |        |        |
| `audit:read`                                  |   ✓   |   ✓   |         |        |        |

¹ scoped to assigned departments (Phase 2+). ² only when explicitly granted.

## 4. Tenant isolation

- The active organization comes from the **server-side session**, re-validated
  against `memberships` on every request (`requireOrgContext()`).
- Every tenant query is scoped `where: { organizationId: ctx.organizationId }`;
  lookups by id use `findFirst({ where: { id, organizationId } })`, never bare
  `findUnique({ id })`.
- Integration tests (`tests/integration/tenant-isolation.test.ts`) assert that
  cross-tenant reads/updates fail.

## 5. CSRF

- Server actions: Next.js enforces `Origin` == host for action POSTs.
- Cookie-authenticated route handlers that mutate state call `assertSameOrigin(request)` (`src/lib/security/origin.ts`): the `Origin` header
  must equal the request origin or `NEXT_PUBLIC_APP_URL`; missing/foreign → `403`. The
  Tauri desktop app will use bearer tokens instead (Phase 10).
- Agent APIs (Phase 4) authenticate with agent API keys in headers, not cookies.

## 6. Agent APIs (Phase 4)

- Agent key: `aos_live_<random>`; stored hashed; shown once.
- Events require `Idempotency-Key`; webhooks signed with HMAC-SHA256
  (`WEBHOOK_SIGNING_SECRET`), timestamped, 5-minute tolerance.
- Agent credentials encrypted at rest with AES-256-GCM (`ENCRYPTION_KEY`, key versioned).

## 6b. Implemented in Phase 3

- **Credentials**: `src/lib/security/crypto.ts` — AES-256-GCM with a random 96-bit IV
  per write; associated data binds each ciphertext to its organization and agent, so a
  row copied elsewhere fails to decrypt. Key from `ENCRYPTION_KEY` (32 bytes, base64);
  missing/invalid key → `SERVICE_UNAVAILABLE` naming the fix, never the value. The UI
  and audit log only ever see a `••••last4` hint; secrets are never echoed back to forms.
- **Agent API keys**: `aos_live_` + 256 random bits, stored as SHA-256 only, shown once,
  rotation revokes the previous key immediately.
- **Test connection (SSRF)**: `src/lib/security/outbound.ts` resolves the host and
  rejects loopback, RFC1918, CGNAT, link-local (incl. cloud metadata `169.254.169.254`),
  multicast, reserved, unique-local/link-local IPv6 and IPv4-mapped forms; URLs with
  embedded credentials or non-http(s) schemes are refused; `redirect: "manual"`, 5 s
  timeout, 20 tests / 10 min per user. A DNS-rebinding window between lookup and
  connect remains (documented; acceptable for a reachability probe that returns only a
  status code). `ALLOW_PRIVATE_AGENT_ENDPOINTS=true` disables the IP check for local dev.
- **RBAC**: `agents:manage` (OWNER/ADMIN) for create/edit/permissions/keys/delete/test;
  all members can read. Department ids are validated against the caller's org.
- **Public forms** (`inquiries`): honeypot field, 5 requests/hour/IP, HTML-escaped emails,
  reply-to set to the customer, stored before sending so nothing is lost.

## 6c. Implemented in Phase 4 (event ingestion)

- **Agent authentication**: `Authorization: Bearer <key>`; the key's SHA-256 is looked up,
  revoked keys are rejected, and organization/agent/department come from the key — a
  body `agent_id` that doesn't match is `403`. Tasks are only addressable by their own
  agent (another agent's or tenant's task id → `404`).
- **Idempotency**: unique `(organization_id, idempotency_key)` plus a SHA-256 of the
  canonical payload; duplicates return the original result inside the same guarantees,
  concurrent duplicates resolve via the unique constraint, key reuse with a different
  payload is `409`.
- **Privacy**: AgentOS stores token counts, timings, tool _names_ and short summaries —
  never prompts or tool arguments. `metadata` and `result` are size-limited (4 KB) and
  secret-looking keys (`password`, `token`, `api_key`, …) are redacted before storage.
- **Abuse limits**: 1,200 requests/min per API key; `occurred_at` bounded (≤ 5 min in
  the future, ≤ 7 days old).
- **Live stream**: `/api/v1/activity/stream` requires a session and only ever queries
  the caller's organization.

## 7. HTTP security headers

Set in `next.config.ts` for all routes: `Content-Security-Policy` (production),
`Strict-Transport-Security` (production), `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (camera/mic/geo off). `X-Powered-By` disabled.

## 8. Input validation & errors

- Every input is parsed with Zod at the boundary (actions, route handlers).
- API errors use the standard envelope (`API.md`) via `src/lib/api/errors.ts`;
  unknown errors are logged server-side and returned as `INTERNAL_ERROR`.

## 9. Audit

`recordAudit()` writes immutable `audit_logs` rows. Phase 1 actions:
`user.signup`, `user.login`, `user.login_failed`, `user.logout`,
`organization.created`, `organization.updated`; Phase 2: `department.created`,
`department.updated` (changed fields, old/new name), `department.deleted`; Phase 3:
`agent.created`, `agent.updated`, `agent.deleted`, `agent.connection_tested`,
`agent.api_key_rotated`, `credential.updated`, `permission.changed` (added/removed/changed). Metadata never contains
secrets or passwords.

## 10. Privacy

Do not store passwords, API keys, secrets, full customer records, private
prompts or tool arguments unless the organization explicitly enables capture.
Retention settings and export/deletion endpoints arrive with Phase 9.
