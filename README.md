# AgentOS

> **Your AI workforce. One control center.**

AgentOS is a multi-tenant control plane and observability platform for a company's AI
agents: connect existing agents, organize them by department, trace every task, and
account for every token and dollar.

**Status:** Phase 1 (foundation) + UI v2 (live workforce map, "Signal" theme) + Phases 2–4 (departments, agents, event ingestion + live dashboard) + Phases 2–4 (departments, agents, event ingestion + live dashboard). See
[`docs/PROGRESS.md`](docs/PROGRESS.md). See [`docs/PRD.md`](docs/PRD.md) for the phase plan.

## Quick start (Windows, macOS, Linux)

Only **Node.js 22+** is required — no database install:

```bash
npm install
npm run dev        # creates .env, starts a built-in database, migrates, opens http://localhost:3000
```

Then **Start Free**, connect an agent, and in a second terminal run the demo agent with
its key to watch the dashboard come alive:

```bash
npm run demo:agent -- --key aos_live_…
```

Prefer Docker? `docker compose up --build`. Have your own PostgreSQL? Set `DATABASE_URL`
in `.env`.

## Scripts

| Command                                            | Purpose                                                   |
| -------------------------------------------------- | --------------------------------------------------------- |
| `npm run dev` / `build` / `start`                  | Next.js                                                   |
| `npm run lint` · `typecheck` · `format`            | Quality                                                   |
| `npm run test`                                     | Unit tests                                                |
| `npm run test:integration`                         | Integration tests (**resets `TEST_DATABASE_URL`**)        |
| `npm run test:e2e`                                 | Playwright E2E (builds the app; uses `TEST_DATABASE_URL`) |
| `npm run db:migrate` · `db:deploy` · `db:generate` | Prisma                                                    |

If your machine has a preinstalled Chromium that doesn't match Playwright's revision,
set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium`.

## Documentation

Start here: **[User & developer guide](docs/USER_GUIDE.md)** (incl. Windows setup) ·
**[Demo logins](docs/LOGINS.md)** (company `/login` · Velorex admin `/admin/login`) ·
**[Progress & roadmap](docs/PROGRESS.md)**.

The `docs/` folder is the source of truth: [PRD](docs/PRD.md) ·
[Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) ·
[Security](docs/SECURITY.md) · [API](docs/API.md) · [UX flows](docs/UX_FLOWS.md) ·
[Design system](docs/DESIGN_SYSTEM.md) · [Agents](docs/AGENTS.md) ·
[Testing](docs/TESTING.md) · [Code style](docs/CODE_STYLE.md) · [Env](docs/ENV.md)
