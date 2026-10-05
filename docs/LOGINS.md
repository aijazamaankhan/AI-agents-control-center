# Demo logins (local development only)

> **These accounts exist only on your own computer.** `npm run dev` creates them in the local
> database; the seed script refuses to run in production. Never reuse these passwords anywhere real.
> The source of truth is `src/config/demo-accounts.json`.

There are **two separate sign-in pages**:

| Login                   | Link                                | Who uses it                                                         |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| **Company login**       | <http://localhost:3000/login>       | Customers — owners, admins, managers, members, viewers of a company |
| **Velorex admin login** | <http://localhost:3000/admin/login> | Velorex Studio staff — the platform admin panel for all customers   |

Open the link, type the email and password from the tables below, and click **Sign in**. In
development each page also shows a **Local demo logins** box — click an entry to fill the form.

## Velorex Studio admin panel — <http://localhost:3000/admin/login>

| Account        | Email                | Password             | Lands on                                              |
| -------------- | -------------------- | -------------------- | ----------------------------------------------------- |
| Platform admin | `admin@velorex.test` | `Velorex-admin-2026` | `/admin` — all customers, users, enquiries, audit log |

Company accounts are rejected on this page ("no Velorex admin access"). The demo owner
(`demo@agentos.dev`) is also a platform admin, so it works on both pages.

## Company logins — <http://localhost:3000/login>

### Acme Corporation (Demo) — 8 departments, 6 agents

| Role        | Email               | Password            | What they can do                                               |
| ----------- | ------------------- | ------------------- | -------------------------------------------------------------- |
| **Owner**   | `demo@agentos.dev`  | `AgentOS-demo-2026` | Everything, incl. billing, members and the Velorex admin panel |
| **Admin**   | `admin@acme.test`   | `Acme-admin-2026`   | Manage departments, agents, credentials, settings              |
| **Manager** | `manager@acme.test` | `Acme-manager-2026` | Create and edit agents and departments, view everything        |
| **Member**  | `member@acme.test`  | `Acme-member-2026`  | Work with agents and tasks; no settings or credentials         |
| **Viewer**  | `viewer@acme.test`  | `Acme-viewer-2026`  | Read-only                                                      |

### Globex Industries (Demo) — a second company (shows tenant isolation)

| Role       | Email                | Password             |
| ---------- | -------------------- | -------------------- |
| **Owner**  | `owner@globex.test`  | `Globex-owner-2026`  |
| **Member** | `member@globex.test` | `Globex-member-2026` |

Sign in as a Globex user and you will never see Acme's departments, agents or tasks — and the
other way round.

## Commands

```bash
npm run dev                              # creates any missing demo logins on start
npm run seed:demo                        # same, and prints this table
npm run seed:demo -- --reset-passwords   # put every demo password back to the values above
npm run seed:demo -- --email you@company.com --password "at-least-10-chars" --name "Your Name"
                                         # your own OWNER login (+ admin panel) with its own company
npm run admin:grant -- --email you@company.com   # give any account Velorex admin access
```

Set `AGENTOS_SKIP_DEMO_SEED=1` in `.env` if you don't want `npm run dev` to create them.

## "I can't log in"

1. **Admin panel?** Use **`admin@velorex.test`** (or `demo@agentos.dev`) at `/admin/login`.
   `admin@acme.test` is a _company_ admin — it signs in at `/login`, not the admin panel.
2. **Make sure you're running the latest code** — the version (e.g. `v0.1.0 · e965893`) is shown
   under the sign-in box. Stop the app (Ctrl+C), run `npm run update`, then `npm run dev`
   (see USER_GUIDE.md → Updating). `npm run dev` clears the Next.js cache (`.next`) whenever
   the code version changes; if pages still look old, delete the `.next` folder yourself.
3. **Console says "Encountered a script tag…"** — that is a development warning shown after
   something else failed or a browser extension changed the page; it is not the cause. Read the
   error shown on the page / in the terminal, or try a private window (no extensions).
4. **Wrong password?** Run `npm run seed:demo -- --reset-passwords`.
5. **"Too many sign-in attempts"** — wait 15 minutes or restart `npm run dev`.
6. **Admin page says "no Velorex admin access"** — you used a company account; use
   `admin@velorex.test` or `demo@agentos.dev`.
