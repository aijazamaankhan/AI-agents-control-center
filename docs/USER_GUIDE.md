# AgentOS User & Developer Guide

Part 1 explains how to use the product. Part 2 explains how to run and work on it,
including on Windows. The in-app version of Part 1 lives at **Help & guide** (`/help`).

---

## Part 1 — Using AgentOS

### 1. Get started

1. Open the app and click **Start Free**.
2. Enter your name, work email and a password (10+ characters).
3. Create your company: name, industry, size, country and timezone.
4. Create your departments (Sales, Support, Finance… or your own names).
5. You land on the **Dashboard**.

### 2. Dashboard

- **KPI widgets** — total agents, working, waiting, errors, tasks today, tokens, AI cost.
  These are always your real numbers (zero until agents are connected).
- **Workforce map** — see below.
- **Get started checklist** — reflects what your organization has actually done.

### 3. Reading the workforce map

| Element                | Meaning                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Hub (left)             | The AgentOS control plane: working / needs approval / failed counts and session tokens & cost     |
| Lane                   | One department. Lanes continue to the right — scroll sideways or use **‹ ›**                      |
| Agent chip             | Provider badge (A = Anthropic, O = OpenAI, G = Google, C = custom), name and what it is doing now |
| Green · Working        | Agent is executing a task (thinking, using a tool, wrapping up)                                   |
| Amber · Needs approval | Agent is waiting for a human decision                                                             |
| Grey · Idle            | Connected, no active task                                                                         |
| Red · Failed           | Last task failed; it will retry                                                                   |
| Moving dots            | Events flowing from agents → department → control plane                                           |
| **+ N more**           | Department has more agents than fit in the lane — opens the department panel                      |

Click a **department** to see its agents and totals. Click an **agent** to see its live
execution trace (Task started → LLM call → Tool call → Human approval → Completed),
tokens, cost, tools and recent events. Use **⏸** to pause all motion.

> Until you connect agents the map shows a **Sample workforce · simulated** badge.
> Nothing in the sample is your data.

### 4. Departments

Owners and admins can create, rename and delete departments on **Departments**.
Names must be unique within your organization (case-insensitive). Delete asks for
confirmation. Once agents exist (Phase 3), a department that still has agents can't be
deleted. Every change is written to the audit log.

### 5. Agents

1. **Agents → Connect Agent** (owners/admins; needs at least one department).
2. Fill in name, department, provider and model.
3. Choose how it connects: **SDK** (agent reports events with its API key), or REST API,
   Webhook, MCP, API integration or Custom with an endpoint URL and optional
   authentication (API key header, bearer token or basic auth — encrypted at rest).
4. **Test connection** checks the endpoint is reachable (local/private addresses are
   blocked for safety; set `ALLOW_PRIVATE_AGENT_ENDPOINTS=true` in `.env` to test agents
   on your own machine).
