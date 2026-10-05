import {
  Activity,
  ArrowLeft,
  Bot,
  CircleDollarSign,
  Coins,
  ListChecks,
  Loader,
  Percent,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { AgentAvatar } from "@/features/agents/components/agent-avatar";
import { listAgents } from "@/features/agents/server/agent-service";
import { todayStats } from "@/features/events/server/activity";
import { getOrganization } from "@/features/organizations/server/organization-service";
import { formatTokens } from "@/features/workforce/format";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { DeleteDepartment } from "@/features/departments/components/delete-department";
import { EditDepartmentForm } from "@/features/departments/components/department-form";
import { listDepartments } from "@/features/departments/server/department-service";
import { DepartmentIcon } from "@/features/workforce/components/department-icon";
import { departmentAccent, tint } from "@/features/workforce/visuals";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";

export const metadata: Metadata = { title: "Department" };

export default async function DepartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  // Listing (org-scoped) gives both the record and its lane colour index.
  const departments = await listDepartments(ctx);
  const index = departments.findIndex((d) => d.id === id);
  const dep = departments[index];
  if (!dep) notFound();

  const accent = departmentAccent(dep.name, index);
  const canManage = can(ctx.role, "departments:manage");
  const created = dep.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const org = await getOrganization(ctx);
  const [agents, stats] = await Promise.all([
    listAgents(ctx, { departmentId: dep.id }),
    todayStats(ctx, org.timezone, { departmentId: dep.id }),
  ]);
  const working = agents.filter((a) => a.status === "WORKING").length;
  const metrics = [
    {
      label: "Agents",
      value: String(agents.length),
      icon: Bot,
      accent: "var(--color-foreground)",
      caption: agents.length ? "Connected" : "No agents yet",
    },
    {
      label: "Working",
      value: String(working),
      icon: Loader,
      accent: "var(--color-primary)",
      caption: "Right now",
    },
    {
      label: "Tasks today",
      value: String(stats.tasks),
      icon: ListChecks,
      accent: "var(--color-cyan)",
      caption: `${stats.completed} completed · ${stats.failed} failed`,
    },
    {
      label: "Success rate",
      value: stats.successRate === null ? "—" : `${Math.round(stats.successRate * 100)}%`,
      icon: Percent,
      accent: "var(--color-primary)",
      caption: "Today",
    },
    {
      label: "Tokens",
      value: formatTokens(stats.tokens),
      icon: Coins,
      accent: "var(--color-purple)",
      caption: "Today",
    },
    {
      label: "AI cost",
      value: "$0.00",
      icon: CircleDollarSign,
      accent: "var(--color-lime)",
      caption: "Pricing arrives in Phase 6",
    },
  ];
  const canConnect = can(ctx.role, "agents:manage");

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <Link
        href="/departments"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" /> Departments
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <span
          className="flex size-14 items-center justify-center rounded-[18px]"
          style={{
            background: tint(accent, 14),
            color: accent,
            boxShadow: `0 0 40px -12px ${accent}`,
          }}
        >
          <DepartmentIcon name={dep.name} className="size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-foreground sm:text-3xl">
            {dep.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {dep.description || "No description"} · Created {created} ·{" "}
            <code className="font-mono text-xs">{dep.id}</code>
          </p>
        </div>
      </div>

      <section
        aria-label="Department metrics"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        {metrics.map((m) => (
          <KpiCard key={m.label} {...m} />
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="rounded-[22px]">
            <CardHeader>
              <CardTitle>Agents</CardTitle>
            </CardHeader>
            {agents.length === 0 ? (
              <EmptyState
                icon={Bot}
                title={`No agents in ${dep.name} yet.`}
                description="Connect an agent and assign it to this department to see its status, tasks, tokens and cost here."
                action={
                  canConnect ? (
                    <Link
                      href={`/agents/new?department=${dep.id}`}
                      className={buttonStyles("primary", "md")}
                    >
                      Connect Agent
                    </Link>
                  ) : null
                }
              />
            ) : (
              <CardContent>
                <ul className="divide-y divide-border" aria-label={`Agents in ${dep.name}`}>
                  {agents.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/agents/${a.id}`}
                        className="flex items-center gap-3 py-3 hover:text-foreground"
                      >
                        <AgentAvatar provider={a.provider} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {a.name}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {a.provider} · {a.model}
                          </span>
                        </span>
                        <StatusIndicator status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
                {canConnect ? (
                  <Link
                    href={`/agents/new?department=${dep.id}`}
                    className={buttonStyles("secondary", "sm", "mt-3")}
                  >
                    Connect another agent
                  </Link>
                ) : null}
              </CardContent>
            )}
          </Card>
          <Card className="rounded-[22px]">
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Agent activity will appear here when your agents start working."
            />
          </Card>
        </div>

        {canManage ? (
          <Card className="h-fit rounded-[22px]">
            <CardHeader>
              <CardTitle>Manage department</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <EditDepartmentForm id={dep.id} name={dep.name} description={dep.description} />
              <div className="border-t border-border pt-5">
                <DeleteDepartment id={dep.id} name={dep.name} />
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
