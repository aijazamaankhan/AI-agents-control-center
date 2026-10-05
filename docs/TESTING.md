# Testing

| Layer                       | Tool                           | Location                         | Command                    |
| --------------------------- | ------------------------------ | -------------------------------- | -------------------------- |
| Unit                        | Vitest (`unit` project)        | `tests/unit/**/*.test.ts`        | `npm run test`             |
| Integration (real Postgres) | Vitest (`integration` project) | `tests/integration/**/*.test.ts` | `npm run test:integration` |
| E2E                         | Playwright                     | `tests/e2e/**/*.spec.ts`         | `npm run test:e2e`         |

## Integration database

Integration tests require `TEST_DATABASE_URL` (a dedicated, disposable database).
The global setup runs `prisma migrate reset --force` against it, so **never point
it at a real database**. Tests create their own orgs/users with unique emails.

## Quality gate (run after every phase)

```
npm run lint && npm run typecheck && npm run test && npm run build
```

## Coverage by phase

Phase 1 (implemented):

- Unit: password hashing/verification, session token hashing, prefixed IDs,
  permission matrix, Zod schemas, API error envelope, rate limiter, slug generation.
- Integration: signup → session → org creation (OWNER membership + audit),
  login with wrong password, **tenant isolation** (user A cannot read/update org B),
  role enforcement on org update.
- E2E: landing → signup → create company → dashboard → settings → logout → login.

Phase 2 (implemented):

- Unit: department schemas (normalization, dedupe, update semantics), same-origin guard,
  workforce layout scaling / simulation determinism / visuals.
- Integration: department CRUD + audit, case-insensitive uniqueness per org, bulk
  onboarding create, RBAC, cross-tenant isolation (404 on foreign ids).
- E2E: onboarding step 2, department create/duplicate/rename/delete, `/api/v1/departments`
  GET and forged-origin POST → 403, workforce map drill-down + pause, help page.

Phase 3 + website (implemented):

- Unit: credential encryption (round-trip, IV, AAD/tamper, key config), API keys, SSRF IP
  ranges and URL rules, agent/connection/capability schemas, status interpretation,
  auth headers, enquiry schemas, HTML escaping.
- Integration: agent create (ciphertext ≠ secret, hashed key, no secret in audit),
  uniqueness, credential keep/replace/remove incl. Basic username change, key rotation,
  permission diff audit, department delete guard, RBAC, cross-tenant isolation, Test
  connection against a real local server (blocked by default; 200/401/405 when allowed);
  enquiries stored + emailed payload (mocked provider), failure, honeypot, rate limit.
- E2E: connect agent (capabilities, SDK test message, SSRF refusal, one-time key),
  profile + permissions, live map on the dashboard, department delete guard, Book Demo
  and Velorex enquiry popups.

Planned (later phases): cost calculation, token aggregation, pricing lookup,
status transitions, event ingestion idempotency, approval flow, budgets, and the
full 13-step E2E journey in the master spec.