5. Add capabilities and mark each **Allowed**, **Needs approval** or **Not allowed**.
6. **Connect Agent** → copy the API key now (it's shown once) into your agent's
   environment. The agent appears as **Offline** until it starts reporting.

On an agent's page: **Permissions** to change rules, **Settings** to edit the connection,
rotate the API key or delete the agent.

### 6. Connecting your own agent (SDK / Event API)

Use the SDK in `src/sdk/index.ts` (zero dependencies, TypeScript):

```ts
import { AgentOS } from "./sdk"; // copy src/sdk/index.ts into your agent
const agentos = new AgentOS({
  apiKey: process.env.AGENTOS_API_KEY!,
  baseUrl: "http://localhost:3000",
});
agentos.agent.startHeartbeat();
const task = await agentos.task.start({ name: "Find SaaS leads" });
await task.llmCall({
  provider: "anthropic",
  model: "claude-sonnet",
  inputTokens: 12430,
  outputTokens: 2840,
});
await task.toolCall({ name: "web_search" });
await task.complete({ result: { leadsFound: 47 } });
```

Or call the HTTP API from any language — see `API.md` (`POST /api/agent-events` with
`Authorization: Bearer <key>` and an `Idempotency-Key` header).

### 6b. Costs & Usage

**Costs & Usage** (sidebar; owners, admins and managers) shows AI spend and tokens for the
last 7, 30 or 90 days: total cost with change vs the previous period, tokens (input /
output / cached), LLM calls, a daily chart (cost or tokens; "Show data table" for exact
numbers) and rankings by department, agent and model. Agent pages show cost today and a
30-day chart under **Usage & costs**; the dashboard and department pages show cost today.

Costs use Velorex's versioned **price list** (USD per 1M tokens). If a model has no price
yet its calls are counted as **unpriced** ($0, with a warning) and are priced automatically
once a price is added. Changing a price never rewrites past costs.

### 6c. Approvals

When an agent wants to do something risky it asks first. Its **permissions** (Agents → agent
→ Permissions) decide: **Allowed** → approved instantly, **Denied** → rejected instantly,
**Requires approval** → it waits in **Approvals** (sidebar badge + dashboard banner).
Owners, admins and managers open **Approvals**, optionally add a note, and click **Approve**
or **Reject**. The agent receives the decision and note, its task continues, and the decision
shows in the task's trace. Requests still pending when a task ends are closed automatically.

Try it: `npm run demo:agent` (about 1 in 4 demo tasks asks to send external emails and waits
up to 60 s — `--approvals 1 --approval-wait 120` to see it every time).

### 6d. Desktop app (Windows, macOS, Linux)

The desktop app is AgentOS in its own window, plus a **tray icon**, **desktop notifications**
for new approvals and failed tasks, and an **approval pop-up** for quick decisions.

1. Start AgentOS (`npm run dev`), then in a **second terminal**: `npm run desktop`.
2. On first start, enter `http://localhost:3000` → **Connect**, then sign in.
3. Closing the window keeps AgentOS in the tray (bottom-right on Windows). Right-click the
   tray icon for pending approvals, quick links, notification and start-up options, **Change
   server…** and **Quit**.

**Map not animating in the desktop app?** Make sure you're on desktop app 0.1.1 or newer
(rebuild/reinstall after `npm run update`). If the map says "Animations off (your system
reduces motion)", click **Turn on**, or set **Settings → Appearance → Motion → Always
animate**. Windows turns animations off when **Settings → Accessibility → Visual effects →
Animation effects** is off. Offline agents only show a faint "waiting for heartbeat" ping; agents
animate fully when they work. Run `npm run demo:agent` to see real work, or click **Preview
activity** on the map for a clearly labelled simulation on your own departments and agents
(nothing is recorded; it stops when real work arrives).

Make an installer to share: `npm run desktop:build` (on Windows this creates
`desktop\dist\AgentOS Setup 0.1.0.exe` and a portable `.exe`). The installer isn't signed yet,
so Windows shows "Windows protected your PC". Click **More info → Run anyway**. Details:
[desktop/README.md](../desktop/README.md).

### 7. Website enquiries & demo requests

The landing page's **Book Demo** button and the footer's **Velorex Studio — IT Services**
link open forms. Submissions are emailed to velorexdesign@gmail.com once
`EMAIL_PROVIDER_API_KEY` is set (see `ENV.md` → "Sending enquiry emails") and are always
saved in the database (`npx prisma studio` → `Inquiry`).

### 8. Theme

Use the ☀ / ☾ / 🖥 switch in the top bar (or Settings → Appearance) for light, dark or
system theme. The choice is remembered on this device. **Settings → Appearance → Motion**
controls animations: **System** follows your computer's "reduce motion" setting, and
**Always animate** overrides it.

### 9. Velorex Studio admin panel (platform owners only)

Sign in at **http://localhost:3000/admin/login** (separate from the company login at `/login`),
or open the account menu → **Velorex admin panel**. Local demo admin: `admin@velorex.test` /
`Velorex-admin-2026` — every demo login is listed in [LOGINS.md](LOGINS.md).

- **Overview** — customers, users, agents, tasks and events across the platform.
- **Customers** — every company: members, departments, agents and their API keys.
  **Suspend** blocks the company's users and agents until you **Reactivate**.
