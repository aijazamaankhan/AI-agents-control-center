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
- Cookie-authenticated route handlers that mutate state call
  `assertSameOrigin(request)`.
- Agent APIs (Phase 4) authenticate with agent API keys in headers, not cookies.

## 6. Agent APIs (Phase 4)

- Agent key: `aos_live_<random>`; stored hashed; shown once.
- Events require `Idempotency-Key`; webhooks signed with HMAC-SHA256
  (`WEBHOOK_SIGNING_SECRET`), timestamped, 5-minute tolerance.
- Agent credentials encrypted at rest with AES-256-GCM (`ENCRYPTION_KEY`, key versioned).

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
`organization.created`, `organization.updated`. Metadata never contains
secrets or passwords.

## 10. Privacy

Do not store passwords, API keys, secrets, full customer records, private
prompts or tool arguments unless the organization explicitly enables capture.
Retention settings and export/deletion endpoints arrive with Phase 9.
