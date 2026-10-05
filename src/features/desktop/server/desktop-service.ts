import "server-only";
import { agentStatusCounts } from "@/features/agents/server/agent-service";
import { listApprovals } from "@/features/approvals/server/approval-service";
import { getOrganization } from "@/features/organizations/server/organization-service";
import type { OrgContext } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";

const FAILED_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Everything the desktop app's tray and notifications need, in one cheap, tenant-scoped call
 * (polled every ~15 s). Contains names and short texts only — never prompts or results.
 */
export async function desktopSummary(ctx: OrgContext, now = new Date()) {
  const [organization, counts, approvals, failed] = await Promise.all([
    getOrganization(ctx),
    agentStatusCounts(ctx),
    listApprovals(ctx, { filter: "pending" }),
    db.task.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: "FAILED",
        completedAt: { gte: new Date(now.getTime() - FAILED_WINDOW_MS) },
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        error: true,
        completedAt: true,
        agent: { select: { name: true } },
      },
    }),
  ]);
  return {
    organization: { name: organization.name },
    user: { name: ctx.user.name },
    agents: {
      total: counts.total,
      working: counts.WORKING,
      waiting: counts.WAITING,
      failed: counts.FAILED,
    },
    pendingApprovals: approvals.total,
    approvals: approvals.rows.slice(0, 10).map((a) => ({
      id: a.id,
      action: a.action,
      risk: a.risk.toLowerCase(),
      agentName: a.agentName,
      departmentName: a.departmentName,
      requestedAt: a.requestedAt.toISOString(),
    })),
    failedTasks: failed.map((t) => ({
      id: t.id,
      name: t.name,
      agentName: t.agent.name,
      error: t.error?.slice(0, 200) ?? null,
      failedAt: t.completedAt?.toISOString() ?? null,
    })),
  };
}

export type DesktopSummary = Awaited<ReturnType<typeof desktopSummary>>;
