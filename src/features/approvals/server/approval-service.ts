import "server-only";
import { createHash } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import type { OrgContext, RequestMeta } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/security/audit";
import { assertPermission } from "@/lib/security/permissions";
import type { Prisma } from "@/generated/prisma/client";
import type { ApprovalRisk, ApprovalStatus } from "@/generated/prisma/enums";
import type { AgentContext } from "@/features/events/server/agent-auth";
import { matchCapability, policyOutcome } from "../policy";

type Tx = Prisma.TransactionClient;

export interface ApprovalRequest {
  eventId: string;
  organizationId: string;
  agentId: string;
  departmentId: string;
  taskId: string | null;
  action: string;
  capability?: string;
  reason?: string;
  risk?: "low" | "medium" | "high";
  requestedAt: Date;
}

/**
 * Creates the approval for an `approval.requested` event (inside the ingest transaction).
 * The agent's capability rules decide immediately when they can: ALLOWED → approved,
 * DENIED → rejected; otherwise it waits for a person.
 */
export async function recordApprovalRequest(tx: Tx, r: ApprovalRequest) {
  const capabilities = await tx.agentCapability.findMany({
    where: { organizationId: r.organizationId, agentId: r.agentId },
    select: { key: true, label: true, rule: true },
  });
  const match = matchCapability(r.action, r.capability, capabilities);
  const outcome = policyOutcome(match);
  const auto = outcome !== "PENDING";
  return tx.approval.create({
    data: {
      id: newId("approval"),
      organizationId: r.organizationId,
      agentId: r.agentId,
      departmentId: r.departmentId,
      taskId: r.taskId,
      eventId: r.eventId,
      action: r.action,
      reason: r.reason ?? "",
      risk: (r.risk?.toUpperCase() ?? "MEDIUM") as ApprovalRisk,
      capabilityKey: match?.key ?? null,
      status: outcome,
      requestedAt: r.requestedAt,
      ...(auto
        ? {
            decisionSource: "POLICY" as const,
            decidedAt: r.requestedAt,
            decisionNote:
              outcome === "APPROVED"
                ? `Allowed by the agent's permission “${match!.label}”.`
                : `Denied by the agent's permission “${match!.label}”.`,
          }
        : {}),
    },
    select: { id: true, status: true },
  });
}

/** A task ended: its approvals that nobody decided are no longer needed. */
export async function cancelPendingApprovals(tx: Tx, organizationId: string, taskId: string) {
  await tx.approval.updateMany({
    where: { organizationId, taskId, status: "PENDING" },
    data: {
      status: "CANCELLED",
      decisionSource: "SYSTEM",
      decidedAt: new Date(),
      decisionNote: "The task ended before a decision.",
    },
  });
}

/** Approve or reject (owners, admins, managers). Resumes the task and agent when nothing else is pending. */
export async function decideApproval(
  ctx: OrgContext,
  id: string,
  decision: "APPROVED" | "REJECTED",
  note: string,
  meta: RequestMeta = {},
) {
  assertPermission(ctx.role, "approvals:decide");
  const now = new Date();
  return db.$transaction(async (tx) => {
    const { count } = await tx.approval.updateMany({
      where: { id, organizationId: ctx.organizationId, status: "PENDING" },
      data: {
        status: decision,
        decisionSource: "HUMAN",
        decidedById: ctx.user.id,
        decidedAt: now,
        decisionNote: note,
      },
    });
    const approval = await tx.approval.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!approval) throw new AppError("RESOURCE_NOT_FOUND", "Approval not found.");
    if (count === 0) {
      throw new AppError("CONFLICT", `This request was already ${approval.status.toLowerCase()}.`);
    }

    let executionId: string | null = null;
    if (approval.taskId) {
      const pendingOnTask = await tx.approval.count({
        where: { organizationId: ctx.organizationId, taskId: approval.taskId, status: "PENDING" },
      });
      if (pendingOnTask === 0) {
        await tx.task.updateMany({
          where: { id: approval.taskId, organizationId: ctx.organizationId, status: "WAITING" },
          data: { status: "RUNNING" },
        });
      }
      const execution = await tx.execution.findFirst({
        where: { taskId: approval.taskId, organizationId: ctx.organizationId },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });
      executionId = execution?.id ?? null;
    }

    const pendingForAgent = await tx.approval.count({
      where: { organizationId: ctx.organizationId, agentId: approval.agentId, status: "PENDING" },
    });
    if (pendingForAgent === 0) {
      const running = await tx.task.count({
        where: { organizationId: ctx.organizationId, agentId: approval.agentId, status: "RUNNING" },
      });
      await tx.agent.updateMany({
        where: { id: approval.agentId, organizationId: ctx.organizationId, status: "WAITING" },
        data: { status: running > 0 ? "WORKING" : "ONLINE" },
      });
    }

    const verb = decision === "APPROVED" ? "Approved" : "Rejected";
    // Shows up in the task trace and activity feed like any agent event.
    await tx.executionEvent.create({
      data: {
        id: newId("event"),
        organizationId: ctx.organizationId,
        agentId: approval.agentId,
        departmentId: approval.departmentId,
        taskId: approval.taskId,
        executionId,
        type: "APPROVAL_DECIDED",
        idempotencyKey: `approval-decision:${approval.id}`,
        payloadHash: createHash("sha256").update(`${approval.id}:${decision}`).digest("hex"),
        occurredAt: now,
        summary: `${verb} by ${ctx.user.name}: ${approval.action}`.slice(0, 300),
        metadata: { approvalId: approval.id, decision },
      },
    });

    await recordAudit(
      {
        action: decision === "APPROVED" ? "approval.approved" : "approval.rejected",
        organizationId: ctx.organizationId,
        actorUserId: ctx.user.id,
        resourceType: "approval",
        resourceId: approval.id,
        metadata: { action: approval.action, agentId: approval.agentId, note: note || undefined },
        meta,
      },
      tx,
    );
    return approval;
  });
}

