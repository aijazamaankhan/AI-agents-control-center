import { describe, expect, it, vi } from "vitest";
import { agentEventSchema, heartbeatSchema } from "@/features/events/schemas";
import {
  agentStatusAfter,
  canonicalJson,
  nextTaskStatus,
  summarize,
} from "@/features/events/transitions";
import {
  applyActivity,
  mapStatus,
  toActivityEvent,
  type StreamActivity,
} from "@/features/workforce/live";
import { startOfDayInTimeZone } from "@/lib/time";
import { AgentOS, AgentOSError } from "@/sdk";

describe("event schemas", () => {
  it("accepts the documented llm.call payload", () => {
    const e = agentEventSchema.parse({
      event_type: "llm.call",
      agent_id: "agt_xxx",
      task_id: "task_xxx",
      provider: "anthropic",
      model: "claude-sonnet",
      input_tokens: 12430,
      output_tokens: 2840,
      latency_ms: 1820,
      occurred_at: "2026-10-05T10:42:13Z",
    });
    expect(e).toMatchObject({ event_type: "llm.call", cached_tokens: 0 });
  });

  it("rejects bad token counts, unknown types and oversized metadata", () => {
    const base = { event_type: "llm.call", provider: "x", model: "y", output_tokens: 1 };
    expect(agentEventSchema.safeParse({ ...base, input_tokens: -1 }).success).toBe(false);
    expect(agentEventSchema.safeParse({ ...base, input_tokens: 1.5 }).success).toBe(false);
    expect(agentEventSchema.safeParse({ event_type: "teleport" }).success).toBe(false);
    expect(
      agentEventSchema.safeParse({ ...base, input_tokens: 1, metadata: { blob: "x".repeat(5000) } })
        .success,
    ).toBe(false);
  });

  it("requires task_id to finish a task and validates client task ids", () => {
    expect(agentEventSchema.safeParse({ event_type: "task.completed" }).success).toBe(false);
    expect(
      agentEventSchema.safeParse({ event_type: "task.started", name: "x", task_id: "nope" })
        .success,
    ).toBe(false);
    expect(
      agentEventSchema.safeParse({
        event_type: "task.started",
        name: "x",
        task_id: "task_ABCDEF123",
      }).success,
    ).toBe(true);
  });

  it("defaults heartbeat status to ONLINE", () => {
    expect(heartbeatSchema.parse({}).status).toBe("ONLINE");
    expect(heartbeatSchema.safeParse({ status: "DANCING" }).success).toBe(false);
  });
});

describe("task status transitions", () => {
  it("finishes running or waiting tasks once", () => {
    expect(nextTaskStatus("RUNNING", "TASK_COMPLETED")).toBe("COMPLETED");
    expect(nextTaskStatus("WAITING", "TASK_FAILED")).toBe("FAILED");
    expect(nextTaskStatus("RUNNING", "TASK_CANCELLED")).toBe("CANCELLED");
    expect(nextTaskStatus("COMPLETED", "TASK_COMPLETED")).toEqual({
      error: "Task is already completed.",
    });
    expect(nextTaskStatus("FAILED", "TASK_COMPLETED")).toHaveProperty("error");
  });

  it("waits for approval and resumes on further work", () => {
    expect(nextTaskStatus("RUNNING", "APPROVAL_REQUESTED")).toBe("WAITING");
    expect(nextTaskStatus("WAITING", "LLM_CALL")).toBe("RUNNING");
    expect(nextTaskStatus("WAITING", "TOOL_CALL")).toBe("RUNNING");
  });

  it("accepts late calls on finished tasks without reopening them", () => {
    expect(nextTaskStatus("COMPLETED", "LLM_CALL")).toBe("COMPLETED");
    expect(nextTaskStatus("CANCELLED", "APPROVAL_REQUESTED")).toBe("CANCELLED");
  });

  it("derives agent status considering other active tasks", () => {
    expect(agentStatusAfter("TASK_STARTED", { running: 1, waiting: 0 })).toBe("WORKING");
    expect(agentStatusAfter("TASK_COMPLETED", { running: 0, waiting: 0 })).toBe("ONLINE");
    expect(agentStatusAfter("TASK_COMPLETED", { running: 2, waiting: 0 })).toBe("WORKING");
    expect(agentStatusAfter("TASK_COMPLETED", { running: 0, waiting: 1 })).toBe("WAITING");
    expect(agentStatusAfter("TASK_FAILED", { running: 3, waiting: 0 })).toBe("FAILED");
    expect(agentStatusAfter("APPROVAL_REQUESTED", { running: 0, waiting: 1 })).toBe("WAITING");
  });
});

describe("canonicalJson", () => {
  it("is independent of key order and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe(
      canonicalJson({ a: { d: [1, { x: 1, y: 2 }] }, b: 1 }),
    );
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });
});

describe("summarize", () => {
  it("never includes prompts or results — only safe descriptors", () => {
    expect(
      summarize({
        type: "LLM_CALL",
        model: "Claude Sonnet",
        inputTokens: 12430,
        outputTokens: 2840,
      }),
    ).toBe("Claude Sonnet · 12,430 in / 2,840 out");
    expect(summarize({ type: "TOOL_CALL", toolName: "web_search", success: false })).toBe(
      "Called web_search (failed)",
    );
    expect(summarize({ type: "TASK_STARTED", taskName: "Find leads" })).toBe(
      'Started task "Find leads"',
    );
  });
});

