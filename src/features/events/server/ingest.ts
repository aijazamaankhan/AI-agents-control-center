import "server-only";
import { createHash } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/ids";
import { redact } from "@/lib/logger";
import { Prisma } from "@/generated/prisma/client";
import type { AgentStatus, TaskStatus } from "@/generated/prisma/enums";
import {
  MAX_CLOCK_SKEW_MS,
  MAX_EVENT_AGE_MS,
  type AgentEventInput,
  type HeartbeatInput,
} from "../schemas";
import {
  agentStatusAfter,
  canonicalJson,
  EVENT_TYPE_MAP,
  nextTaskStatus,
  summarize,
  TERMINAL,
} from "../transitions";
import { assertSameAgent, type AgentContext } from "./agent-auth";

export interface IngestResult {
  event_id: string;
  task_id: string | null;
  execution_id: string | null;
  duplicate: boolean;
}

type Tx = Prisma.TransactionClient;

export function payloadHash(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function resolveOccurredAt(value: string | undefined, now: Date): Date {
  if (!value) return now;
  const at = new Date(value);
  if (at.getTime() > now.getTime() + MAX_CLOCK_SKEW_MS) {
    throw new AppError("VALIDATION_ERROR", "occurred_at is in the future.", {
      fieldErrors: { occurred_at: ["Too far in the future"] },
    });
  }
  if (at.getTime() < now.getTime() - MAX_EVENT_AGE_MS) {
    throw new AppError("VALIDATION_ERROR", "occurred_at is older than 7 days.", {
      fieldErrors: { occurred_at: ["Too old"] },
    });
  }
  return at;
}

async function findDuplicate(
  ctx: AgentContext,
  idempotencyKey: string,
  hash: string,
): Promise<IngestResult | null> {
  const existing = await db.executionEvent.findUnique({
    where: {
      organizationId_idempotencyKey: { organizationId: ctx.organizationId, idempotencyKey },
    },
    select: { id: true, taskId: true, executionId: true, payloadHash: true, agentId: true },
  });
  if (!existing) return null;
  if (existing.payloadHash !== hash || existing.agentId !== ctx.agentId) {
    throw new AppError("CONFLICT", "This Idempotency-Key was already used for a different event.");
  }
  return {
    event_id: existing.id,
    task_id: existing.taskId,
    execution_id: existing.executionId,
    duplicate: true,
  };
}

async function activeCounts(tx: Tx, ctx: AgentContext) {
  const rows = await tx.task.groupBy({
    by: ["status"],
    where: {
      organizationId: ctx.organizationId,
      agentId: ctx.agentId,
      status: { in: ["RUNNING", "WAITING"] },
    },
    _count: { _all: true },
  });
  const get = (s: TaskStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return { running: get("RUNNING"), waiting: get("WAITING") };
}

/**
 * Records one agent event exactly once. Everything — task row, counters, event and
 * agent status — is written in a single transaction, so a retry after a failure
 * either finds the committed event (duplicate) or redoes all of it.
 */
export async function ingestEvent(
  ctx: AgentContext,
  idempotencyKey: string,
  input: AgentEventInput,
): Promise<IngestResult> {
  assertSameAgent(ctx, input.agent_id);
  const hash = payloadHash(input);
  const duplicate = await findDuplicate(ctx, idempotencyKey, hash);
  if (duplicate) return duplicate;

  const now = new Date();
  const occurredAt = resolveOccurredAt(input.occurred_at, now);
  const type = EVENT_TYPE_MAP[input.event_type];
  const metadata = redact(input.metadata ?? {}) as Prisma.InputJsonValue;

  try {
    return await db.$transaction(async (tx) => {
      let taskId: string | null = null;
      let executionId: string | null = null;
      let taskName: string | null = null;

      if (input.event_type === "task.started") {
        taskId = input.task_id ?? newId("task");
        if (await tx.task.findUnique({ where: { id: taskId }, select: { id: true } })) {
          throw new AppError("CONFLICT", "A task with this task_id already exists.");
        }
        executionId = newId("execution");
        taskName = input.name;
        await tx.task.create({
          data: {
            id: taskId,
            organizationId: ctx.organizationId,
            agentId: ctx.agentId,
            departmentId: ctx.departmentId,
            name: input.name,
            description: input.description ?? "",
            status: "RUNNING",
            startedAt: occurredAt,
          },
        });
        await tx.execution.create({
          data: {
            id: executionId,
            organizationId: ctx.organizationId,
            agentId: ctx.agentId,
            taskId,
            status: "RUNNING",
            startedAt: occurredAt,
          },
        });
      } else if (input.task_id) {
        const task = await tx.task.findFirst({
          where: { id: input.task_id, organizationId: ctx.organizationId, agentId: ctx.agentId },
          select: { id: true, name: true, status: true, startedAt: true },
        });
        if (!task) throw new AppError("RESOURCE_NOT_FOUND", "Task not found for this agent.");
        taskId = task.id;
        taskName = task.name;

        const execution = input.execution_id
          ? await tx.execution.findFirst({
              where: { id: input.execution_id, taskId: task.id },
              select: { id: true },
            })
          : await tx.execution.findFirst({
              where: { taskId: task.id },
              orderBy: { startedAt: "desc" },
              select: { id: true },
            });
        if (input.execution_id && !execution)
          throw new AppError("RESOURCE_NOT_FOUND", "Execution not found for this task.");
        executionId = execution?.id ?? null;

        const next = nextTaskStatus(task.status, type);
        if (typeof next === "object") throw new AppError("CONFLICT", next.error);

        const data: Prisma.TaskUpdateInput = {};
        if (next !== task.status) data.status = next;
        if (input.event_type === "llm.call") {
          data.inputTokens = { increment: input.input_tokens };
          data.outputTokens = { increment: input.output_tokens };
          data.cachedTokens = { increment: input.cached_tokens };
          data.llmCalls = { increment: 1 };
        }
        if (input.event_type === "tool.call") data.toolCalls = { increment: 1 };
        if (TERMINAL.includes(next) && !TERMINAL.includes(task.status)) {
          data.completedAt = occurredAt;
          data.durationMs = Math.max(0, occurredAt.getTime() - task.startedAt.getTime());
          if (input.event_type === "task.completed" && input.result !== undefined) {
            data.result = redact(input.result) as Prisma.InputJsonValue;
          }
          if (input.event_type === "task.failed") data.error = input.error ?? "Failed";
          if (executionId) {
            await tx.execution.update({
              where: { id: executionId },
              data: { status: next, completedAt: occurredAt },
            });
          }
        }
        if (Object.keys(data).length) await tx.task.update({ where: { id: task.id }, data });
      } else if (["task.completed", "task.failed", "task.cancelled"].includes(input.event_type)) {
        throw new AppError("VALIDATION_ERROR", "task_id is required for this event.");
      }

      const event = await tx.executionEvent.create({
        data: {
          id: newId("event"),
          organizationId: ctx.organizationId,
          agentId: ctx.agentId,
          departmentId: ctx.departmentId,
          taskId,
          executionId,
          type,
          idempotencyKey,
          payloadHash: hash,
          occurredAt,
          provider: input.event_type === "llm.call" ? input.provider : null,
          model: input.event_type === "llm.call" ? input.model : null,
          inputTokens: input.event_type === "llm.call" ? input.input_tokens : 0,
          outputTokens: input.event_type === "llm.call" ? input.output_tokens : 0,
          cachedTokens: input.event_type === "llm.call" ? input.cached_tokens : 0,
          latencyMs: "latency_ms" in input ? (input.latency_ms ?? null) : null,
          toolName: input.event_type === "tool.call" ? input.tool_name : null,
          success: input.event_type === "tool.call" ? input.success : null,
          summary: summarize({
            type,
            taskName,
            provider: input.event_type === "llm.call" ? input.provider : null,
            model: input.event_type === "llm.call" ? input.model : null,
            inputTokens: input.event_type === "llm.call" ? input.input_tokens : 0,
            outputTokens: input.event_type === "llm.call" ? input.output_tokens : 0,
            toolName: input.event_type === "tool.call" ? input.tool_name : null,
            success: input.event_type === "tool.call" ? input.success : null,
            action: input.event_type === "approval.requested" ? input.action : undefined,
            message: input.event_type === "log" ? input.message : undefined,
            error: input.event_type === "task.failed" ? input.error : null,
          }),
          metadata,
        },
        select: { id: true },
      });

      // Any authenticated event proves the agent is alive.
      const status: AgentStatus = agentStatusAfter(type, await activeCounts(tx, ctx));
      await tx.agent.update({
        where: { id: ctx.agentId },
        data: { status, lastActiveAt: now, lastHeartbeatAt: now },
      });

      return { event_id: event.id, task_id: taskId, execution_id: executionId, duplicate: false };
    });
  } catch (err) {
    // Two concurrent deliveries of the same event: the loser returns the winner's result.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const dup = await findDuplicate(ctx, idempotencyKey, hash);
      if (dup) return dup;
    }
    throw err;
  }
}

export const HEARTBEAT_INTERVAL_S = 30;
/** No heartbeat or event for this long → the agent is shown OFFLINE (never deleted or failed). */
export const HEARTBEAT_TIMEOUT_MS = 120_000;

export async function recordHeartbeat(ctx: AgentContext, input: HeartbeatInput) {
  assertSameAgent(ctx, input.agent_id);
  if (input.current_task_id) {
    const task = await db.task.findFirst({
      where: {
        id: input.current_task_id,
        organizationId: ctx.organizationId,
        agentId: ctx.agentId,
      },
      select: { id: true },
    });
    if (!task)
      throw new AppError("RESOURCE_NOT_FOUND", "current_task_id not found for this agent.");
  }
  const now = new Date();
  await db.agent.update({
    where: { id: ctx.agentId },
    data: { status: input.status, lastHeartbeatAt: now },
  });
  return {
    ok: true,
    status: input.status,
    received_at: now.toISOString(),
    next_heartbeat_in_s: HEARTBEAT_INTERVAL_S,
  };
}

/** Marks agents whose heartbeat expired as OFFLINE. Cheap, indexed; safe to call often. */
export async function sweepStaleAgents(organizationId: string, now = new Date()) {
  await db.agent.updateMany({
    where: {
      organizationId,
      status: { notIn: ["OFFLINE", "DISCONNECTED"] },
      OR: [
        { lastHeartbeatAt: null },
        { lastHeartbeatAt: { lt: new Date(now.getTime() - HEARTBEAT_TIMEOUT_MS) } },
      ],
    },
    data: { status: "OFFLINE" },
  });
}
