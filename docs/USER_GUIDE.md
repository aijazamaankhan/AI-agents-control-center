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

### 5. Settings & roles

**Settings** holds your organization profile (owners and admins can edit).

| Role    | Can do                                              |
| ------- | --------------------------------------------------- |
| Owner   | Everything, including billing, security and budgets |
| Admin   | Agents, departments, users, integrations, approvals |
| Manager | Assigned departments, approvals, analytics          |
| Member  | Permitted agents and tasks                          |
| Viewer  | Read-only                                           |

---

## Part 2 — Running & developing AgentOS

### Requirements

- Node.js **22 LTS** or newer
- PostgreSQL **16**
- Git

### Windows (PowerShell) — e.g. a clone at `Z:\agentos-platform`

```powershell
cd Z:\agentos-platform
git fetch origin
git checkout claude/cool-thompson-hypiuv    # the development branch
git pull

Copy-Item .env.example .env                 # then edit DATABASE_URL / TEST_DATABASE_URL
npm install                                 # also generates the Prisma client
npm run db:deploy                           # apply migrations
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

| Symptom                                           | Fix                                                            |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `Invalid environment configuration: DATABASE_URL` | Create `.env` from `.env.example`                              |
| `P1001: Can't reach database server`              | Start PostgreSQL / the Docker container                        |
| Integration tests refuse to run                   | `TEST_DATABASE_URL` must be set and differ from `DATABASE_URL` |
| Port 3000 in use                                  | `npm run dev -- -p 3001`                                       |
