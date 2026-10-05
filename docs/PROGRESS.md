# Progress & Roadmap

What has been built, what is next, and what is deliberately not done yet.
Update this file at the end of every phase.

## ✅ Done

### Phase 1 — Foundation

- Documentation set in `docs/` (PRD, architecture, database, security, API, UX flows,
  design system, agents, testing, code style, env).
- Next.js 16 · React 19 · TypeScript 6 strict · Tailwind 4 · Prisma 7 · PostgreSQL 16.
- Authentication: sign up, sign in, sign out; database-backed sessions (hashed tokens,
  HTTP-only cookies); scrypt passwords; rate-limited login/signup; generic errors.
- Organizations: onboarding step 1 (create company), settings page, OWNER membership.
- Tenant isolation: organization context resolved server-side and re-validated against
  memberships on every request (integration-tested).
- RBAC matrix for OWNER / ADMIN / MANAGER / MEMBER / VIEWER (server-side).
- Audit log for signup, login, failed login, logout, organization created/updated.
- `/api/health`, standard API error envelope, security headers.
- Tests: unit, integration (real Postgres), Playwright E2E on desktop + mobile.

### UI v2 — "Signal" theme & live workforce map

- New dark theme: near-black surfaces, signal-green primary, neon accents (lime, cyan,
  purple, orange, pink), condensed display numerals, themed scrollbars, dotted canvas.
- **Workforce map**: animated control-plane view — hub → department lanes → agents,
  flowing edges with event packets, live status per agent, side panel with department
  details and per-agent execution trace, live activity feed.
  - Scales to any number of company-defined departments: lanes extend horizontally
    (themed side-scroller + ‹ › controls); up to 4 agents per lane with "+N more".
  - Department colours and icons are derived from the name, so new departments look
    right without configuration.
  - Accessibility: pause/resume control (WCAG 2.2.2), honours `prefers-reduced-motion`,
    status always shown as text + colour, keyboard-focusable nodes.
  - Until real agents are connected it runs a **clearly labelled sample workforce**
    with simulated activity; KPI cards always show real numbers.
- Notched "folder-tab" KPI widgets, redesigned landing page with the live map as hero,
  "How it works" steps, in-app **Help & guide** (`/help`).

### Phase 2 — Departments

See the Phase 2 section of the PRD; status tracked below once merged.

## 🔜 Next

| Phase | Scope            | Key deliverables                                                                                                                                                               |
| ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3     | Agents           | `/agents`, `/agents/new`, connection types, permanent `agt_` IDs, encrypted credentials, capabilities, test connection, agent profile; map switches from sample to real agents |
| 4     | Event ingestion  | `POST /api/agent-events` (Idempotency-Key), `POST /api/agent/heartbeat`, SDK, tasks/executions/events tables                                                                   |
| 5     | Live dashboard   | SSE stream feeding the workforce map and activity feed, tasks page, execution trace page                                                                                       |
| 6     | Usage & cost     | Versioned pricing table, cost records with `pricing_version`, daily aggregates                                                                                                 |
| 7     | Approvals        | Approval queue, approve/reject (web + mobile), agent permission rules, audit                                                                                                   |
| 8     | Analytics        | Department / agent / model / provider analytics, CSV export                                                                                                                    |
| 9     | Alerts & budgets | Budgets with thresholds, failure/token/cost anomalies, notifications                                                                                                           |
| 10    | Desktop & mobile | Tauri desktop app (tray, notifications, approval popups), mobile-first PWA                                                                                                     |

## Known gaps (intentional for now)

- No email verification / password reset (needs an email provider).
- No organization switcher (users with several orgs use their first).
- Rate limiter is in-memory (Redis in Phase 4).
- Global search and notifications are placeholders until Phases 5 and 9.
