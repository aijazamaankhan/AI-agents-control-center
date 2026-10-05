#!/usr/bin/env node
// Grants (or revokes) Velorex Studio platform-admin access — the ONLY way to create admins:
//   npm run admin:grant -- --email you@velorex.dev
//   npm run admin:grant -- --email someone@x.com --revoke
// The account must already exist (sign up first). Requires shell access to the server.
import "dotenv/config";
import pg from "pg";

const args = process.argv.slice(2);
const i = args.indexOf("--email");
const email = i >= 0 ? args[i + 1]?.trim().toLowerCase() : undefined;
const revoke = args.includes("--revoke");
if (!email) {
  console.error("Usage: npm run admin:grant -- --email you@company.com [--revoke]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("✖ DATABASE_URL is not set. Run `npm run dev` or `npm run setup` first.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const res = await client.query(
    "UPDATE users SET is_platform_admin = $2 WHERE email = $1 RETURNING id",
    [email, !revoke],
  );
  if (!res.rowCount) {
    console.error(`✖ No account for ${email}. Sign up first, then run this again.`);
    process.exitCode = 1;
  } else {
    await client.query(
      `INSERT INTO audit_logs (id, actor_user_id, action, resource_type, resource_id, metadata)
       VALUES ('aud_cli_' || md5(random()::text), $1, $2, 'user', $1, $3)`,
      [
        res.rows[0].id,
        revoke ? "admin.platform_admin_revoked" : "admin.platform_admin_granted",
        JSON.stringify({ email, via: "cli" }),
      ],
    );
    console.log(
      revoke
        ? `✔ Removed platform-admin access from ${email}.`
        : `✔ ${email} is now a Velorex Studio platform admin → http://localhost:3000/admin`,
    );
  }
} finally {
  await client.end();
}
