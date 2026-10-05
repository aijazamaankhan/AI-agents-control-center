# AgentOS — Product Requirements

> **Your AI workforce. One control center.**

This document is the product source of truth. If implementation changes product
behavior, update this file in the same change.

## 1. Vision

AgentOS is a multi-tenant SaaS **control plane and observability platform** for a
company's AI agents. It is _not_ primarily an agent builder. Companies connect
agents they already run (OpenAI, Anthropic, Google, OpenAI-compatible APIs,
LangGraph, CrewAI, AutoGen, n8n, MCP, custom Python/Node agents, REST/webhook
agents) and AgentOS tells them:

- what agents exist, which department owns each, and what each is doing now;
- every task, action, tool call and model call an agent made;
- input / output / cached tokens, cost and latency for every execution;
- success/failure, pending human approvals, budgets and anomalies;
- spend by organization, department, agent, provider and model.

Positioning: _"Datadog + Linear + Stripe-style usage analytics for an AI workforce."_

## 2. Experiences

| Experience                                     | Tech                                       | Status   |
| ---------------------------------------------- | ------------------------------------------ | -------- |
| Web (primary, full-featured)                   | Next.js App Router, React, TypeScript      | Phase 1+ |
| Desktop (tray, notifications, approval popups) | Tauri shell over the web app + same API    | Phase 10 |
| Mobile (approvals, alerts, status first)       | Responsive PWA first, Expo later if needed | Phase 10 |

All experiences share **one backend, one database, one auth system**.

## 3. Tenancy & roles

- Every company is an **Organization**. All tenant-owned data carries
  `organization_id` (directly or through a validated relation).
- Roles: `OWNER`, `ADMIN`, `MANAGER`, `MEMBER`, `VIEWER` (see `SECURITY.md` §3
  for the permission matrix). Authorization is always enforced server-side.

## 4. Feature catalogue (by phase)

| Phase | Scope            | Key requirements                                                                                                                                                                                                     |
| ----- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Foundation       | Next.js/TS/Tailwind, design system, PostgreSQL + Prisma, auth (signup/login/logout, sessions), organization creation (onboarding step 1), app shell, dashboard empty state, org settings, audit log, health endpoint |
| 2     | Departments      | CRUD, recommended defaults in onboarding step 2, department page skeleton, permissions                                                                                                                               |
| 3     | Agents           | `/agents`, `/agents/new`, connection types (SDK, REST, Webhook, MCP, API, Custom), permanent `agt_` IDs, encrypted credentials, capabilities, test connection, statuses                                              |
| 4     | Event ingestion  | `POST /api/agent-events`, `POST /api/agent/heartbeat`, Idempotency-Key, SDK, executions & execution events                                                                                                           |
| 5     | Dashboard        | KPIs, live activity (SSE), tasks, execution trace, agent monitoring                                                                                                                                                  |
| 6     | Usage            | Token accounting, versioned pricing table, cost records, daily aggregates                                                                                                                                            |
| 7     | Approvals        | Requests, approve/reject, agent permission rules, audit                                                                                                                                                              |
| 8     | Analytics        | Agent/department/model/provider/cost analytics, CSV export                                                                                                                                                           |
| 9     | Alerts           | Budgets & thresholds, failures, token/cost anomalies, notifications                                                                                                                                                  |
| 10    | Desktop / mobile | Tauri app, mobile-first PWA views                                                                                                                                                                                    |

Detailed requirements for each area (onboarding, agent connection, identity,
departments, dashboard, live activity, tasks, execution traces, token & cost
tracking, pricing, approvals, agent permissions, budgets, alerts, anomaly
detection, analytics, mobile, desktop, AI assistant, SDK, event API, privacy,
audit log, integrations, search, notifications) are captured in the original
master specification and summarized per phase in `UX_FLOWS.md`, `API.md`,
`DATABASE.md` and `AGENTS.md`.

## 5. Non-negotiable product rules

1. **Tenant isolation** — no cross-organization reads or writes, ever.
2. **No invented metrics** — every number shown (including AI assistant answers)
   is traceable to stored records.
3. **Idempotent accounting** — a duplicated agent event never double counts
   tokens, cost, activity or execution events.
4. **Aggregates over raw scans** — dashboards read pre-aggregated usage tables
   that are traceable to immutable execution events.
5. **Historical cost is auditable** — every cost record stores `pricing_version`.
6. **Privacy by default** — prompts, tool arguments, secrets and customer records
   are not stored unless the organization opts in.
7. **No destructive automation** — anomaly detection observes and recommends.

## 6. Phase 1 acceptance (current)

- [x] Landing page with tagline, _Start Free_ and _Book Demo_ CTAs.
- [x] Signup (name, email, password) and login with secure server sessions.
- [x] Onboarding step 1 — create company (name, industry, size, country, timezone).
- [x] Authenticated app shell: sidebar (all sections; unbuilt ones marked _Soon_),
      top bar (search placeholder, notifications, help, profile/logout).
- [x] Dashboard greeting, onboarding checklist, workforce empty state.
- [x] Organization settings (OWNER/ADMIN may edit; others read-only).
- [x] Audit log entries for signup, login, logout, org created/updated.
- [x] `GET /api/health` (liveness + DB check).
- [x] Unit, integration (tenant isolation) and E2E tests.

## 7. Assumptions (documented per "do not guess" rule)

- **A1** _Book Demo_ links to a `mailto:` placeholder until a sales flow exists.
- **A2** A user may belong to multiple organizations; Phase 1 has no org switcher —
  the session's _active organization_ defaults to the user's earliest membership.
- **A3** Email verification and password reset require an email provider and are
  deferred; the data model leaves room for them (`User.emailVerifiedAt`).
- **A4** Dark-first: Phase 1 ships the dark theme only; light theme is a later
  enhancement driven by the same tokens.
- **A6** Before any agent is connected, the dashboard's workforce map shows a sample
  workforce with simulated activity, always badged "Sample workforce · simulated".
  KPI cards never use sample data. The landing page uses the same preview.
- **A5** Onboarding steps 2–5 (departments, connect agent, invite team) land with
  the phases that own those features; the checklist reflects real state.
