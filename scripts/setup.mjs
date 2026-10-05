#!/usr/bin/env node
// `npm run setup` — creates .env (with secrets), prepares the database and applies migrations.
import { prepare } from "./lib/env.mjs";

try {
  await prepare();
  console.log("\n✔ Ready. Start the app with:  npm run dev  →  http://localhost:3000");
} catch (err) {
  console.error(`\n✖ ${err instanceof Error ? err.message : err}`);
  console.error("  Check DATABASE_URL in .env, or leave it empty to use the built-in database.");
  process.exitCode = 1;
}
