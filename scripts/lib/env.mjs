// Shared helpers for the local setup/dev scripts (Windows, macOS, Linux).
import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";

export const ENV_FILE = ".env";

/** Built-in local database (Prisma Dev = PostgreSQL in Node). No install required. */
export const LOCAL_DB = {
  name: "agentos",
  port: 51213,
  dbPort: 51214,
  shadowPort: 51215,
  url: "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable",
};

const isWindows = process.platform === "win32";

export function ensureEnvFile() {
  if (!existsSync(ENV_FILE)) {
    copyFileSync(".env.example", ENV_FILE);
    console.log("✔ Created .env from .env.example");
  }
  let env = readFileSync(ENV_FILE, "utf8");
  for (const key of ["AUTH_SECRET", "ENCRYPTION_KEY"]) {
    const re = new RegExp(`^${key}=\\s*$`, "m");
    if (re.test(env) || !new RegExp(`^${key}=`, "m").test(env)) {
      const line = `${key}=${randomBytes(32).toString("base64")}`;
      env = re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`;
      console.log(`✔ Generated ${key}`);
    }
  }
  writeFileSync(ENV_FILE, env);
}

export function readEnv() {
  const out = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

export function setEnvValue(key, value, comment) {
  let env = readFileSync(ENV_FILE, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  env = re.test(env)
    ? env.replace(re, line)
    : `${env.trimEnd()}\n${comment ? `# ${comment}\n` : ""}${line}\n`;
  writeFileSync(ENV_FILE, env);
}

function portOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/** The DATABASE_URL older .env.example files shipped with (a local PostgreSQL many people don't have). */
const OLD_EXAMPLE_URL = "postgresql://agentos:agentos@localhost:5432/agentos";

export function usesLocalDb(databaseUrl) {
  return !databaseUrl || databaseUrl === LOCAL_DB.url;
}

/** True only when a real PostgreSQL answers `SELECT 1` (an open port alone can be a stuck process). */
export async function dbReady(url, timeoutMs = 4000) {
  let client;
  try {
    const { default: pg } = await import("pg");
    client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: timeoutMs,
      query_timeout: timeoutMs,
    });
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client?.end().catch(() => {});
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startLocalDb() {
  execSync(
    `npx prisma dev -n ${LOCAL_DB.name} --port ${LOCAL_DB.port} --db-port ${LOCAL_DB.dbPort} --shadow-db-port ${LOCAL_DB.shadowPort} --detach`,
    { stdio: ["ignore", "ignore", "inherit"], shell: true, timeout: 180000 },
  );
}

/** PIDs listening on a TCP port (only used for the built-in database's own ports). */
function listenerPids(port) {
  try {
    if (isWindows) {
      const out = execSync("netstat -ano -p tcp", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return [
        ...new Set(
          out
            .split(/\r?\n/)
            .filter((l) => /LISTENING/i.test(l) && new RegExp(`[:.]${port}\\s`).test(l))
            .map((l) => l.trim().split(/\s+/).pop())
            .filter((pid) => /^\d+$/.test(pid) && pid !== "0"),
        ),
      ];
    }
    const out = execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split(/\s+/).filter((pid) => /^\d+$/.test(pid));
  } catch {
    return [];
  }
}

function stopLocalDb() {
  try {
    execSync(`npx prisma dev stop ${LOCAL_DB.name}`, {
      stdio: "ignore",
      shell: true,
      timeout: 20000,
    });
  } catch {
    /* not running / already stopped / stuck */
  }
}

/** Last resort for a stuck database: end whatever holds AgentOS's own database ports. */
function killLocalDbProcesses() {
  for (const port of [LOCAL_DB.dbPort, LOCAL_DB.port, LOCAL_DB.shadowPort]) {
    for (const pid of listenerPids(port)) {
      if (Number(pid) === process.pid) continue;
      try {
        if (isWindows) execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
        else process.kill(Number(pid), "SIGKILL");
        console.log(`  stopped the stuck database process (PID ${pid}, port ${port})`);
      } catch {
        /* already gone */
      }
    }
  }
}

/** Polls `check` until it passes or `seconds` elapse (deadline-based, never hangs). */
async function waitFor(check, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await sleep(1000);
  }
  return false;
}

/**
 * Starts the built-in database in the background (idempotent) and waits until it really
 * answers queries. A database process left stuck (e.g. after sleep, or a force-closed
 * terminal) keeps the port open without answering — it is stopped (forcefully if needed)
 * and started again.
 */
export async function ensureLocalDb() {
  const url = LOCAL_DB.url;
  if (await dbReady(url)) return url;

  if (await portOpen(LOCAL_DB.dbPort)) {
    console.log("⚠ The built-in database isn't responding — restarting it…");
    stopLocalDb();
    if (!(await waitFor(async () => !(await portOpen(LOCAL_DB.dbPort)), 8))) {
      killLocalDbProcesses();
      await waitFor(async () => !(await portOpen(LOCAL_DB.dbPort)), 8);
    }
  } else {
    console.log("▶ Starting the built-in local database (first run downloads it, ~1 min)…");
  }

  startLocalDb();
  if (await waitFor(() => dbReady(url, 2000), 90)) {
    console.log("✔ Local database running on port", LOCAL_DB.dbPort);
    return url;
  }
  throw new Error(
    [
      `The built-in database on port ${LOCAL_DB.dbPort} is not responding.`,
      "  Fix: close every terminal running AgentOS (and the desktop app), then run:",
      `    npx prisma dev stop ${LOCAL_DB.name}`,
      "    npm run dev",
      "  Still failing? Restart your computer, or see docs/USER_GUIDE.md → Troubleshooting.",
    ].join("\n"),
  );
}

const LOCK_STAMP = "node_modules/.agentos-lock-hash";

/** Re-runs `npm install` when package-lock.json changed since the last install (e.g. after git pull). */
export function ensureDependencies() {
  if (!existsSync("package-lock.json")) return;
  const hash = createHash("sha256").update(readFileSync("package-lock.json")).digest("hex");
  const stamp = existsSync(LOCK_STAMP) ? readFileSync(LOCK_STAMP, "utf8").trim() : "";
  if (stamp === hash && existsSync("node_modules/.bin")) return;
  if (stamp || !existsSync("node_modules/.bin")) {
    console.log("▶ Dependencies changed — running npm install…");
    execSync("npm install", { stdio: "inherit", shell: true });
  }
  mkdirSync("node_modules", { recursive: true });
  writeFileSync(LOCK_STAMP, hash);
}

/** Regenerates the Prisma client (fast) so it always matches prisma/schema.prisma. */
export function generateClient() {
  execSync("npx prisma generate", { stdio: ["ignore", "ignore", "inherit"], shell: true });
}

export function migrationNames() {
  try {
    return readdirSync("prisma/migrations")
      .filter((n) => statSync(`prisma/migrations/${n}`).isDirectory())
      .sort();
  } catch {
    return [];
  }
}

/**
 * While the app runs, apply new migrations/regenerate the client as soon as they appear
 * (e.g. after `git pull`), so pages never hit a missing table.
 */
export function watchSchema(databaseUrl) {
  let known = migrationNames().join(",");
  let schemaMtime = existsSync("prisma/schema.prisma")
    ? statSync("prisma/schema.prisma").mtimeMs
    : 0;
  setInterval(() => {
    const now = migrationNames().join(",");
    const mtime = existsSync("prisma/schema.prisma") ? statSync("prisma/schema.prisma").mtimeMs : 0;
    if (now === known && mtime === schemaMtime) return;
    known = now;
    schemaMtime = mtime;
    console.log("\n▶ Database schema changed — updating…");
    try {
      generateClient();
      migrate(databaseUrl);
      console.log("✔ Database up to date. Reload the page in your browser.\n");
    } catch {
      console.error(
        "✖ Could not update the database automatically. Stop and run `npm run dev` again.",
      );
    }
  }, 5000).unref();
}

export function migrate(databaseUrl) {
  for (let attempt = 1; ; attempt++) {
    try {
      execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        shell: true,
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
      return;
    } catch (err) {
      if (attempt >= 3) throw err;
      console.log(`⚠ Applying database updates failed — retrying (${attempt + 1}/3)…`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000); // sync 3 s pause
    }
  }
}

const HEAD_STAMP = ".next/.agentos-head";

/**
 * After `git pull` (new commit) Next.js' dev cache can keep serving moved/renamed routes and
 * layouts from the old code. Clear it whenever the checked-out commit changes.
 */
export function clearStaleBuildCache() {
  let head;
  try {
    head = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return; // not a git checkout
  }
  const previous = existsSync(HEAD_STAMP) ? readFileSync(HEAD_STAMP, "utf8").trim() : "";
  if (previous === head) return;
  if (existsSync(".next")) {
    console.log("▶ New code version — clearing the Next.js build cache (.next)…");
    rmSync(".next", { recursive: true, force: true });
  }
  mkdirSync(".next", { recursive: true });
  writeFileSync(HEAD_STAMP, head);
}

/** Prepares .env + database. Returns the env to start the app with. */
export async function prepare() {
  ensureDependencies();
  clearStaleBuildCache();
  ensureEnvFile();
  generateClient();
  const env = readEnv();
  let databaseUrl = env.DATABASE_URL;
  if (databaseUrl === OLD_EXAMPLE_URL && !(await portOpen(5432))) {
    console.log(
      "ℹ No PostgreSQL found on localhost:5432 — switching to the built-in local database.",
    );
    databaseUrl = "";
  }
  if (usesLocalDb(databaseUrl)) {
    databaseUrl = await ensureLocalDb();
    if (env.DATABASE_URL !== databaseUrl) {
      setEnvValue(
        "DATABASE_URL",
        databaseUrl,
        "Built-in local database (managed by `npm run dev`)",
      );
      console.log("✔ DATABASE_URL set to the built-in local database");
    }
  }
  migrate(databaseUrl);
  // Make sure the local demo logins (docs/LOGINS.md) exist — dev only, never production.
  // Idempotent: existing accounts and passwords are left alone. Opt out with AGENTOS_SKIP_DEMO_SEED=1.
  if (process.env.AGENTOS_SKIP_DEMO_SEED !== "1" && env.AGENTOS_SKIP_DEMO_SEED !== "1") {
    try {
      execSync("node scripts/seed-demo.mjs --quiet", {
        stdio: "inherit",
        shell: true,
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
    } catch {
      console.warn("⚠ Could not prepare the demo logins — the app will still start.");
    }
  }
  return { ...process.env, ...readEnv(), DATABASE_URL: databaseUrl };
}

export function run(command, env) {
  const child = spawn(command, { stdio: "inherit", shell: true, env });
  const stop = () => child.kill(isWindows ? undefined : "SIGINT");
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", (code) => process.exit(code ?? 0));
}
