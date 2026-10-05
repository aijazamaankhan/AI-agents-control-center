#!/usr/bin/env node
// Creates a ready-to-use OWNER account (full access) with a demo company for local development:
//   npm run seed:demo                         → demo@agentos.dev / AgentOS-demo-2026
//   npm run seed:demo -- --email you@company.com --password "your-password" --name "Your Name"
//   npm run seed:demo -- --if-empty           → only when the database has no users (used by `npm run dev`)
// Refuses to run when NODE_ENV=production. Never use these credentials anywhere real.
import "dotenv/config";
import { createHash, randomBytes, scrypt } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
export const DEMO_EMAIL = (arg("email") ?? "demo@agentos.dev").trim().toLowerCase();
export const DEMO_PASSWORD = arg("password") ?? "AgentOS-demo-2026";
const OWNER_NAME = arg("name") ?? (arg("email") ? DEMO_EMAIL.split("@")[0] : "Demo Owner");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(DEMO_EMAIL)) {
  console.error("✖ --email must be a valid email address.");
  process.exit(1);
}
if (DEMO_PASSWORD.length < 10 || DEMO_PASSWORD.length > 128) {
  console.error("✖ --password must be 10–128 characters.");
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  console.error("✖ Refusing to create a demo account in production.");
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

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  if (process.argv.includes("--if-empty")) {
    const { rows } = await client.query("SELECT count(*)::int AS n FROM users");
    if (rows[0].n > 0) process.exit(0);
  }
  const existing = await client.query("SELECT id FROM users WHERE email = $1", [DEMO_EMAIL]);
  if (existing.rowCount) {
    console.log(
      `✔ An account for ${DEMO_EMAIL} already exists — sign in with it (password unchanged).`,
    );
    process.exit(0);
  }

  await client.query("BEGIN");
  const userId = id("usr");
  const orgId = id("org");
  await client.query(
    // Local owner accounts also get Velorex platform-admin access (dev only — never in production).
    "INSERT INTO users (id, email, name, password_hash, is_platform_admin, updated_at) VALUES ($1, $2, $3, $4, true, now())",
    [userId, DEMO_EMAIL, OWNER_NAME, await hashPassword(DEMO_PASSWORD)],
  );
  await client.query(
    `INSERT INTO organizations (id, name, slug, industry, company_size, country, timezone, updated_at)
     VALUES ($1, 'Acme Corporation (Demo)', $2, 'Software & Technology', '51-200', 'IN', 'Asia/Kolkata', now())`,
    [orgId, `acme-demo-${randomBytes(3).toString("hex")}`],
  );
  await client.query(
    `INSERT INTO memberships (id, organization_id, user_id, role, updated_at) VALUES ($1, $2, $3, 'OWNER', now())`,
    [id("mem"), orgId, userId],
  );

  const depIds = {};
  for (const name of DEPARTMENTS) {
    depIds[name] = id("dep");
    await client.query(
      "INSERT INTO departments (id, organization_id, name, name_key, updated_at) VALUES ($1, $2, $3, $4, now())",
      [depIds[name], orgId, name, name.toLowerCase()],
    );
  }

  let firstKey = null;
  for (const [name, dep, provider, model, description] of AGENTS) {
    const agentId = id("agt");
    await client.query(
      `INSERT INTO agents (id, organization_id, department_id, name, name_key, description, provider, model,
                           connection_type, created_by_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SDK', $9, now())`,
      [agentId, orgId, depIds[dep], name, name.toLowerCase(), description, provider, model, userId],
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
    firstKey ??= apiKey;
  }
  await client.query(
    `INSERT INTO audit_logs (id, organization_id, actor_user_id, action, resource_type, resource_id, metadata)
     VALUES ($1, $2, $3, 'organization.created', 'organization', $2, '{"source":"seed:demo"}')`,
    [id("aud"), orgId, userId],
  );
  await client.query("COMMIT");

  // Let `npm run demo:agent` work without arguments (Lead Research Agent's key).
  try {
    let env = readFileSync(".env", "utf8");
    env = /^AGENTOS_API_KEY=.*$/m.test(env)
      ? env.replace(/^AGENTOS_API_KEY=.*$/m, `AGENTOS_API_KEY=${firstKey}`)
      : `${env.trimEnd()}\n# Demo agent key (Lead Research Agent) — used by \`npm run demo:agent\`\nAGENTOS_API_KEY=${firstKey}\n`;
    writeFileSync(".env", env);
  } catch {
    /* no .env — key is printed below */
  }

  console.log("\n✔ Owner account created (full access + Velorex admin panel at /admin)");
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
  console.log("   Company:  Acme Corporation (Demo) — 8 departments, 6 agents");
  console.log("   Live data: run `npm run demo:agent` in a second terminal.\n");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`✖ Could not create the demo account: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
