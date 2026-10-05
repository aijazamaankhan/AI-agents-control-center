# UX Flows

## Signup & onboarding

1. **Landing** (`/`) — "AGENTOS", tagline, subheading, **[Start Free]** → `/signup`,
   **[Book Demo]** (mailto, assumption A1).
2. **Signup** (`/signup`) — name, work email, password → session created →
   `/onboarding`.
3. **Step 1 — Create company** (`/onboarding`) — name, industry, size, country,
   timezone (defaults to browser timezone). Creates org + OWNER membership, sets
   it active → `/onboarding/departments`. _(Phase 1)_
4. **Step 2 — Departments** — recommended defaults (Marketing, Sales, Customer
   Support, Finance, HR, Operations, Engineering, Analytics); keep, remove,
   rename, add custom; "Skip for now". Shown to OWNER/ADMIN of an org with no
   departments yet. _(Phase 2 — implemented)_
5. **Step 3 — Connect first agent** — `[+ Connect Agent]` → `/agents/new`. _(Phase 3)_
6. **Step 4 — Invite team** — email invitations. _(Phase 2/3)_
7. **Step 5 — Dashboard** with checklist reflecting real state:
   Company created · Departments created · First agent connected · Invite team ·
   Configure budget · Connect integration.

Routing guards:

- Unauthenticated user on an app route → `/login?next=…`.
- Authenticated user without an organization → `/onboarding`.
- Authenticated user on `/login` or `/signup` → `/dashboard`.

## App shell

Sidebar: Dashboard, Departments, Agents, Tasks, Workflows, Activity, Approvals,
Costs & Usage, Analytics, Integrations, Team, Settings. Sections not yet built
are visible but disabled with a **Soon** badge (no dead routes).
Top bar: global search (placeholder until Phase 5), notifications, help, profile
menu (name, email, role, organization, sign out). On mobile the sidebar becomes
a slide-over drawer.

## Workforce map (UI v2)

Hub → department lanes → agent chips with animated edges. Lanes extend horizontally
for any number of departments (themed side-scroller, ‹ › buttons); 4 agents per lane

- "N more". Click department → department panel; click agent → execution trace panel;
  pause button stops motion. Sample data is badged until agents are connected.

## Dashboard (Phase 1 state)

"Good morning/afternoon/evening, {first name}" + "Your AI workforce is running."
(or onboarding copy when empty), onboarding checklist, workforce empty state
("Your AI workforce is empty." → **[Connect Your First Agent]**, disabled until
Phase 3) and "Agent activity will appear here when your agents start working."

## Departments (Phase 2)

- `/departments` — grid of department cards (derived accent + icon, description,
  agent count). OWNER/ADMIN see an inline "Add department" form; others see a
  read-only note. Empty state: "Create your first department."
- `/departments/[id]` — header, metric widgets, Agents and Activity sections (empty
  states until Phase 3), and for OWNER/ADMIN a "Manage department" card with
  rename/description and a two-step inline delete. Unknown or other-tenant id → 404.

## Settings

Organization profile form. OWNER/ADMIN can edit; others see read-only fields and
a note explaining the required role.

## States

Every data route has `loading.tsx` (skeleton) and `error.tsx`
("Unable to load …" + **[Try Again]**).

## Agents (Phase 3)

- `/agents` — search + department/status filters; rows show avatar (provider), name +
  `agt_` id, department, provider/model + connection type, status (icon + label), last
  active. Empty: "Your AI workforce is empty." → Connect Your First Agent (or "Create a
  department" when none exist).
- `/agents/new` (OWNER/ADMIN) — ① details (name, department, provider, model with
  suggestions, description) ② connection (type cards, endpoint, auth, secret) with
  **Test connection** ③ capabilities (suggested chips + custom, rule per row) →
  **Connect Agent** → success panel with one-time API key, `.env` snippet, Open agent /
  Connect another. `?department=<id>` preselects the department.
- `/agents/[id]` — header (avatar, name, status, department link, provider · model,
  copyable id) and tabs: Overview (metrics, profile, connection), Tasks, Activity, Usage
  & costs (empty until Phase 4–6), Permissions (grouped rules + editor), Settings
  (edit form, rotate API key, delete — two-step confirmations).

## Website popups

- **Book Demo** (hero, final CTA, footer) → dialog: name, work email, company, team size,
  phone, message → "Request sent".
- Footer **Velorex Studio — IT Services** → dialog: name, email, company, phone,
  service, budget, timeline, project details → "Request sent". Both close with Esc,
  the ✕ button or a backdrop click, and trap focus while open.

## Live dashboard (Phase 4)

Once agents exist the map shows a **Live** badge (Connecting… while the SSE stream opens).
Agent chips animate by real stage — Thinking (LLM call), Using <tool>, Needs approval —
and the feed streams new events. KPI cards refresh ~1.5 s after a task finishes or a
status changes. The "Next step" card shows the demo-agent command.
