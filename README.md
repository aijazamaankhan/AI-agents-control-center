# AgentOS

> **Your AI workforce. One control center.**

AgentOS is a multi-tenant control plane and observability platform for a company's AI
agents: connect existing agents, organize them by department, trace every task, and
account for every token and dollar.

**Status:** Phase 1 (foundation) + UI v2 (live workforce map, "Signal" theme). See
[`docs/PROGRESS.md`](docs/PROGRESS.md). See [`docs/PRD.md`](docs/PRD.md) for the phase plan.

## Quick start

Requirements: Node ≥ 22, PostgreSQL 16.

```bash
cp .env.example .env          # set DATABASE_URL / TEST_DATABASE_URL
npm install                   # also generates the Prisma client
npm run db:migrate            # apply migrations to DATABASE_URL
npm run dev                   # http://localhost:3000
```

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
**[Progress & roadmap](docs/PROGRESS.md)**.

The `docs/` folder is the source of truth: [PRD](docs/PRD.md) ·
[Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) ·
[Security](docs/SECURITY.md) · [API](docs/API.md) · [UX flows](docs/UX_FLOWS.md) ·
[Design system](docs/DESIGN_SYSTEM.md) · [Agents](docs/AGENTS.md) ·
[Testing](docs/TESTING.md) · [Code style](docs/CODE_STYLE.md) · [Env](docs/ENV.md)
