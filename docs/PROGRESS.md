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

- `Department` table (`dep_` IDs), case-insensitive unique names per organization,
  limit of 200 per organization.
- Onboarding step 2 (`/onboarding/departments`): recommended defaults (Marketing, Sales,
  Customer Support, Finance, HR, Operations, Engineering, Analytics) — keep, rename,
  remove or add custom; "Skip for now".
- `/departments`: department grid with derived colour/icon, inline "Add department".
- `/departments/[id]`: header, metrics (real zeros until agents exist), agents and
  activity sections, rename/description edit and two-step delete for OWNER/ADMIN.
- JSON API for desktop/mobile clients: `GET/POST /api/v1/departments`,
  `GET/PATCH/DELETE /api/v1/departments/:id` (session auth + same-origin CSRF check).
- Server-side RBAC (`departments:manage` = OWNER/ADMIN; everyone in the org can read),
  tenant-scoped lookups (another org's id → 404), audit entries for
  created/updated/deleted. Dashboard checklist reflects real department count.
- Tests: schema unit tests, integration (CRUD, uniqueness, RBAC, cross-tenant isolation,
  audit), E2E (onboarding step 2, CRUD, API incl. CSRF rejection).

### Website & delivery (2.5)

- Full landing page: header + mobile menu, hero, works-with strip, live map, answers,
  how it works, 12 features, approvals/budget example, SDK sample, security, platforms,
  FAQ, final CTA, footer.
- **Book Demo** and the footer **Velorex Studio — IT Services** credit open working
  popup forms. Requests are saved to `inquiries` and emailed to
  velorexdesign@gmail.com via Resend (needs `EMAIL_PROVIDER_API_KEY`); honeypot +
  rate limit.
- One-command run: `docker compose up --build`; `npm run setup` for Node users.

### Phase 3 — Agents

- Tables: `agents` (`agt_` IDs, unique name per org, department FK with restrict),
  `agent_credentials` (AES-256-GCM, AAD-bound to org + agent), `agent_api_keys`
  (SHA-256 hashes, shown once, rotatable), `agent_capabilities` (allowed / needs
  approval / not allowed).
- `/agents` list with search + department/status filters; `/agents/new` connect flow
  (details, connection type, endpoint + auth, capabilities, **Test connection**,
  one-time API key + `.env` snippet); `/agents/[id]` with Overview, Tasks, Activity,
  Usage & costs, Permissions (view/edit) and Settings (edit, rotate key, delete).
- Test connection: SSRF-guarded (private/loopback/metadata IPs blocked unless
  `ALLOW_PRIVATE_AGENT_ENDPOINTS=true`), no redirects, 5 s timeout, rate limited.
- Status starts **Offline** until heartbeats arrive (Phase 4) — never faked.
- Dashboard: real agent KPIs; the workforce map switches from the sample to the
  organization's real departments + agents once the first agent is connected.
- Departments show real agent counts/lists; a department with agents can't be deleted.
- Audit: agent created/updated/deleted, credential updated, permission changed (diff),
  API key rotated, connection tested.

### Run-it-anywhere fixes

- `npm run dev` now prepares everything: `.env` + secrets, a **built-in local database**
  (Prisma Dev — PostgreSQL in Node, no install), migrations, then Next.js. Older `.env`
  files pointing at a missing PostgreSQL are switched over automatically.
- Fixed a dev-mode hydration failure (popup `<dialog>` rendered inside a `<p>`) that could
  break clicks such as Start Free; popups now render in a portal. Fixed a Strict Mode
  issue that closed popups instantly in development. Added the app icon.

### Phase 4 — Event ingestion

- `POST /api/agent-events` (API-key auth, required Idempotency-Key, 8 event types),
  `POST /api/agent/heartbeat`, offline detection after 2 minutes of silence.
- Tables `tasks`, `executions`, `execution_events` (immutable, idempotent, payload-hashed);
  task token/call counters maintained in the same transaction as each event.
- **AgentOS SDK** (`src/sdk/index.ts`, zero dependencies): `task.start/complete/fail`,
  `llm.call`, `tool.call`, `approval.request`, heartbeats; retries reuse the same key.
- **Demo agent** (`npm run demo:agent -- --key …`) to see live data immediately.
- Live dashboard over Server-Sent Events: map goes **Live**, agents animate by real
  status/stage, activity feed streams, KPI cards (Tasks today, Tokens) refresh.
- Agent page: real Tasks and Activity tabs, today's tasks/success rate/latency/tokens;
  department page: today's tasks/success/tokens.

### Phase 5 — Tasks, activity & monitoring

- `/tasks`: search + filters (department, agent, status, provider, model, date range),
  pagination. `/tasks/[id]`: header, totals, **expandable execution trace** (time offsets,
  tokens, latency, tool, IDs, redacted metadata), result/error, executions.
- `/activity`: full-page live stream (SSE) with department/agent filters and pause.
- **Agent health** (Healthy / Warning / Critical / No data) with reasons — failure rate,
  failure streaks, heartbeat silence, LLM latency — on the agents list and agent page.
- **Global search** in the top bar (`/search`): agents, departments and tasks (by name or ID).
- Local developer comfort: `npm run dev` re-runs `npm install` when dependencies change,
  regenerates the Prisma client, **applies new migrations while running** (after
  `git pull`), and creates an owner **demo account** on an empty database
  (`demo@agentos.dev` / `AgentOS-demo-2026`, shown on the sign-in page in development
  only; `npm run seed:demo -- --email … --password …` for your own owner account).
  In development the error page shows the real cause and a fix hint.

### Theme, controls & Velorex admin panel

- **Theme mode**: dark / light / system, switchable from the top bar, landing page,
  sign-in pages and Settings → Appearance; applied before first paint (no flash).
- **Settings tabs**: Organization, Profile (name), Security (change password — signs out
  other devices; active sessions list; sign out all other sessions), Appearance.
- **Velorex Studio admin panel** (`/admin`, separate shell): platform overview, Customers
  (search, members, departments, agents, keys; suspend / reactivate), Users (suspend,
  sign out everywhere, reset to a one-time temporary password), Enquiries (Velorex project
  and demo requests; mark handled), platform Audit log. Hidden (404) from non-staff.
- Suspensions are enforced everywhere: suspended users can't sign in and lose sessions;
  suspended organizations are redirected to a notice, and their actions, APIs and agent
  keys are refused.
- Admin access is granted only via `npm run admin:grant -- --email …` (the local seeded
  owner is an admin automatically).

### Separate logins & demo accounts for every role

- **Two sign-in pages**: company login at `/login`, **Velorex admin login at `/admin/login`**
  (Velorex-branded; rejects non-admin accounts; signing out of the admin panel returns there).
  Visiting `/admin` signed out goes to the admin login. Links between both pages and in the
  landing-page footer.
- **Demo logins for every role** (`src/config/demo-accounts.json`, listed in
  [LOGINS.md](LOGINS.md)): platform admin, Acme Owner/Admin/Manager/Member/Viewer and a second
  company (Globex) to show tenant isolation. `npm run dev` creates any missing ones on every
  start (idempotent; `--reset-passwords` restores the documented passwords). Development only.
- Sign-in pages list the demo logins in development — click to fill.
- **`npm run update`** pulls the latest code safely; the running version (`v0.1.0 · <commit>`)
  is shown under the sign-in box and in the sidebar.

## 🔜 Next

| Phase | Scope                 | Key deliverables                                                                                                                                                               |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2b    | Department follow-ups | Manager ↔ department assignment (managers see only assigned departments); real department lanes on the workforce map once agents exist                                         |
| 3     | Agents                | `/agents`, `/agents/new`, connection types, permanent `agt_` IDs, encrypted credentials, capabilities, test connection, agent profile; map switches from sample to real agents |
| 4     | Event ingestion       | `POST /api/agent-events` (Idempotency-Key), `POST /api/agent/heartbeat`, SDK, tasks/executions/events tables                                                                   |
| 5     | Live dashboard        | SSE stream feeding the workforce map and activity feed, tasks page, execution trace page                                                                                       |
| 6     | Usage & cost          | Versioned pricing table, cost records with `pricing_version`, daily aggregates                                                                                                 |
| 7     | Approvals             | Approval queue, approve/reject (web + mobile), agent permission rules, audit                                                                                                   |
| 8     | Analytics             | Department / agent / model / provider analytics, CSV export                                                                                                                    |
| 9     | Alerts & budgets      | Budgets with thresholds, failure/token/cost anomalies, notifications                                                                                                           |
| 10    | Desktop & mobile      | Tauri desktop app (tray, notifications, approval popups), mobile-first PWA                                                                                                     |

## Known gaps (intentional for now)

- No email verification / password reset (needs an email provider).
- No organization switcher (users with several orgs use their first).
- Rate limiter is in-memory (Redis in Phase 4).
- Managers currently see all departments; per-department assignment is Phase 2b.
- Global search and notifications are placeholders until Phases 5 and 9.
