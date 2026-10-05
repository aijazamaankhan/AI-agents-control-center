import "server-only";
import type { OrgContext } from "@/lib/auth/sessions";
import { agentStatusCounts } from "@/features/agents/server/agent-service";
import { listDepartments } from "@/features/departments/server/department-service";
import {
  countMembers,
  getOrganization,
} from "@/features/organizations/server/organization-service";
import type { AgentRuntime, Provider, WorkforceDepartment } from "@/features/workforce/types";
import { db } from "@/lib/db/client";
import { activeTaskNames, recentActivity, todayStats } from "@/features/events/server/activity";
import { toActivityEvent } from "@/features/workforce/live";

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

/**
 * Onboarding checklist reflecting real state. Items for features that are not
 * built yet are reported as not done — never faked (docs/PRD.md §5).
 */
export async function getOnboardingChecklist(ctx: OrgContext): Promise<ChecklistItem[]> {
  const [memberCount, departmentCount, agents] = await Promise.all([
    countMembers(ctx),
    db.department.count({ where: { organizationId: ctx.organizationId } }),
    agentStatusCounts(ctx),
  ]);
  return [
    { key: "company", label: "Company created", done: true },
    { key: "departments", label: "Departments created", done: departmentCount > 0 },
    { key: "agent", label: "First agent connected", done: agents.total > 0 },
    { key: "team", label: "Invite team", done: memberCount > 1 },
    { key: "budget", label: "Configure budget", done: false },
    { key: "integration", label: "Connect integration", done: false },
  ];
}

export function greetingFor(date: Date, timezone: string): string {
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: timezone,
      }).format(date),
    );
  } catch {
    hour = date.getUTCHours();
  }
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const KNOWN_PROVIDERS: Provider[] = ["Anthropic", "OpenAI", "Google"];

/** Map status from the stored agent status (the map shows 5 visual states). */
export function runtimeStatus(status: string): AgentRuntime["status"] {
  switch (status) {
    case "WORKING":
      return "WORKING";
    case "WAITING":
      return "WAITING";
    case "FAILED":
      return "FAILED";
    case "ONLINE":
    case "IDLE":
      return "IDLE";
    default:
      return "OFFLINE";
  }
}

/** The organization's real workforce for the map: every department, with its agents. */
export async function getWorkforceSnapshot(ctx: OrgContext) {
  const [departments, agents] = await Promise.all([
    listDepartments(ctx),
    db.agent.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        provider: true,
        model: true,
        status: true,
        departmentId: true,
        capabilities: { select: { label: true }, orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  const workforce: WorkforceDepartment[] = departments.map((d) => ({
    id: d.id,
    name: d.name,
    agents: agents
      .filter((a) => a.departmentId === d.id)
      .map((a) => ({
        id: a.id,
        name: a.name,
        provider: (KNOWN_PROVIDERS as string[]).includes(a.provider)
          ? (a.provider as Provider)
          : "Custom",
        model: a.model,
        tools: a.capabilities.map((c) => c.label),
        tasks: [],
      })),
  }));
  const activeTasks = await activeTaskNames(ctx);
  const runtime: Record<string, AgentRuntime> = Object.fromEntries(
    agents.map((a) => [
      a.id,
      {
        status: runtimeStatus(a.status),
        stage: null,
        task: ["WORKING", "WAITING"].includes(runtimeStatus(a.status))
          ? (activeTasks[a.id] ?? null)
          : null,
        tool: null,
        tokens: 0,
        cost: 0,
        completed: 0,
        failed: 0,
      },
    ]),
  );
  return { workforce, runtime, agentCount: agents.length };
}

export async function getDashboardOverview(ctx: OrgContext) {
  const organization = await getOrganization(ctx);
  const [checklist, counts, snapshot, today, recent] = await Promise.all([
    getOnboardingChecklist(ctx),
    agentStatusCounts(ctx),
    getWorkforceSnapshot(ctx),
    todayStats(ctx, organization.timezone),
    recentActivity(ctx, { limit: 20 }),
  ]);
  return {
    organization,
    checklist,
    counts,
    snapshot,
    today,
    recentEvents: recent.map(toActivityEvent),
    greeting: greetingFor(new Date(), organization.timezone),
  };
}
