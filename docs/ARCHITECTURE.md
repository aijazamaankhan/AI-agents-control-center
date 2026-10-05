# Architecture

## Overview

```
                    AGENTOS CLOUD
        ┌─────────────────┼─────────────────┐
       WEB             DESKTOP            MOBILE
   (Next.js)       (Tauri shell)       (PWA → Expo)
        └─────────────────┼─────────────────┘
                     API LAYER  (Next.js route handlers + server actions)
                          │
                 AGENT CONTROL PLANE  (src/features/*/server)
          ┌──────────┬────┴─────┬──────────────┐
        Agents     Tasks      Events       Approvals
          └──────────┴────┬─────┴──────────────┘
                     PostgreSQL (Prisma)
                          │
              Event processing (jobs/, Redis queue — Phase 4+)
                          │
              Token + cost accounting → daily aggregates
                          │
                 Analytics / Alerts
```

One source of truth: a single PostgreSQL database behind a single API. Desktop
and mobile are clients of the same API and auth; they never get their own DB.

## Stack (pinned — see "Dependency notes")

| Concern           | Choice                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Web framework     | Next.js 16 (App Router, `src/` dir), React 19, TypeScript 6 strict                        |
| Styling           | Tailwind CSS 4 (CSS-first `@theme` tokens), Lucide icons, in-repo shadcn-style primitives |
| DB / ORM          | PostgreSQL 16, Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`)                |
| Validation        | Zod 4                                                                                     |
| Auth              | In-house session auth (see `SECURITY.md` §2)                                              |
| Realtime          | SSE (Phase 5)                                                                             |
| Jobs / rate limit | Redis (Phase 4+); in-memory limiter in Phase 1 behind the same interface                  |
| Tests             | Vitest (unit + integration projects), Playwright (E2E)                                    |
| Desktop           | Tauri (Phase 10)                                                                          |

## Layers & directories

```
src/
  app/                 Routes only: layouts, pages, route handlers. Thin.
    (marketing)/       Landing page
    (auth)/            /login, /signup
    (app)/             Authenticated shell: /dashboard, /settings, ...
    onboarding/        Company creation wizard
    api/               Route handlers (JSON API, health)
  components/
    ui/                Design-system primitives (no business logic)
    layout/            App shell (sidebar, top bar)
  features/<domain>/
    server/            Business logic + data access (server-only). All tenant
                       queries take an OrgContext and scope by organizationId.
    actions.ts         Server actions: validate → authorize → call server/ → redirect
    components/        Feature UI (receives data via props)
    schemas.ts         Zod schemas shared by client + server
  lib/
    auth/              Password hashing, sessions, current-user/org guards
    db/                Prisma client singleton
    security/          Permissions, rate limiting, audit, origin checks
    validation/        Shared Zod helpers
    api/               API error format + helpers
    ids.ts             Prefixed, sortable IDs (org_, usr_, agt_, ...)
  config/              Navigation, constants, env parsing
  generated/prisma/    Prisma client output (git-ignored)
  types/
  sdk/                 AgentOS SDK (Phase 4)
  jobs/                Background workers (Phase 4+)
prisma/                schema.prisma, migrations/
tests/                 unit/, integration/, e2e/
docs/                  This documentation set (source of truth)
```

Rules:

- No database access in React components; pages call `features/*/server` functions.
- No business logic in UI components.
- Every server entry point (page, action, route handler) resolves the caller via
  `requireOrgContext()` / `requireUser()` before touching tenant data.

## Request flow (authenticated page)

1. Page/layout calls `requireOrgContext()` → reads session cookie → looks up the
   hashed token → loads user + membership of the session's active organization.
2. Page calls `features/x/server/*.ts` with the context; queries include
   `where: { organizationId: ctx.organizationId }`.
3. Mutations go through server actions: Zod parse → `assertPermission(ctx.role, …)`
   → service → `recordAudit()` → `revalidatePath`/`redirect`.

## Event accounting (Phase 4–6 design, fixed now)

- `ExecutionEvent` rows are **immutable**, unique on `(organization_id, idempotency_key)`.
- Ingestion inserts the event and its `CostRecord` in one transaction; a duplicate
  key returns the original event id with no side effects.
- Daily aggregates (`UsageDaily` per org / department / agent / model) are
  incremented in the same transaction (or by a worker) and are traceable back via
  `(date, scope)` to the cost records that produced them.
- Dashboards read aggregates, never full raw-event scans.

## Observability of AgentOS itself

- `GET /api/health` — liveness + DB round-trip latency (Phase 1).
- Structured server logs (`src/lib/logger.ts`); user-facing errors are generic.
- Later: ingestion latency, queue depth, worker failures, error rate metrics.

## Dependency notes (from Phase 1 inspection)

| Problem                                                                                                                                               | Decision                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `prisma@latest` is `8.0.0-rc.19` (pre-release tagged latest)                                                                                          | Pin Prisma **7.10.x** (`^7.10.0`)                                                 |
| `typescript@latest` is 7.x; `typescript-eslint` supports `<6.1`                                                                                       | Pin TypeScript **6.0.x**                                                          |
| `eslint@10` unsupported by `eslint-plugin-react` (peer `^9.7`) used by `eslint-config-next`                                                           | Pin ESLint **9.x**                                                                |
| Auth.js v5 is still beta; its credentials provider forces stateless JWT sessions                                                                      | In-house DB-backed sessions (see `SECURITY.md`)                                   |
| `npm audit` reports advisories in dev tooling only (`braces` via `eslint-config-next`, `deepmerge-ts` via `@prisma/config`); fixes require downgrades | Accepted for dev tooling; re-check on upgrades. Not shipped to production runtime |
