#!/usr/bin/env node
// Demo agent: reports realistic activity to AgentOS with the SDK, so you can see the
// dashboard, workforce map, tasks and activity come alive.
//
//   npm run demo:agent -- --key aos_live_xxx [--url http://localhost:3000] [--tasks 5] [--fast]
//                         [--approvals 0.25] [--approval-wait 60]
//
// --approvals: share of tasks that ask for approval to send emails (the seeded agents'
// "Send external email" permission requires approval, so they wait for you in Approvals).
// --approval-wait: seconds to wait for your decision before cancelling the task.
//
// (Get the key from Agents → Connect Agent; with the seeded demo account the key is
// already in .env as AGENTOS_API_KEY, so `npm run demo:agent` works on its own. Ctrl+C to stop.)
import "dotenv/config";
import { AgentOS } from "../src/sdk/index.ts";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const apiKey = arg("key", process.env.AGENTOS_API_KEY);
const baseUrl = arg("url", process.env.AGENTOS_URL ?? "http://localhost:3000");
const maxTasks = Number(arg("tasks", "0")) || Infinity;
const fast = args.includes("--fast");
const approvalRate = Math.min(1, Math.max(0, Number(arg("approvals", "0.25"))));
const approvalWaitS = Math.max(5, Number(arg("approval-wait", "60")) || 60);

if (!apiKey) {
  console.error(
    "Usage: npm run demo:agent -- --key aos_live_… [--url http://localhost:3000] [--tasks 5] [--fast]",
  );
  process.exit(1);
}

const pause = (min, max) =>
  new Promise((r) => setTimeout(r, fast ? 50 : min + Math.random() * (max - min)));
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const TASKS = [
  "Find 50 SaaS companies in India",
  "Enrich Q4 pipeline accounts",
  "Draft follow-ups for demo no-shows",
  "Summarize yesterday's support tickets",
  "Reconcile September invoices",
  "Score inbound leads",
];
const TOOLS = ["web_search", "crm.read", "enrich_company", "email.draft", "sheets.write"];
const MODELS = [
  ["anthropic", "Claude Sonnet"],
  ["anthropic", "Claude Haiku"],
  ["openai", "GPT-5 mini"],
];

const agentos = new AgentOS({ apiKey, baseUrl });
const log = (...m) => console.log(new Date().toLocaleTimeString(), ...m);

const stopHeartbeat = agentos.agent.startHeartbeat(fast ? 2000 : 20_000);
process.on("SIGINT", () => {
  stopHeartbeat();
  log("Stopped. The agent will show Offline in about 2 minutes.");
  process.exit(0);
});

log(`Connected to ${baseUrl}. Reporting activity… (Ctrl+C to stop)`);
try {
  for (let n = 1; n <= maxTasks; n++) {
    const task = await agentos.task.start({ name: pick(TASKS) });
    log(`▶ Task ${task.id} started`);
    const calls = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < calls; i++) {
      await pause(800, 2500);
      const [provider, model] = pick(MODELS);
      const inputTokens = 1500 + Math.floor(Math.random() * 12000);
      const outputTokens = 300 + Math.floor(Math.random() * 3000);
      await task.llmCall({
        provider,
        model,
        inputTokens,
        outputTokens,
        latencyMs: 400 + Math.floor(Math.random() * 2000),
      });
      log(`  LLM ${model}: ${inputTokens} in / ${outputTokens} out`);
      await pause(500, 1500);
      const tool = pick(TOOLS);
      await task.toolCall({ name: tool, latencyMs: 200 + Math.floor(Math.random() * 1500) });
      log(`  Tool ${tool}`);
    }
    const roll = Math.random();
    if (roll < approvalRate) {
      const req = await task.requestApproval({
        action: "Send 12 external emails",
        capability: "send_external_email",
        reason: "Follow-up emails to qualified leads",
        risk: "medium",
      });
      if (req.approval_status !== "pending") {
        log(`  ✔ Approval ${req.approval_status} automatically by the agent's permissions`);
      } else {
        log(`  ⏸ Waiting for approval — decide it in AgentOS → Approvals (${approvalWaitS}s max)`);
        const decision = await agentos.approval.waitForDecision(req.approval_id, {
          timeoutMs: approvalWaitS * 1000,
          intervalMs: 2000,
        });
        if (decision.status === "rejected") {
          await task.cancel({ reason: "Approval rejected" });
          log(
            `  ✖ Rejected${decision.decision_note ? `: ${decision.decision_note}` : ""} — task cancelled`,
          );
          await pause(1500, 5000);
          continue;
        }
        if (decision.status === "pending") {
          await task.cancel({ reason: "No approval decision in time" });
          log("  ⌛ No decision in time — task cancelled (the request was closed)");
          await pause(1500, 5000);
          continue;
        }
        log("  ✔ Approved — continuing");
      }
    }
    await pause(500, 1500);
    if (roll > 0.92) {
      await task.fail({ error: "CRM API timed out" });
      log("✖ Task failed");
    } else {
      await task.complete({ result: { itemsProcessed: 10 + Math.floor(Math.random() * 90) } });
      log("✔ Task completed");
    }
    await pause(1500, 5000);
  }
} catch (err) {
  console.error(`\n✖ ${err.message}${err.code ? ` (${err.code})` : ""}`);
  if (err.status === 401)
    console.error("  Check the API key — copy it from the agent you connected.");
  process.exitCode = 1;
} finally {
  stopHeartbeat();
}
