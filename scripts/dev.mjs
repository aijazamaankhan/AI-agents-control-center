#!/usr/bin/env node
// `npm run dev` — one command for local development on Windows, macOS and Linux:
// creates .env with secrets, starts a built-in database if DATABASE_URL is not set
// (or points at it), applies migrations, then starts Next.js.
import { prepare, run, watchSchema } from "./lib/env.mjs";

try {
  const env = await prepare();
  console.log("\n▶ Starting AgentOS on http://localhost:3000\n");
  watchSchema(env.DATABASE_URL);
  run("npx next dev", env);
} catch (err) {
  console.error(`\n✖ ${err instanceof Error ? err.message : err}`);
  console.error("  See docs/USER_GUIDE.md → Troubleshooting.");
  process.exit(1);
}
