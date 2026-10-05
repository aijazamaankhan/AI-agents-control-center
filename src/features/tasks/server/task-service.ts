import "server-only";
import { AppError } from "@/lib/api/errors";
import type { OrgContext } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { startOfDayInTimeZone } from "@/lib/time";
import type { Prisma } from "@/generated/prisma/client";
import { computeHealth, failureStreak } from "../health";
import type { TaskFilters } from "../schemas";

export const PAGE_SIZE = 25;

function rangeStart(range: TaskFilters["range"], timeZone: string): Date | undefined {
  const now = new Date();
  if (range === "all") return undefined;
  const today = startOfDayInTimeZone(now, timeZone);
  if (range === "today") return today;
  return new Date(today.getTime() - (range === "7d" ? 6 : 29) * 86_400_000);
}

/** Org-scoped task search. Provider/model match tasks that made at least one such LLM call. */
export async function searchTasks(ctx: OrgContext, filters: TaskFilters, timeZone: string) {
  const since = rangeStart(filters.range, timeZone);
  const llmFilter: Prisma.ExecutionEventWhereInput | null =
    filters.provider || filters.model
      ? {
          type: "LLM_CALL",
          ...(filters.provider
            ? { provider: { equals: filters.provider, mode: "insensitive" } }
            : {}),
          ...(filters.model ? { model: { equals: filters.model, mode: "insensitive" } } : {}),
        }
      : null;
  const where: Prisma.TaskWhereInput = {
    organizationId: ctx.organizationId,
    ...(filters.department ? { departmentId: filters.department } : {}),
    ...(filters.agent ? { agentId: filters.agent } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(since ? { startedAt: { gte: since } } : {}),
    ...(filters.q
      ? { OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { id: filters.q }] }
      : {}),
    ...(llmFilter ? { events: { some: llmFilter } } : {}),
  };

  const [rows, total] = await Promise.all([
    db.task.findMany({
      where,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
        departmentId: true,
        agent: { select: { id: true, name: true, provider: true } },
      },
    }),
    db.task.count({ where }),
  ]);

  const depNames = new Map(
    (
      await db.department.findMany({
        where: {
          organizationId: ctx.organizationId,
          id: { in: [...new Set(rows.map((r) => r.departmentId))] },
        },
        select: { id: true, name: true },
      })
    ).map((d) => [d.id, d.name]),
  );

  return {
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    tasks: rows.map((r) => ({
      ...r,
      departmentName: depNames.get(r.departmentId) ?? "—",
      tokens: Number(r.inputTokens + r.outputTokens + r.cachedTokens),
    })),
  };
}

/** Distinct providers/models this org has used (for filter dropdowns). */
export async function usedModels(ctx: OrgContext) {
  const rows = await db.executionEvent.findMany({
    where: { organizationId: ctx.organizationId, type: "LLM_CALL" },
    distinct: ["provider", "model"],
    select: { provider: true, model: true },
    take: 200,
  });
  return {
    providers: [...new Set(rows.map((r) => r.provider).filter(Boolean))].sort() as string[],
    models: [...new Set(rows.map((r) => r.model).filter(Boolean))].sort() as string[],
  };
}

/** A task with its full execution trace — events in order, scoped to the caller's org. */
export async function getTaskTrace(ctx: OrgContext, id: string) {
  const task = await db.task.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      agent: { select: { id: true, name: true, provider: true, model: true } },
      executions: {
        orderBy: { startedAt: "asc" },
        select: { id: true, status: true, startedAt: true, completedAt: true },
      },
      events: {
        orderBy: [{ occurredAt: "asc" }, { receivedAt: "asc" }],
        select: {
          id: true,
          type: true,
          occurredAt: true,
          receivedAt: true,
          provider: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          cachedTokens: true,
          latencyMs: true,
          toolName: true,
          success: true,
          summary: true,
          metadata: true,
          executionId: true,
        },
      },
    },
  });
  if (!task) throw new AppError("RESOURCE_NOT_FOUND", "Task not found");
  const department = await db.department.findFirst({
    where: { id: task.departmentId, organizationId: ctx.organizationId },
    select: { id: true, name: true },
  });
  const running = task.status === "RUNNING" || task.status === "WAITING";
  return {
    ...task,
    /** Final duration, or time elapsed so far for a task still in progress. */
    elapsedMs: task.durationMs ?? (running ? Date.now() - task.startedAt.getTime() : null),
    inputTokens: Number(task.inputTokens),
    outputTokens: Number(task.outputTokens),
    cachedTokens: Number(task.cachedTokens),
    department,
  };
}

/** Health for every agent in the org (last 24 h), keyed by agent id. */
export async function agentHealthMap(ctx: OrgContext) {
  const since = new Date(Date.now() - 86_400_000);
  const [agents, byStatus, recent, latency] = await Promise.all([
    db.agent.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, status: true, lastHeartbeatAt: true },
    }),
    db.task.groupBy({
      by: ["agentId", "status"],
      where: { organizationId: ctx.organizationId, startedAt: { gte: since } },
      _count: { _all: true },
    }),
    // Newest finished tasks per org (bounded) to compute failure streaks.
    db.task.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["COMPLETED", "FAILED", "CANCELLED"] },
      },
      orderBy: { completedAt: "desc" },
      take: 500,
      select: { agentId: true, status: true },
    }),
    db.executionEvent.groupBy({
      by: ["agentId"],
      where: {
        organizationId: ctx.organizationId,
        type: "LLM_CALL",
        occurredAt: { gte: since },
        latencyMs: { not: null },
      },
      _avg: { latencyMs: true },
    }),
  ]);
  const out: Record<string, ReturnType<typeof computeHealth>> = {};
  for (const a of agents) {
    const count = (s: string) =>
      byStatus.find((r) => r.agentId === a.id && r.status === s)?._count._all ?? 0;
    out[a.id] = computeHealth({
      status: a.status,
      lastHeartbeatAt: a.lastHeartbeatAt,
      completed: count("COMPLETED"),
      failed: count("FAILED"),
      failureStreak: failureStreak(recent.filter((r) => r.agentId === a.id).map((r) => r.status)),
      avgLatencyMs: latency.find((l) => l.agentId === a.id)?._avg.latencyMs ?? null,
    });
  }
  return out;
}

/** Global search across agents, departments and tasks (org-scoped, case-insensitive). */
export async function globalSearch(ctx: OrgContext, rawQuery: string) {
  const q = rawQuery.trim().slice(0, 100);
  if (q.length < 2) return { q, agents: [], departments: [], tasks: [] };
  const contains = { contains: q, mode: "insensitive" as const };
  const [agents, departments, tasks] = await Promise.all([
    db.agent.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [{ name: contains }, { id: q }, { model: contains }],
      },
      select: { id: true, name: true, provider: true, model: true, status: true },
      take: 10,
    }),
    db.department.findMany({
      where: { organizationId: ctx.organizationId, OR: [{ name: contains }, { id: q }] },
      select: { id: true, name: true, description: true },
      take: 10,
    }),
    db.task.findMany({
      where: { organizationId: ctx.organizationId, OR: [{ name: contains }, { id: q }] },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        startedAt: true,
        agent: { select: { name: true } },
      },
      take: 10,
    }),
  ]);
  return { q, agents, departments, tasks };
}
