#!/usr/bin/env node
// Local demo logins for every role (development only — refuses to run when NODE_ENV=production).
//   npm run seed:demo                       → make sure every account in src/config/demo-accounts.json
//                                             exists (idempotent; existing passwords are left alone)
//   npm run seed:demo -- --reset-passwords  → also reset those accounts to the documented passwords
//   npm run seed:demo -- --email you@company.com --password "your-password" --name "Your Name"
//                                           → your own OWNER account with its own demo company
// `npm run dev` runs it with --quiet on every start (set AGENTOS_SKIP_DEMO_SEED=1 to opt out).
// All logins are listed in docs/LOGINS.md. Never use these credentials anywhere real.
import "dotenv/config";
import { createHash, randomBytes, scrypt } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const ACCOUNTS = JSON.parse(
  readFileSync(new URL("../src/config/demo-accounts.json", import.meta.url), "utf8"),
);

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const RESET = args.includes("--reset-passwords");
const QUIET = args.includes("--quiet");
const CUSTOM_EMAIL = arg("email")?.trim().toLowerCase();
const CUSTOM_PASSWORD = arg("password");

if (CUSTOM_EMAIL !== undefined) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CUSTOM_EMAIL)) {
    console.error("✖ --email must be a valid email address.");
    process.exit(1);
  }
  if (!CUSTOM_PASSWORD || CUSTOM_PASSWORD.length < 10 || CUSTOM_PASSWORD.length > 128) {
    console.error("✖ --password must be 10–128 characters.");
    process.exit(1);
  }
}

if (process.env.NODE_ENV === "production") {
  console.error("✖ Refusing to create demo accounts in production.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("✖ DATABASE_URL is not set. Run `npm run dev` or `npm run setup` first.");
  process.exit(1);
}

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function id(prefix) {
  let t = Date.now();
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const rand = [...randomBytes(16)].map((b) => ALPHABET[b % 32]).join("");
  return `${prefix}_${time}${rand}`;
}

// Same format as src/lib/auth/password.ts: scrypt$N$r$p$salt$hash
function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (err, key) =>
        err
          ? reject(err)
          : resolve(
              ["scrypt", 2 ** 15, 8, 1, salt.toString("base64"), key.toString("base64")].join("$"),
            ),
    ),
  );
}

const DEPARTMENTS = [
  "Sales",
  "Marketing",
  "Customer Support",
  "Finance",
  "HR",
  "Operations",
  "Engineering",
  "Analytics",
];
const AGENTS = [
  ["Lead Research Agent", "Sales", "Anthropic", "Claude Sonnet", "Finds and qualifies SaaS leads."],
  ["Outreach Writer", "Sales", "OpenAI", "GPT-5", "Drafts personalised follow-up emails."],
  [
    "Content Strategist",
    "Marketing",
    "Anthropic",
    "Claude Sonnet",
    "Plans and drafts blog content.",
  ],
  [
    "Ticket Triage",
    "Customer Support",
    "Google",
    "Gemini Flash",
    "Routes incoming support tickets.",
  ],
  ["Invoice Reconciler", "Finance", "Anthropic", "Claude Haiku", "Matches invoices to payments."],
  ["PR Reviewer", "Engineering", "OpenAI", "GPT-5 mini", "Reviews pull requests."],
];
const CAPABILITIES = [
  ["web_research", "Web research", "ALLOWED"],
  ["read_crm", "Read CRM", "ALLOWED"],
  ["send_external_email", "Send external email", "APPROVAL_REQUIRED"],
  ["make_payments", "Make payments", "DENIED"],
];

const SMALL_DEPARTMENTS = ["Production", "Quality", "Supply Chain"];
const SMALL_AGENTS = [
  ["Demand Forecaster", "Supply Chain", "Anthropic", "Claude Haiku", "Forecasts weekly demand."],
  ["QA Inspector", "Quality", "Google", "Gemini Flash", "Flags defects in inspection reports."],
];

