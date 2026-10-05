import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as postEvent } from "@/app/api/agent-events/route";
import { agentSchema } from "@/features/agents/schemas";
import { createAgent } from "@/features/agents/server/agent-service";
import { createDepartment } from "@/features/departments/server/department-service";
import { taskFiltersSchema } from "@/features/tasks/schemas";
import {
  agentHealthMap,
  getTaskTrace,
  globalSearch,
  searchTasks,
} from "@/features/tasks/server/task-service";
import { createTenant } from "../support/factories";

async function setup(name = "Acme") {
  const t = await createTenant(name);
  const sales = await createDepartment(t.ctx, { name: "Sales", description: "" });
  const ops = await createDepartment(t.ctx, { name: "Operations", description: "" });
  const make = (agentName: string, departmentId: string) =>
    createAgent(
      t.ctx,
      agentSchema.parse({
        name: agentName,
        departmentId,
        provider: "Anthropic",
        model: "Claude Sonnet",
        connectionType: "SDK",
      }),
    );
  const a1 = await make("Lead Research Agent", sales.id);
  const a2 = await make("Vendor Monitor", ops.id);
  return { ...t, sales, ops, a1, a2 };
}

async function send(apiKey: string, body: unknown) {
  const res = await postEvent(
    new Request("http://localhost/api/agent-events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": randomUUID(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
  return (await res.json()).data;
}

async function runTask(
  apiKey: string,
  name: string,
  provider: string,
  model: string,
  outcome: "completed" | "failed",
) {
  const t = await send(apiKey, { event_type: "task.started", name });
  await send(apiKey, {
    event_type: "llm.call",
    task_id: t.task_id,
    provider,
    model,
    input_tokens: 100,
    output_tokens: 50,
    latency_ms: 800,
  });
  await send(apiKey, { event_type: "tool.call", task_id: t.task_id, tool_name: "web_search" });
  await send(
    apiKey,
    outcome === "completed"
      ? { event_type: "task.completed", task_id: t.task_id }
      : { event_type: "task.failed", task_id: t.task_id, error: "boom" },
  );
  return t.task_id as string;
}

const f = (v: Record<string, string> = {}) => taskFiltersSchema.parse(v);

describe("tasks (Phase 5)", () => {
  it("filters by department, agent, status, provider, model and search text", async () => {
    const { ctx, a1, a2, sales } = await setup();
    const t1 = await runTask(
      a1.apiKey,
      "Find SaaS leads",
      "anthropic",
      "claude-sonnet",
      "completed",
    );
    await runTask(a1.apiKey, "Enrich accounts", "openai", "gpt-5", "failed");
    await runTask(a2.apiKey, "Check vendor SLAs", "anthropic", "claude-haiku", "completed");

    expect((await searchTasks(ctx, f(), "UTC")).total).toBe(3);
    expect((await searchTasks(ctx, f({ department: sales.id }), "UTC")).total).toBe(2);
    expect((await searchTasks(ctx, f({ agent: a2.id }), "UTC")).tasks[0]!.name).toBe(
      "Check vendor SLAs",
    );
    expect(
      (await searchTasks(ctx, f({ status: "FAILED" }), "UTC")).tasks.map((t) => t.name),
    ).toEqual(["Enrich accounts"]);
    expect((await searchTasks(ctx, f({ provider: "ANTHROPIC" }), "UTC")).total).toBe(2);
    expect((await searchTasks(ctx, f({ model: "gpt-5" }), "UTC")).total).toBe(1);
    expect((await searchTasks(ctx, f({ q: "saas" }), "UTC")).tasks[0]!.id).toBe(t1);
    expect((await searchTasks(ctx, f({ q: t1 }), "UTC")).total).toBe(1);
    expect((await searchTasks(ctx, f({ range: "today" }), "UTC")).total).toBe(3);
    const row = (await searchTasks(ctx, f({ q: t1 }), "UTC")).tasks[0]!;
    expect(row).toMatchObject({
      departmentName: "Sales",
      tokens: 150,
      agent: { name: "Lead Research Agent" },
    });
  });

  it("returns an ordered execution trace and hides other tenants' tasks", async () => {
    const a = await setup("Company A");
    const b = await setup("Company B");
    const id = await runTask(
      a.a1.apiKey,
      "Find SaaS leads",
      "anthropic",
      "claude-sonnet",
      "completed",
    );
    const trace = await getTaskTrace(a.ctx, id);
    expect(trace.events.map((e) => e.type)).toEqual([
      "TASK_STARTED",
      "LLM_CALL",
      "TOOL_CALL",
      "TASK_COMPLETED",
    ]);
    expect(trace).toMatchObject({
      status: "COMPLETED",
      inputTokens: 100,
      outputTokens: 50,
      department: { name: "Sales" },
    });
    expect(typeof trace.inputTokens).toBe("number"); // serializable for client components
    await expect(getTaskTrace(b.ctx, id)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect((await searchTasks(b.ctx, f(), "UTC")).total).toBe(0);
  });

  it("computes health per agent from real outcomes", async () => {
    const { ctx, a1, a2 } = await setup();
    await runTask(a1.apiKey, "t1", "anthropic", "claude-sonnet", "completed");
    for (let i = 0; i < 3; i++)
      await runTask(a2.apiKey, `fail ${i}`, "anthropic", "claude-sonnet", "failed");
    const health = await agentHealthMap(ctx);
    expect(health[a1.id]!.health).toBe("HEALTHY");
    expect(health[a2.id]!.health).toBe("CRITICAL");
    expect(health[a2.id]!.reasons).toContain("3 consecutive failed tasks");
  });

  it("global search finds agents, departments and tasks only within the org", async () => {
    const a = await setup("Company A");
    const b = await setup("Company B");
    await runTask(a.a1.apiKey, "Find SaaS leads", "anthropic", "claude-sonnet", "completed");
    const r = await globalSearch(a.ctx, "lead");
    expect(r.agents.map((x) => x.name)).toEqual(["Lead Research Agent"]);
    expect(r.tasks.map((x) => x.name)).toEqual(["Find SaaS leads"]);
    expect((await globalSearch(a.ctx, "sales")).departments).toHaveLength(1);
    expect((await globalSearch(b.ctx, "Find SaaS")).tasks).toHaveLength(0);
    expect((await globalSearch(a.ctx, "x")).agents).toEqual([]); // < 2 chars
  });
});
