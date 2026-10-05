#!/usr/bin/env node
// Brings your local copy up to date with the latest AgentOS code, safely:
//   npm run update
// 1. Saves any local edits with `git stash` (get them back with `git stash pop`).
// 2. Fetches the development branch and fast-forwards (or merges) onto it.
// 3. Installs dependencies. `npm run dev` then regenerates Prisma, applies migrations and
//    prepares the demo logins automatically.
// Override the branch with AGENTOS_BRANCH=<name>.
import { execSync } from "node:child_process";

const BRANCH = process.env.AGENTOS_BRANCH ?? "claude/cool-thompson-hypiuv";
const sh = (cmd) => execSync(cmd, { stdio: "inherit", shell: true });
const out = (cmd) =>
  execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], shell: true })
    .toString()
    .trim();

try {
  out("git rev-parse --is-inside-work-tree");
} catch {
  console.error("✖ Run this inside the AgentOS folder (the one with package.json).");
  process.exit(1);
}

console.log(`→ Fetching the latest code (${BRANCH})…`);
sh(`git fetch origin ${BRANCH}`);

if (out("git status --porcelain")) {
  console.log("→ You have local changes — saving them with git stash (restore: git stash pop)");
  sh(`git stash push --include-untracked -m "agentos-update ${new Date().toISOString()}"`);
}

const current = out("git rev-parse --abbrev-ref HEAD");
if (current !== BRANCH) {
  console.log(`→ Switching from ${current} to ${BRANCH}`);
  try {
    sh(`git checkout ${BRANCH}`);
  } catch {
    sh(`git checkout -b ${BRANCH} --track origin/${BRANCH}`);
  }
}

try {
  sh(`git merge --ff-only origin/${BRANCH}`);
} catch {
  console.log("→ Your branch has its own commits — merging the latest code into it…");
  try {
    sh(`git merge --no-edit origin/${BRANCH}`);
  } catch {
    sh("git merge --abort");
    console.error(`
✖ Your local commits conflict with the latest code. To keep the latest code exactly
  (this DISCARDS your local commits on ${BRANCH}), run:

    git reset --hard origin/${BRANCH}
    npm run update
`);
    process.exit(1);
  }
}

console.log("→ Installing dependencies…");
sh("npm install");

console.log(`
✔ Up to date: ${out("git log -1 --format=%h %s")}
  The same short code is shown at the bottom of the sign-in page and the app sidebar.
  Now start the app with:  npm run dev
`);
