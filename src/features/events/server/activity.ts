import "server-only";
import type { OrgContext } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { startOfDayInTimeZone } from "@/lib/time";
import type { ExecutionEventType } from "@/generated/prisma/enums";

export interface ActivityItem {
  id: string;
  at: string;
  type: ExecutionEventType;
  agentId: string;
  agentName: string;
  departmentId: string;
  departmentName: string;
  taskId: string | null;
  summary: string;
  tokens: number;
  toolName: string | null;
  taskName: string | null;
}

/** Recent events for the org (optionally one agent), newest first, with display names. */
export async function recentActivity(
  ctx: OrgContext,
  opts: { agentId?: string; limit?: number; since?: Date } = {},
): Promise<ActivityItem[]> {
  const events = await db.executionEvent.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(opts.agentId ? { agentId: opts.agentId } : {}),
      ...(opts.since ? { receivedAt: { gte: opts.since } } : {}),
    },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take: Math.min(opts.limit ?? 30, 200),
    select: {
      id: true,
      receivedAt: true,
      type: true,
      agentId: true,
      departmentId: true,
      taskId: true,
      summary: true,
      inputTokens: true,
      outputTokens: true,
      cachedTokens: true,
      toolName: true,
      task: { select: { name: true } },
    },
  });
  if (!events.length) return [];
  const [agents, departments] = await Promise.all([
    db.agent.findMany({
      where: {
        organizationId: ctx.organizationId,
        id: { in: [...new Set(events.map((e) => e.agentId))] },
      },
      select: { id: true, name: true },
    }),
    db.department.findMany({
      where: {
        organizationId: ctx.organizationId,
        id: { in: [...new Set(events.map((e) => e.departmentId))] },
      },
      select: { id: true, name: true },
    }),
  ]);
  const agentName = new Map(agents.map((a) => [a.id, a.name]));
  const depName = new Map(departments.map((d) => [d.id, d.name]));
  return events.map((e) => ({
    id: e.id,
    at: e.receivedAt.toISOString(),
    type: e.type,
    agentId: e.agentId,
    agentName: agentName.get(e.agentId) ?? "Deleted agent",
    departmentId: e.departmentId,
    departmentName: depName.get(e.departmentId) ?? "—",
    taskId: e.taskId,
    summary: e.summary,
    tokens: e.inputTokens + e.outputTokens + e.cachedTokens,
    toolName: e.toolName,
    taskName: e.task?.name ?? null,
  }));
}

export async function listTasks(ctx: OrgContext, opts: { agentId?: string; limit?: number } = {}) {
  return db.task.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(opts.agentId ? { agentId: opts.agentId } : {}),
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: Math.min(opts.limit ?? 50, 200),
    select: {
      id: true,
      name: true,
      status: true,
      startedAt: true,
      completedAt: true,
      durationMs: true,
      inputTokens: true,
      outputTokens: true,
      cachedTokens: true,
      llmCalls: true,
      toolCalls: true,
      error: true,
    },
  });
}

/** Today's task + token totals (org timezone), from task counters — not a raw event scan. */
export async function todayStats(
  ctx: OrgContext,
  timeZone: string,
  filter: { agentId?: string; departmentId?: string } = {},
) {
  const since = startOfDayInTimeZone(new Date(), timeZone);
  const where = { organizationId: ctx.organizationId, startedAt: { gte: since }, ...filter };
  const [agg, byStatus] = await Promise.all([
    db.task.aggregate({
      where,
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, cachedTokens: true },
    }),
    db.task.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);
  const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const completed = count("COMPLETED");
  const failed = count("FAILED");
  const input = Number(agg._sum.inputTokens ?? 0);
  const output = Number(agg._sum.outputTokens ?? 0);
  const cached = Number(agg._sum.cachedTokens ?? 0);
  return {
    tasks: agg._count._all,
    completed,
    failed,
    running: count("RUNNING") + count("WAITING"),
    tokens: input + output + cached,
    inputTokens: input,
    outputTokens: output,
    cachedTokens: cached,
    successRate: completed + failed > 0 ? completed / (completed + failed) : null,
  };
}

/** Average LLM latency today for one agent (indexed by org + agent + occurred_at). */
export async function avgLlmLatencyToday(
  ctx: OrgContext,
  agentId: string,
  timeZone: string,
): Promise<number | null> {
  const agg = await db.executionEvent.aggregate({
    where: {
      organizationId: ctx.organizationId,
      agentId,
      type: "LLM_CALL",
      occurredAt: { gte: startOfDayInTimeZone(new Date(), timeZone) },
      latencyMs: { not: null },
    },
    _avg: { latencyMs: true },
  });
  return agg._avg.latencyMs === null ? null : Math.round(agg._avg.latencyMs);
}

/** Name of each agent's most recent active task, for the live map. */
export async function activeTaskNames(ctx: OrgContext): Promise<Record<string, string>> {
  const tasks = await db.task.findMany({
    where: { organizationId: ctx.organizationId, status: { in: ["RUNNING", "WAITING"] } },
    orderBy: { startedAt: "desc" },
    select: { agentId: true, name: true },
    take: 500,
  });
  const out: Record<string, string> = {};
  for (const t of tasks) out[t.agentId] ??= t.name;
  return out;
}