export const APPROVAL_FILTERS = ["pending", "approved", "rejected", "all"] as const;
export type ApprovalFilter = (typeof APPROVAL_FILTERS)[number];

export const APPROVAL_PAGE_SIZE = 25;

export async function listApprovals(
  ctx: OrgContext,
  { filter = "pending", page = 1 }: { filter?: ApprovalFilter; page?: number } = {},
) {
  const status: ApprovalStatus | undefined =
    filter === "all" ? undefined : (filter.toUpperCase() as ApprovalStatus);
  const where = { organizationId: ctx.organizationId, ...(status ? { status } : {}) };
  const [total, rows] = await Promise.all([
    db.approval.count({ where }),
    db.approval.findMany({
      where,
      orderBy: { requestedAt: status === "PENDING" ? "asc" : "desc" },
      skip: (Math.max(1, page) - 1) * APPROVAL_PAGE_SIZE,
      take: APPROVAL_PAGE_SIZE,
      include: { decidedBy: { select: { name: true } } },
    }),
  ]);
  const [agents, departments, tasks] = await Promise.all([
    db.agent.findMany({
      where: { organizationId: ctx.organizationId, id: { in: rows.map((r) => r.agentId) } },
      select: { id: true, name: true, provider: true },
    }),
    db.department.findMany({
      where: { organizationId: ctx.organizationId, id: { in: rows.map((r) => r.departmentId) } },
      select: { id: true, name: true },
    }),
    db.task.findMany({
      where: {
        organizationId: ctx.organizationId,
        id: { in: rows.flatMap((r) => (r.taskId ? [r.taskId] : [])) },
      },
      select: { id: true, name: true },
    }),
  ]);
  const agent = new Map(agents.map((a) => [a.id, a]));
  const dept = new Map(departments.map((d) => [d.id, d.name]));
  const task = new Map(tasks.map((t) => [t.id, t.name]));
  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      agentName: agent.get(r.agentId)?.name ?? "Deleted agent",
      agentProvider: agent.get(r.agentId)?.provider ?? "",
      departmentName: dept.get(r.departmentId) ?? "",
      taskName: r.taskId ? (task.get(r.taskId) ?? null) : null,
      decidedByName: r.decidedBy?.name ?? null,
    })),
  };
}

export type ApprovalRow = Awaited<ReturnType<typeof listApprovals>>["rows"][number];

export function pendingApprovalCount(ctx: OrgContext) {
  return db.approval.count({ where: { organizationId: ctx.organizationId, status: "PENDING" } });
}

/** What the agent sees when it polls its own approval (API shape, snake_case). */
export async function getApprovalForAgent(agent: AgentContext, id: string) {
  const a = await db.approval.findFirst({
    where: { id, organizationId: agent.organizationId, agentId: agent.agentId },
  });
  if (!a) throw new AppError("RESOURCE_NOT_FOUND", "Approval not found for this agent.");
  return {
    approval_id: a.id,
    status: a.status.toLowerCase(),
    action: a.action,
    task_id: a.taskId,
    decision_source: a.decisionSource?.toLowerCase() ?? null,
    decision_note: a.decisionNote || null,
    requested_at: a.requestedAt.toISOString(),
    decided_at: a.decidedAt?.toISOString() ?? null,
  };
}
