#!/usr/bin/env node
// One-time local setup (Windows, macOS, Linux):
//   1. creates .env from .env.example if missing
//   2. fills AUTH_SECRET and ENCRYPTION_KEY with fresh random values if empty
//   3. applies database migrations (if the database is reachable)
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV = ".env";
if (!existsSync(ENV)) {
  copyFileSync(".env.example", ENV);
  console.log("✔ Created .env from .env.example");
}

let env = readFileSync(ENV, "utf8");
for (const key of ["AUTH_SECRET", "ENCRYPTION_KEY"]) {
  const re = new RegExp(`^${key}=\\s*$`, "m");
  if (re.test(env)) {
    env = env.replace(re, `${key}=${randomBytes(32).toString("base64")}`);
    console.log(`✔ Generated ${key}`);
  }
}
writeFileSync(ENV, env);

try {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  console.log("\n✔ Database ready. Start the app with:  npm run dev  →  http://localhost:3000");
} catch {
  console.log(
    "\n⚠ Could not reach the database in DATABASE_URL (.env).\n" +
      "  Start PostgreSQL (or `docker compose up -d db`), then run `npm run setup` again.",
  );
  process.exitCode = 1;
}