// Local demo prices (USD per 1M tokens: input, output, cached) for the demo agents' models, so
// costs show up locally. Labelled as demo values — Velorex admins manage real prices in
// Admin → Pricing. Only added when the price list is empty.
const DEMO_PRICES = [
  ["Anthropic", "Claude Sonnet", "3", "15", "0.3"],
  ["Anthropic", "Claude Haiku", "1", "5", "0.1"],
  ["OpenAI", "GPT-5", "1.25", "10", "0.125"],
  ["OpenAI", "GPT-5 mini", "0.25", "2", "0.025"],
  ["Google", "Gemini Flash", "0.3", "2.5", "0.03"],
];
const normalizePart = (v) =>
  (v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-") || "unknown";
const priceKeyOf = (provider, model) => `${normalizePart(provider)}/${normalizePart(model)}`;

/** Adds the demo prices to an empty price list and prices any unpriced calls with them. */
async function ensureDemoPrices() {
  const { rows } = await client.query("SELECT count(*)::int AS n FROM model_prices");
  if (rows[0].n > 0) return false;
  for (const [provider, model, input, output, cached] of DEMO_PRICES) {
    const priceId = id("prc");
    const key = priceKeyOf(provider, model);
    await client.query(
      `INSERT INTO model_prices (id, price_key, provider, model, version, input_per_mtok,
         output_per_mtok, cached_per_mtok, effective_from, note)
       VALUES ($1, $2, $3, $4, 1, $5, $6, $7, '2020-01-01T00:00:00Z',
         'Local demo price — not an official list price; update in Admin → Pricing')`,
      [priceId, key, provider, model, input, output, cached],
    );
    await client.query(
      `UPDATE cost_records SET
         cost_usd = (input_tokens::numeric * $2 + output_tokens::numeric * $3
                     + cached_tokens::numeric * $4) / 1000000,
         price_id = $5, pricing_version = 1
       WHERE price_key = $1 AND pricing_version IS NULL`,
      [key, input, output, cached, priceId],
    );
  }
  await client.query(
    `UPDATE usage_daily u SET cost_usd = s.cost, unpriced_calls = s.unpriced
     FROM (SELECT organization_id, day, agent_id, department_id, price_key, sum(cost_usd) AS cost,
                  (count(*) FILTER (WHERE pricing_version IS NULL))::int AS unpriced
           FROM cost_records GROUP BY organization_id, day, agent_id, department_id, price_key) s
     WHERE u.organization_id = s.organization_id AND u.day = s.day AND u.agent_id = s.agent_id
       AND u.department_id = s.department_id AND u.price_key = s.price_key`,
  );
  return true;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
let firstKey = null;

/** Creates the user if missing. Returns its id and whether anything was created. */
async function ensureUser({ email, name, password, platformAdmin = false }) {
  const existing = await client.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount) {
    const userId = existing.rows[0].id;
    if (RESET) {
      await client.query(
        "UPDATE users SET password_hash = $2, suspended_at = NULL, updated_at = now() WHERE id = $1",
        [userId, await hashPassword(password)],
      );
    }
    if (platformAdmin) {
      await client.query("UPDATE users SET is_platform_admin = true WHERE id = $1", [userId]);
    }
    return { userId, created: false };
  }
  const userId = id("usr");
  await client.query(
    "INSERT INTO users (id, email, name, password_hash, is_platform_admin, updated_at) VALUES ($1, $2, $3, $4, $5, now())",
    [userId, email, name, await hashPassword(password), platformAdmin],
  );
  return { userId, created: true };
}

async function ensureMembership(orgId, userId, role) {
  await client.query(
    `INSERT INTO memberships (id, organization_id, user_id, role, updated_at)
     VALUES ($1, $2, $3, $4::"Role", now())
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [id("mem"), orgId, userId, role],
  );
}

/** Creates a company owned by `ownerId` with departments, agents, capabilities and API keys. */
async function createCompany(company, ownerId) {
  const orgId = id("org");
  await client.query(
    `INSERT INTO organizations (id, name, slug, industry, company_size, country, timezone, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [
      orgId,
      company.name,
      `${company.key}-demo-${randomBytes(3).toString("hex")}`,
      company.industry,
      company.size,
      company.country,
      company.timezone,
    ],
  );
  await ensureMembership(orgId, ownerId, "OWNER");

  const departments = company.full ? DEPARTMENTS : SMALL_DEPARTMENTS;
  const agents = company.full ? AGENTS : SMALL_AGENTS;
  const depIds = {};
  for (const name of departments) {
    depIds[name] = id("dep");
    await client.query(
      "INSERT INTO departments (id, organization_id, name, name_key, updated_at) VALUES ($1, $2, $3, $4, now())",
      [depIds[name], orgId, name, name.toLowerCase()],
    );
  }
  for (const [name, dep, provider, model, description] of agents) {
    const agentId = id("agt");
    await client.query(
      `INSERT INTO agents (id, organization_id, department_id, name, name_key, description, provider, model,
                           connection_type, created_by_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SDK', $9, now())`,
      [
        agentId,
        orgId,
        depIds[dep],
        name,
        name.toLowerCase(),
        description,
        provider,
        model,
        ownerId,
      ],
    );
    for (const [key, label, rule] of CAPABILITIES) {
      await client.query(
        `INSERT INTO agent_capabilities (id, organization_id, agent_id, key, label, rule)
         VALUES ($1, $2, $3, $4, $5, $6::"CapabilityRule")`,
        [id("cap"), orgId, agentId, key, label, rule],
      );
    }
    const apiKey = "aos_live_" + randomBytes(32).toString("base64url");
    await client.query(
      "INSERT INTO agent_api_keys (id, organization_id, agent_id, prefix, key_hash) VALUES ($1, $2, $3, $4, $5)",
      [
        id("key"),
        orgId,
        agentId,
        apiKey.slice(0, 15),
        createHash("sha256").update(apiKey).digest("hex"),
      ],
    );
    if (company.full) firstKey ??= apiKey;
  }
  await client.query(
    `INSERT INTO audit_logs (id, organization_id, actor_user_id, action, resource_type, resource_id, metadata)
     VALUES ($1, $2, $3, 'organization.created', 'organization', $2, '{"source":"seed:demo"}')`,
    [id("aud"), orgId, ownerId],
  );
  return orgId;
}

/** The company's org: the first one its seeded owner owns, created if missing. */
async function ensureCompany(company) {
  const [owner, ...others] = company.users;
  const { userId: ownerId, created } = await ensureUser(owner);
  const owned = await client.query(
    `SELECT organization_id FROM memberships WHERE user_id = $1 AND role = 'OWNER'
     ORDER BY created_at ASC LIMIT 1`,
    [ownerId],
  );
  let orgId = owned.rows[0]?.organization_id;
  let changed = created;
  if (!orgId) {
    orgId = await createCompany(company, ownerId);
    changed = true;
  }
  for (const user of others) {
    const res = await ensureUser(user);
    await ensureMembership(orgId, res.userId, user.role);
    changed ||= res.created;
  }
  return changed;
}

function saveDemoKey() {
  if (!firstKey) return;
  // Let `npm run demo:agent` work without arguments (Lead Research Agent's key).
  try {
    let env = readFileSync(".env", "utf8");
    env = /^AGENTOS_API_KEY=.*$/m.test(env)
      ? env.replace(/^AGENTOS_API_KEY=.*$/m, `AGENTOS_API_KEY=${firstKey}`)
      : `${env.trimEnd()}\n# Demo agent key (Lead Research Agent) — used by \`npm run demo:agent\`\nAGENTOS_API_KEY=${firstKey}\n`;
    writeFileSync(".env", env);
  } catch {
    /* no .env — the key can be regenerated from the agent's page */
  }
}

function printLogins() {
  const rows = [
    ["Velorex admin panel", "http://localhost:3000/admin/login", ACCOUNTS.platformAdmin],
    ...ACCOUNTS.companies.flatMap((c) =>
      c.users.map((u) => [`${c.name} · ${u.role}`, "http://localhost:3000/login", u]),
    ),
  ];
  console.log("\n  Demo logins (local development only — full list in docs/LOGINS.md)");
  for (const [who, url, u] of rows) {
    console.log(`   ${who.padEnd(38)} ${u.email.padEnd(22)} ${u.password.padEnd(20)} ${url}`);
  }
  console.log("");
}

await client.connect();
try {
  await client.query("BEGIN");
  // Serialise concurrent seeds (two dev servers, parallel tests) so they can't race on inserts.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('agentos:seed-demo'))");
  let changed = false;
  if (CUSTOM_EMAIL !== undefined) {
    const owner = {
      email: CUSTOM_EMAIL,
      name: arg("name") ?? CUSTOM_EMAIL.split("@")[0],
      password: CUSTOM_PASSWORD,
      platformAdmin: true, // local owner accounts also get the Velorex admin panel (dev only)
      role: "OWNER",
    };
    const company = { ...ACCOUNTS.companies[0], users: [owner] };
    changed = await ensureCompany(company);
    await client.query("COMMIT");
    saveDemoKey();
    console.log(
      changed
        ? `\n✔ Owner account ready: ${CUSTOM_EMAIL} (company "${company.name}", plus /admin access)\n`
        : `✔ ${CUSTOM_EMAIL} already exists — sign in with it${RESET ? " (password reset)" : " (password unchanged)"}.`,
    );
  } else {
    changed = (await ensureUser({ ...ACCOUNTS.platformAdmin, platformAdmin: true })).created;
    for (const company of ACCOUNTS.companies) {
      changed = (await ensureCompany(company)) || changed;
    }
    if (await ensureDemoPrices()) console.log("✔ Demo model prices added (Admin → Pricing)");
    await client.query("COMMIT");
    saveDemoKey();
    if (changed || RESET || !QUIET) {
      if (changed) console.log("\n✔ Demo accounts created");
      if (RESET) console.log("\n✔ Demo account passwords reset to the documented values");
      printLogins();
    } else {
      console.log(
        "✔ Demo logins ready — see docs/LOGINS.md (admin: /admin/login, company: /login)",
      );
    }
  }
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`✖ Could not create the demo accounts: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
