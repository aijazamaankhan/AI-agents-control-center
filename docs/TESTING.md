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

Planned (later phases): cost calculation, token aggregation, pricing lookup,
status transitions, event ingestion idempotency, approval flow, budgets, and the
full 13-step E2E journey in the master spec.