- **Users** — **Sign out everywhere**, **Reset password** (a one-time temporary password is
  shown to you — share it securely), **Suspend / Reactivate**.
- **Enquiries** — website project requests and demo requests; **Mark handled**.
- **Pricing** — the model price list used for every customer's costs. **Add price version**
  (provider, model, input/output/cached $ per 1M tokens, optional effective date). Models
  agents use without a price are listed at the top — click one to prefill the form. Local
  development starts with demo prices (marked as such) — replace them with real list prices.
- **Audit log** — every security-relevant action, including all admin actions.

Passwords and agent secrets can never be viewed by anyone (they're hashed/encrypted) —
reset or revoke them instead.

Give someone admin access (run on the server, after they sign up):

```powershell
npm run admin:grant -- --email person@velorex.dev        # add  --revoke  to remove
```

The local demo owner (`demo@agentos.dev`) and `admin@velorex.test` are already admins.

### 10. Settings & roles

**Settings** has tabs: Organization (owners/admins can edit), Profile, Security
(change password, active sessions, sign out other devices) and Appearance (theme).

| Role    | Can do                                              |
| ------- | --------------------------------------------------- |
| Owner   | Everything, including billing, security and budgets |
| Admin   | Agents, departments, users, integrations, approvals |
| Manager | Assigned departments, approvals, analytics          |
| Member  | Permitted agents and tasks                          |
| Viewer  | Read-only                                           |

---

## Part 2 — Running & developing AgentOS

### Fastest way to run it (Windows, macOS, Linux) — only Node.js needed

```powershell
cd Z:\agentos-platform
npm run update      # get the latest code safely (first time: see "Updating" below)
npm run dev
```

Open **http://localhost:3000**. `npm run dev` creates **demo logins for every role** — company
users sign in at **/login**, Velorex admins at **/admin/login**. All emails and passwords are in
**[LOGINS.md](LOGINS.md)** (e.g. owner **demo@agentos.dev / AgentOS-demo-2026**); in development
the sign-in pages also list them — click one to fill the form. Or click **Start Free** to create
your own company. Database updates are applied
automatically. `npm run dev` does everything:
creates `.env` with generated secrets, starts a **built-in local database** (PostgreSQL
running inside Node — nothing to install; the first start downloads it once), applies
migrations and starts the app. Stop with `Ctrl+C`; your data is kept. To stop the
background database too: `npm run db:local:stop`.

### Updating to the latest code

The version you're running (e.g. `v0.1.0 · e965893`) is shown under the sign-in box and at the
bottom of the app sidebar. To update:

```powershell
cd Z:\agentos-platform
npm run update        # stashes local edits, fetches + merges the latest code, npm install
npm run dev           # restart — new migrations and demo logins are applied automatically
```

**First time only** — if your copy is too old to have `npm run update`, or `git pull` keeps
failing, reset your copy to the latest code. ⚠ This **discards local changes to tracked files**
(your `.env` and database are kept):

```powershell
cd Z:\agentos-platform
git fetch origin claude/cool-thompson-hypiuv
git checkout claude/cool-thompson-hypiuv
git reset --hard origin/claude/cool-thompson-hypiuv
npm install
npm run dev
```

Then compare the short code under the sign-in box with `git log -1 --oneline` — they match when
you're up to date. Stop any running `npm run dev` (Ctrl+C) before updating.

### See it live: the demo agent

1. In the app: **Agents → Connect Agent** → fill in name/department/model → **Connect Agent**.
2. Copy the command shown on the success screen and run it in a **second terminal**:
   ```powershell
   npm run demo:agent -- --key aos_live_…
   ```
3. Open the **Dashboard**: the map turns **Live**, the agent switches to Working, the activity
   feed streams model and tool calls, and Tasks today / Tokens count up. Agent page →
   **Tasks** and **Activity** tabs show the full history.

### Alternative: Docker

```powershell
docker compose up --build
```

Starts PostgreSQL (host port 5433) and the app; migrations and secrets are automatic.

### Requirements (without Docker)

- Node.js **22 LTS** or newer
- PostgreSQL **16**
- Git

### Windows (PowerShell) — e.g. a clone at `Z:\agentos-platform`

```powershell
cd Z:\agentos-platform
git fetch origin
git checkout claude/cool-thompson-hypiuv    # the development branch
git pull

npm install                                 # also generates the Prisma client
npm run setup                               # creates .env with secrets + applies migrations
                                            # (edit DATABASE_URL in .env first if needed)
npm run dev                                 # http://localhost:3000
```

**Open in VS Code:** `code Z:\agentos-platform` (or _File → Open Folder…_). Accept the
"recommended extensions" prompt (ESLint, Prettier, Tailwind CSS, Prisma, Vitest,
Playwright) — the workspace formats on save and uses the project's TypeScript.
Run commands in the integrated terminal (`` Ctrl+` ``).

**Database on Windows** — pick one:

- _PostgreSQL installer_ (postgresql.org/download/windows), then in **SQL Shell (psql)**:
  ```sql
  CREATE USER agentos WITH PASSWORD 'agentos' CREATEDB;
  CREATE DATABASE agentos OWNER agentos;
  CREATE DATABASE agentos_test OWNER agentos;
  ```
- _Docker Desktop_:
  ```powershell
  docker run --name agentos-db -e POSTGRES_USER=agentos -e POSTGRES_PASSWORD=agentos `
    -e POSTGRES_DB=agentos -p 5432:5432 -d postgres:16
  docker exec agentos-db createdb -U agentos agentos_test
  ```

`.env` then contains:

```
DATABASE_URL=postgresql://agentos:agentos@localhost:5432/agentos
TEST_DATABASE_URL=postgresql://agentos:agentos@localhost:5432/agentos_test
```

> **Tip:** if `Z:` is a mapped network drive and `npm install` is slow or fails with
> symlink/EPERM errors, clone to a local disk (e.g. `C:\dev\agentos-platform`) instead.

### macOS / Linux

Same commands; use `cp .env.example .env`.

### Tools & commands

| Command                       | What it does                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Start the dev server with hot reload                                                           |
| `npm run build` / `npm start` | Production build / serve it                                                                    |
| `npm run lint`                | ESLint                                                                                         |
| `npm run typecheck`           | TypeScript strict check                                                                        |
| `npm run format`              | Prettier (incl. Tailwind class order)                                                          |
| `npm run test`                | Unit tests (Vitest)                                                                            |
| `npm run test:integration`    | Integration tests against Postgres — **wipes `TEST_DATABASE_URL`**                             |
| `npm run test:e2e`            | Playwright browser tests (builds the app first). First time: `npx playwright install chromium` |
| `npm run db:migrate`          | Create + apply a new migration after editing `prisma/schema.prisma`                            |
| `npm run db:deploy`           | Apply existing migrations (CI / fresh machines)                                                |
| `npx prisma studio`           | Browse the database in a web UI                                                                |
| `GET /api/health`             | Liveness + database check                                                                      |

**Quality gate before every push:**
`npm run lint && npm run typecheck && npm run test && npm run build`

### Where things live

See `ARCHITECTURE.md`. In short: routes in `src/app`, business logic in
`src/features/<domain>/server`, UI primitives in `src/components/ui`, the workforce map in
`src/features/workforce`, schema in `prisma/schema.prisma`.

### Troubleshooting

**`P1001: Can't reach database server at localhost:51214`** — the built-in database got stuck
(e.g. after the PC slept or a terminal was force-closed). `npm run dev` now detects this and
restarts it automatically ("The built-in database isn't responding — restarting it…"). If it
still fails: close every terminal running AgentOS (and the desktop app), then run
`npx prisma dev stop agentos` and `npm run dev` again — or restart the computer. Your data is
kept.

| Symptom                                           | Fix                                                            |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `Invalid environment configuration: DATABASE_URL` | Create `.env` from `.env.example`                              |
| `P1001: Can't reach database server`              | Start PostgreSQL / the Docker container                        |
| Integration tests refuse to run                   | `TEST_DATABASE_URL` must be set and differ from `DATABASE_URL` |
| Port 3000 in use                                  | `npm run dev -- -p 3001`                                       |