describe("startOfDayInTimeZone", () => {
  it("finds local midnight as a UTC instant", () => {
    const at = new Date("2026-10-05T04:00:00Z");
    expect(startOfDayInTimeZone(at, "UTC").toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(startOfDayInTimeZone(at, "Asia/Kolkata").toISOString()).toBe("2026-10-04T18:30:00.000Z");
    // 04:00Z is still Oct 4 in Los Angeles (PDT, UTC-7).
    expect(startOfDayInTimeZone(at, "America/Los_Angeles").toISOString()).toBe(
      "2026-10-04T07:00:00.000Z",
    );
    expect(startOfDayInTimeZone(at, "Not/AZone").toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
});

describe("live map mapping", () => {
  const rt = {
    status: "IDLE" as const,
    stage: null,
    task: null,
    tool: null,
    tokens: 0,
    cost: 0,
    completed: 0,
    failed: 0,
  };
  const ev = (type: string, extra: Partial<StreamActivity> = {}): StreamActivity => ({
    id: "evt_1",
    at: "2026-10-05T10:00:00Z",
    type,
    agentId: "agt_1",
    agentName: "A",
    departmentId: "dep_1",
    departmentName: "Sales",
    taskId: "task_1",
    summary: "s",
    tokens: 0,
    toolName: null,
    taskName: "Find leads",
    ...extra,
  });

  it("walks the runtime through a task", () => {
    let r = applyActivity(rt, ev("TASK_STARTED"));
    expect(r).toMatchObject({ status: "WORKING", stage: "start", task: "Find leads" });
    r = applyActivity(r, ev("LLM_CALL", { tokens: 100 }));
    expect(r).toMatchObject({ stage: "llm", tokens: 100 });
    r = applyActivity(r, ev("TOOL_CALL", { toolName: "web_search" }));
    expect(r).toMatchObject({ stage: "tool", tool: "web_search" });
    r = applyActivity(r, ev("APPROVAL_REQUESTED"));
    expect(r.status).toBe("WAITING");
    r = applyActivity(r, ev("TASK_COMPLETED"));
    expect(r).toMatchObject({ status: "IDLE", stage: null, completed: 1 });
  });

  it("maps server statuses and events", () => {
    expect(mapStatus("ONLINE")).toBe("IDLE");
    expect(mapStatus("DISCONNECTED")).toBe("OFFLINE");
    expect(toActivityEvent(ev("LLM_CALL", { tokens: 5 }))).toMatchObject({
      kind: "llm.call",
      tokens: 5,
    });
  });
});

describe("SDK", () => {
  function fakeFetch(responses: Array<{ status: number; body?: unknown } | Error>) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error("no more responses");
      if (next instanceof Error) throw next;
      return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
    });
    return { fn: fn as unknown as typeof fetch, calls };
  }
  const ok = (data: object) => ({ status: 201, body: { data } });

  it("sends authenticated events with an Idempotency-Key and tracks the current task", async () => {
    const f = fakeFetch([
      ok({ event_id: "evt_1", task_id: "task_1", execution_id: "exec_1", duplicate: false }),
      ok({ event_id: "evt_2", task_id: "task_1", execution_id: "exec_1", duplicate: false }),
      ok({ event_id: "evt_3", task_id: "task_1", execution_id: "exec_1", duplicate: false }),
    ]);
    const sdk = new AgentOS({ apiKey: "aos_live_k", baseUrl: "http://x/", fetch: f.fn });
    const task = await sdk.task.start({ name: "Find SaaS leads" });
    expect(task.id).toBe("task_1");
    await sdk.llm.call({
      provider: "anthropic",
      model: "claude-sonnet",
      inputTokens: 12430,
      outputTokens: 2840,
    });
    await sdk.task.complete({ result: { leadsFound: 47 } });

    expect(f.calls[0]!.url).toBe("http://x/api/agent-events");
    const headers = f.calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer aos_live_k");
    expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    const llm = JSON.parse(f.calls[1]!.init.body as string);
    expect(llm).toMatchObject({
      event_type: "llm.call",
      task_id: "task_1",
      input_tokens: 12430,
      cached_tokens: 0,
    });
    expect(llm.occurred_at).toBeTruthy();
    expect(JSON.parse(f.calls[2]!.init.body as string)).toMatchObject({
      event_type: "task.completed",
      task_id: "task_1",
    });
  });

  it("retries network errors and 5xx with the SAME key and body (no double counting)", async () => {
    const f = fakeFetch([
      new Error("ECONNRESET"),
      { status: 503 },
      ok({ event_id: "evt_1", task_id: null, execution_id: null, duplicate: false }),
    ]);
    const sdk = new AgentOS({ apiKey: "k", fetch: f.fn, maxRetries: 3 });
    await sdk.tool.call({ name: "web_search" });
    expect(f.calls).toHaveLength(3);
    const keys = f.calls.map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"]);
    expect(new Set(keys).size).toBe(1);
    expect(new Set(f.calls.map((c) => c.init.body)).size).toBe(1);
  });

  it("does not retry client errors and surfaces the API error", async () => {
    const f = fakeFetch([
      { status: 401, body: { error: { code: "UNAUTHENTICATED", message: "Invalid key" } } },
    ]);
    const sdk = new AgentOS({ apiKey: "k", fetch: f.fn });
    const err = await sdk.tool.call({ name: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(AgentOSError);
    expect(err).toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(f.calls).toHaveLength(1);
  });

  it("requires an api key and a task for task-scoped calls", async () => {
    expect(() => new AgentOS({ apiKey: "" })).toThrow();
    const sdk = new AgentOS({ apiKey: "k", fetch: fakeFetch([]).fn });
    await expect(sdk.task.complete()).rejects.toThrow(/no taskId/);
  });
});
