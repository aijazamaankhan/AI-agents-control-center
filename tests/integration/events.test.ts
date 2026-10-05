import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as postEvent } from "@/app/api/agent-events/route";
import { POST as postHeartbeat } from "@/app/api/agent/heartbeat/route";
import { agentSchema } from "@/features/agents/schemas";
import { createAgent, rotateAgentApiKey } from "@/features/agents/server/agent-service";
import { createDepartment } from "@/features/departments/server/department-service";
import { listTasks, recentActivity, todayStats } from "@/features/events/server/activity";
import { HEARTBEAT_TIMEOUT_MS, sweepStaleAgents } from "@/features/events/server/ingest";
import { db } from "@/lib/db/client";
import { createTenant } from "../support/factories";

async function setup(name = "Acme") {
  const t = await createTenant(name);
  const dep = await createDepartment(t.ctx, { name: "Sales", description: "" });
  const { id, apiKey } = await createAgent(
    t.ctx,
    agentSchema.parse({
      name: "Lead Research Agent",
      departmentId: dep.id,
      provider: "Anthropic",
      model: "Claude Sonnet",
      connectionType: "SDK",
    }),
  );
  return { ...t, dep, agentId: id, apiKey };
}

function send(apiKey: string | null, body: unknown, key: string | null = randomUUID()) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (key) headers["Idempotency-Key"] = key;
  return postEvent(
    new Request("http://localhost/api/agent-events", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/agent-events", () => {
  it("records a full task lifecycle with token counters, statuses and activity", async () => {
    const { ctx, apiKey, agentId, dep } = await setup();

    const started = await send(apiKey, {
      event_type: "task.started",
      name: "Find 50 SaaS companies in India",
    });
    expect(started.status).toBe(201);
    const { data } = await started.json();
    expect(data.task_id).toMatch(/^task_/);
    expect(data.execution_id).toMatch(/^exec_/);
    expect((await db.agent.findUniqueOrThrow({ where: { id: agentId } })).status).toBe("WORKING");

    const llm = {
      event_type: "llm.call",
      task_id: data.task_id,
      provider: "anthropic",
      model: "claude-sonnet",
      input_tokens: 12430,
      output_tokens: 2840,
      latency_ms: 1820,
    };
    expect((await send(apiKey, llm)).status).toBe(201);
    expect(
      (await send(apiKey, { ...llm, input_tokens: 3200, output_tokens: 1100, cached_tokens: 500 }))
        .status,
    ).toBe(201);
    expect(
      (
        await send(apiKey, {
          event_type: "tool.call",
          task_id: data.task_id,
          tool_name: "web_search",
          latency_ms: 1400,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await send(apiKey, {
          event_type: "approval.requested",
          task_id: data.task_id,
          action: "Send external email",
        })
      ).status,
    ).toBe(201);
    expect((await db.agent.findUniqueOrThrow({ where: { id: agentId } })).status).toBe("WAITING");

    const done = await send(apiKey, {
      event_type: "task.completed",
      task_id: data.task_id,
      result: { leadsFound: 47 },
    });
    expect(done.status).toBe(201);

    const task = await db.task.findUniqueOrThrow({ where: { id: data.task_id } });
    expect(task).toMatchObject({
      status: "COMPLETED",
      departmentId: dep.id,
      llmCalls: 2,
      toolCalls: 1,
      result: { leadsFound: 47 },
    });
    expect(task.inputTokens).toBe(15630n);
    expect(task.outputTokens).toBe(3940n);
    expect(task.cachedTokens).toBe(500n);
    expect(task.durationMs).toBeGreaterThanOrEqual(0);
    expect(await db.execution.findFirstOrThrow({ where: { taskId: task.id } })).toMatchObject({
      status: "COMPLETED",
    });

    const agent = await db.agent.findUniqueOrThrow({ where: { id: agentId } });
    expect(agent.status).toBe("ONLINE");
    expect(agent.lastHeartbeatAt).not.toBeNull();

    const activity = await recentActivity(ctx, { agentId });
    expect(activity.map((a) => a.type)).toEqual([
      "TASK_COMPLETED",
      "APPROVAL_REQUESTED",
      "TOOL_CALL",
      "LLM_CALL",
      "LLM_CALL",
      "TASK_STARTED",
    ]);
    expect(activity[4]!.summary).toBe("claude-sonnet · 12,430 in / 2,840 out");
    const stats = await todayStats(ctx, "UTC", { agentId });
    expect(stats).toMatchObject({
      tasks: 1,
      completed: 1,
      failed: 0,
      tokens: 15630 + 3940 + 500,
      successRate: 1,
    });
    expect((await listTasks(ctx, { agentId }))[0]!.id).toBe(task.id);
  });

  it("is idempotent: a repeated event returns the original id and never double-counts", async () => {
    const { apiKey } = await setup();
    const start = await (await send(apiKey, { event_type: "task.started", name: "x" })).json();
    const key = randomUUID();
    const body = {
      event_type: "llm.call",
      task_id: start.data.task_id,
      provider: "openai",
      model: "gpt",
      input_tokens: 1000,
      output_tokens: 10,
    };

    const first = await send(apiKey, body, key);
    const second = await send(apiKey, body, key);
    const third = await send(apiKey, { ...body }, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const [a, b, c] = await Promise.all([first.json(), second.json(), third.json()]);
    expect(b.data).toEqual({ ...a.data, duplicate: true });
    expect(c.data.event_id).toBe(a.data.event_id);

    const task = await db.task.findUniqueOrThrow({ where: { id: start.data.task_id } });
    expect(task.inputTokens).toBe(1000n);
    expect(task.llmCalls).toBe(1);
    expect(await db.executionEvent.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it("handles concurrent duplicate deliveries safely", async () => {
    const { apiKey } = await setup();
    const start = await (await send(apiKey, { event_type: "task.started", name: "x" })).json();
    const key = randomUUID();
    const body = { event_type: "tool.call", task_id: start.data.task_id, tool_name: "crm" };
    const results = await Promise.all(Array.from({ length: 5 }, () => send(apiKey, body, key)));
    const ids = new Set(
      await Promise.all(results.map(async (r) => (await r.json()).data.event_id)),
    );
    expect(ids.size).toBe(1);
    expect((await db.task.findUniqueOrThrow({ where: { id: start.data.task_id } })).toolCalls).toBe(
      1,
    );
  });

  it("rejects reusing an Idempotency-Key for a different payload", async () => {
    const { apiKey } = await setup();
    const key = randomUUID();
    await send(apiKey, { event_type: "log", message: "hello" }, key);
    const res = await send(apiKey, { event_type: "log", message: "different" }, key);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("CONFLICT");
  });

  it("validates auth, idempotency header, body and task ownership", async () => {
    const { apiKey, agentId, ctx } = await setup();
    expect((await send(null, { event_type: "log", message: "x" })).status).toBe(401);
    expect((await send("aos_live_nope", { event_type: "log", message: "x" })).status).toBe(401);
    const noKey = await send(apiKey, { event_type: "log", message: "x" }, null);
    expect(noKey.status).toBe(400);
    expect((await noKey.json()).error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect((await send(apiKey, { event_type: "llm.call" })).status).toBe(422);
    expect(
      (await send(apiKey, { event_type: "task.completed", task_id: "task_doesnotexist" })).status,
    ).toBe(404);
    expect(
      (await send(apiKey, { event_type: "log", message: "x", agent_id: "agt_someoneelse" })).status,
    ).toBe(403);
    expect(
      (await send(apiKey, { event_type: "log", message: "x", occurred_at: "2030-01-01T00:00:00Z" }))
        .status,
    ).toBe(422);

    // Finishing twice is a conflict.
    const s = await (await send(apiKey, { event_type: "task.started", name: "x" })).json();
    expect(
      (await send(apiKey, { event_type: "task.failed", task_id: s.data.task_id, error: "boom" }))
        .status,
    ).toBe(201);
    expect(
      (await send(apiKey, { event_type: "task.completed", task_id: s.data.task_id })).status,
    ).toBe(409);
    expect((await db.agent.findUniqueOrThrow({ where: { id: agentId } })).status).toBe("FAILED");

    // Rotated keys stop working immediately.
    const next = await rotateAgentApiKey(ctx, agentId);
    expect((await send(apiKey, { event_type: "log", message: "x" })).status).toBe(401);
    expect((await send(next, { event_type: "log", message: "x" })).status).toBe(201);
  });

  it("isolates agents and tenants: a key can't touch another agent's tasks", async () => {
    const a = await setup("Company A");
    const b = await setup("Company B");
    const bTask = await (
      await send(b.apiKey, { event_type: "task.started", name: "secret" })
    ).json();
    const res = await send(a.apiKey, { event_type: "task.completed", task_id: bTask.data.task_id });
    expect(res.status).toBe(404);
    // Reusing B's task id for A's own task is refused (ids are global).
    const clash = await send(a.apiKey, {
      event_type: "task.started",
      name: "x",
      task_id: bTask.data.task_id,
    });
    expect(clash.status).toBe(409);
    expect(await recentActivity(a.ctx)).toHaveLength(0);
    // Same Idempotency-Key in two tenants is independent.
    const key = randomUUID();
    expect((await send(a.apiKey, { event_type: "log", message: "x" }, key)).status).toBe(201);
    expect((await send(b.apiKey, { event_type: "log", message: "x" }, key)).status).toBe(201);
  });

  it("redacts secret-looking metadata keys", async () => {
    const { apiKey } = await setup();
    const res = await (
      await send(apiKey, {
        event_type: "log",
        message: "x",
        metadata: { api_key: "sk-123", region: "in" },
      })
    ).json();
    const ev = await db.executionEvent.findUniqueOrThrow({ where: { id: res.data.event_id } });
    expect(ev.metadata).toEqual({ api_key: "[REDACTED]", region: "in" });
  });
});

describe("heartbeat", () => {
  const beat = (apiKey: string, body: unknown) =>
    postHeartbeat(
      new Request("http://localhost/api/agent/heartbeat", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  it("sets status and liveness; expired heartbeats go OFFLINE (never deleted)", async () => {
    const { apiKey, agentId, ctx } = await setup();
    const res = await beat(apiKey, { status: "WORKING" });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({
      ok: true,
      status: "WORKING",
      next_heartbeat_in_s: 30,
    });
    expect((await db.agent.findUniqueOrThrow({ where: { id: agentId } })).status).toBe("WORKING");

    await sweepStaleAgents(ctx.organizationId, new Date(Date.now() + HEARTBEAT_TIMEOUT_MS - 5000));
    expect((await db.agent.findUniqueOrThrow({ where: { id: agentId } })).status).toBe("WORKING");
    await sweepStaleAgents(ctx.organizationId, new Date(Date.now() + HEARTBEAT_TIMEOUT_MS + 5000));
    expect((await db.agent.findUniqueOrThrow({ where: { id: agentId } })).status).toBe("OFFLINE");
    expect(await db.agent.count({ where: { id: agentId } })).toBe(1);

    expect((await beat(apiKey, { status: "ONLINE", current_task_id: "task_nope" })).status).toBe(
      404,
    );
  });
});
