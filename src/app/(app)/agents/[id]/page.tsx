import {
  Activity,
  ArrowLeft,
  CircleDollarSign,
  Clock,
  Coins,
  Gauge,
  KeyRound,
  ListChecks,
  Percent,
  Plug,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Folder } from "@/components/ui/folder";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { AgentAvatar } from "@/features/agents/components/agent-avatar";
import { AgentForm } from "@/features/agents/components/agent-form";
import { CopyButton } from "@/features/agents/components/api-key-reveal";
import {
  CapabilitiesForm,
  DeleteAgent,
  RotateApiKey,
} from "@/features/agents/components/agent-manage";
import { RULE_STYLE } from "@/features/agents/rule-style";
import { CONNECTION_LABEL, relativeTime } from "@/features/agents/format";
import { getAgent } from "@/features/agents/server/agent-service";
import { HealthBadge } from "@/features/tasks/components/health-badge";
import { agentHealthMap } from "@/features/tasks/server/task-service";
import { ActivityList } from "@/features/events/components/activity-list";
import { TaskTable } from "@/features/events/components/task-table";
import {
  avgLlmLatencyToday,
  listTasks,
  recentActivity,
  todayStats,
} from "@/features/events/server/activity";
import { getOrganization } from "@/features/organizations/server/organization-service";
import { formatTokens } from "@/features/workforce/format";
import { UsageBreakdown } from "@/features/usage/components/usage-breakdown";
import { UsageChart } from "@/features/usage/components/usage-chart";
import { formatUsd } from "@/features/usage/pricing";
import { getUsageReport, usageToday } from "@/features/usage/server/usage-service";
import { listDepartments } from "@/features/departments/server/department-service";
import { AppError } from "@/lib/api/errors";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agent" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "activity", label: "Activity" },
  { key: "usage", label: "Usage & costs" },
  { key: "permissions", label: "Permissions" },
  { key: "settings", label: "Settings" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const RULE_GROUPS = [
  { rule: "ALLOWED", title: "Allowed" },
  { rule: "APPROVAL_REQUIRED", title: "Approval required" },
  { rule: "DENIED", title: "Not allowed" },
] as const;

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const ctx = await requireOrgContext();
  const agent = await getAgent(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "RESOURCE_NOT_FOUND") notFound();
    throw e;
  });
  const canManage = can(ctx.role, "agents:manage");
  const visibleTabs = TABS.filter((t) => t.key !== "settings" || canManage);
  const tab: Tab = visibleTabs.some((t) => t.key === rawTab) ? (rawTab as Tab) : "overview";
  const departments = tab === "settings" ? await listDepartments(ctx) : [];
  const activeKey = agent.apiKeys[0];
  const org = await getOrganization(ctx);
  const canCost = can(ctx.role, "costs:read");
  const [stats, latency, tasks, activity, healthMap, costToday, usage] = await Promise.all([
    todayStats(ctx, org.timezone, { agentId: agent.id }),
    avgLlmLatencyToday(ctx, agent.id, org.timezone),
    tab === "tasks" ? listTasks(ctx, { agentId: agent.id, limit: 100 }) : Promise.resolve([]),
    tab === "activity"
      ? recentActivity(ctx, { agentId: agent.id, limit: 100 })
      : Promise.resolve([]),
    agentHealthMap(ctx),
    canCost ? usageToday(ctx, org.timezone, { agentId: agent.id }) : Promise.resolve(null),
    tab === "usage" && canCost
      ? getUsageReport(ctx, org.timezone, "30d", { agentId: agent.id })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" /> Agents
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <AgentAvatar provider={agent.provider} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold text-foreground sm:text-3xl">
              {agent.name}
            </h1>
            <StatusIndicator
              status={agent.status}
              className="rounded-full border border-border bg-raised px-2.5 py-1"
            />
            {healthMap[agent.id] ? (
              <span className="rounded-full border border-border bg-raised px-2.5 py-1">
                <HealthBadge
                  health={healthMap[agent.id]!.health}
                  reasons={healthMap[agent.id]!.reasons}
                />
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <Link
              href={`/departments/${agent.department.id}`}
              className="text-foreground hover:underline"
            >
              {agent.department.name}
            </Link>
            <span>·</span>
            <span>
              {agent.provider} · {agent.model}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5">
              <code className="font-mono text-xs">{agent.id}</code>
              <CopyButton value={agent.id} label="Copy ID" />
            </span>
          </p>
        </div>
      </header>

      <nav
        aria-label="Agent sections"
        className="scroller-x -mx-1 flex gap-1 border-b border-border px-1"
      >
        {visibleTabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/agents/${agent.id}` : `/agents/${agent.id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm whitespace-nowrap",
              tab === t.key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="space-y-6">
          <section
            aria-label="Agent metrics"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
          >
            <KpiCard
              label="Tasks today"
              value={String(stats.tasks)}
              icon={ListChecks}
              accent="var(--color-cyan)"
              caption={stats.tasks ? `${stats.running} running` : "No tasks yet today"}
            />
            <KpiCard
              label="Success rate"
              value={stats.successRate === null ? "—" : `${Math.round(stats.successRate * 100)}%`}
              icon={Percent}
              accent="var(--color-primary)"
              caption={`${stats.completed} done · ${stats.failed} failed`}
            />
            <KpiCard
              label="Avg latency"
              value={
                latency === null
                  ? "—"
                  : latency >= 1000
                    ? `${(latency / 1000).toFixed(1)}s`
                    : `${latency}ms`
              }
              icon={Gauge}
              accent="var(--color-purple)"
              caption="LLM calls today"
            />
            <KpiCard
              label="Tokens today"
              value={formatTokens(stats.tokens)}
              icon={Coins}
              accent="var(--color-purple)"
              caption={`${formatTokens(stats.inputTokens)} in · ${formatTokens(stats.outputTokens)} out`}
            />
            <KpiCard
              label="Cost today"
              value={costToday ? formatUsd(costToday.cost) : "—"}
              icon={CircleDollarSign}
              accent="var(--color-lime)"
              caption={
                !costToday
                  ? "Owners, admins & managers"
                  : costToday.unpricedCalls
                    ? `${costToday.unpricedCalls} unpriced calls`
                    : `${costToday.llmCalls} LLM calls`
              }
            />
            <KpiCard
              label="Last active"
              value={agent.lastActiveAt ? "●" : "—"}
              icon={Clock}
              accent="var(--color-foreground)"
              caption={relativeTime(agent.lastActiveAt)}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Folder as="h2" tab="Profile">
              <CardContent>
                <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-y-3 text-sm">
                  <dt className="text-muted">Description</dt>
                  <dd className="text-foreground">{agent.description || "—"}</dd>
                  <dt className="text-muted">Department</dt>
                  <dd className="text-foreground">{agent.department.name}</dd>
                  <dt className="text-muted">Provider / model</dt>
                  <dd className="text-foreground">
                    {agent.provider} · {agent.model}
                  </dd>
                  <dt className="text-muted">Created</dt>
                  <dd className="text-foreground">
                    {agent.createdAt.toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </dd>
                  <dt className="text-muted">Last heartbeat</dt>
                  <dd className="text-foreground">{relativeTime(agent.lastHeartbeatAt)}</dd>
                  <dt className="text-muted">Current task</dt>
                  <dd className="text-muted">None</dd>
                </dl>
              </CardContent>
            </Folder>
            <Folder as="h2" tab="Connection">
              <CardContent>
                <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-y-3 text-sm">
                  <dt className="text-muted">Type</dt>
                  <dd className="flex items-center gap-1.5 text-foreground">
                    <Plug aria-hidden className="size-4 text-primary" />{" "}
                    {CONNECTION_LABEL[agent.connectionType]}
                  </dd>
                  <dt className="text-muted">Endpoint</dt>
                  <dd className="truncate font-mono text-xs text-foreground">
                    {agent.endpointUrl ?? "—"}
                  </dd>
                  <dt className="text-muted">Authentication</dt>
                  <dd className="text-foreground">
                    {agent.authType === "NONE"
                      ? "None"
                      : agent.authType.replace("_", " ").toLowerCase()}
                    {agent.credential ? (
                      <span className="ml-2 font-mono text-xs text-muted">
                        {agent.credential.hint}
                      </span>
                    ) : null}
                  </dd>
                  <dt className="text-muted">Verified</dt>
                  <dd className="text-foreground">
                    {agent.connectionVerifiedAt
                      ? `✓ ${relativeTime(agent.connectionVerifiedAt)}`
                      : "Not verified"}
                  </dd>
                  <dt className="text-muted">API key</dt>
                  <dd className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                    <KeyRound aria-hidden className="size-3.5 text-muted" />
                    {activeKey ? `${activeKey.prefix}…` : "None"}
                    <span className="font-sans text-muted">
                      · used {relativeTime(activeKey?.lastUsedAt ?? null)}
                    </span>
                  </dd>
                </dl>
              </CardContent>
            </Folder>
          </div>
        </div>
      ) : null}

      {tab === "tasks" ? (
        <Card className="overflow-hidden rounded-[22px]">
          {tasks.length ? (
            <TaskTable tasks={tasks} />
          ) : (
            <EmptyState
              icon={ListChecks}
              title="No tasks yet"
              description="Tasks appear here when this agent reports them with its API key."
            />
          )}
        </Card>
      ) : null}

      {tab === "activity" ? (
        <Card className="overflow-hidden rounded-[22px]">
          {activity.length ? (
            <ActivityList items={activity} showAgent={false} />
          ) : (
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description="Agent activity will appear here when your agents start working."
            />
          )}
        </Card>
      ) : null}

      {tab === "usage" ? (
        <div className="space-y-4">
          <section aria-label="Token usage today" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label="Input tokens"
              value={formatTokens(stats.inputTokens)}
              icon={Coins}
              accent="var(--color-cyan)"
              caption="Today"
            />
            <KpiCard
              label="Output tokens"
              value={formatTokens(stats.outputTokens)}
              icon={Coins}
              accent="var(--color-purple)"
              caption="Today"
            />
            <KpiCard
              label="Cached tokens"
              value={formatTokens(stats.cachedTokens)}
              icon={Coins}
              accent="var(--color-lime)"
              caption="Today"
            />
            <KpiCard
              label="Total tokens"
              value={formatTokens(stats.tokens)}
              icon={Coins}
              accent="var(--color-foreground)"
              caption="Today"
            />
          </section>
          {usage ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Folder as="h2" tab="Cost · last 30 days" className="p-5 pt-2">
                <p className="mb-4 text-sm text-muted">
                  {formatUsd(usage.totals.cost)} · {formatTokens(usage.totals.tokens)} tokens
                </p>
                <UsageChart series={usage.series} metric="cost" />
              </Folder>
              <UsageBreakdown
                title="By model (30 days)"
                rows={usage.models}
                totalCost={usage.totals.cost}
                totalTokens={usage.totals.tokens}
              />
            </div>
          ) : (
            <p className="text-sm text-muted">
              Cost history is visible to owners, admins and managers.
            </p>
          )}
        </div>
      ) : null}

      {tab === "permissions" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Folder as="h2" tab="Current permissions">
            <CardContent className="space-y-5">
              {agent.capabilities.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="No capabilities defined" className="py-6" />
              ) : (
                RULE_GROUPS.map((g) => {
                  const items = agent.capabilities.filter((c) => c.rule === g.rule);
                  if (!items.length) return null;
                  return (
                    <div key={g.rule}>
                      <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                        {g.title}
                      </h3>
                      <ul className="mt-2 space-y-1.5">
                        {items.map((c) => (
                          <li
                            key={c.key}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <span
                              aria-hidden
                              className="w-4 text-center font-bold"
                              style={{ color: RULE_STYLE[c.rule].color }}
                            >
                              {RULE_STYLE[c.rule].symbol}
                            </span>
                            {c.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
              <p className="text-xs text-muted">
                Enforced server-side when the agent requests an action; approval flows arrive in
                Phase 7.
              </p>
            </CardContent>
          </Folder>
          {canManage ? (
            <Folder as="h2" tab="Edit permissions">
              <CardContent>
                <CapabilitiesForm
                  agentId={agent.id}
                  initial={agent.capabilities.map((c) => ({ label: c.label, rule: c.rule }))}
                />
              </CardContent>
            </Folder>
          ) : null}
        </div>
      ) : null}

      {tab === "settings" && canManage ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <AgentForm
            mode="edit"
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
            agent={{
              id: agent.id,
              name: agent.name,
              description: agent.description,
              departmentId: agent.department.id,
              provider: agent.provider,
              model: agent.model,
              connectionType: agent.connectionType,
              endpointUrl: agent.endpointUrl,
              authType: agent.authType,
              authHeaderName: agent.authHeaderName,
              credentialHint: agent.credential?.hint ?? null,
            }}
          />
          <div className="space-y-6">
            <Folder as="h2" tab="API key">
              <CardContent className="space-y-3">
                <p className="text-sm text-muted">
                  Active key{" "}
                  <code className="font-mono text-foreground">
                    {activeKey ? `${activeKey.prefix}…` : "none"}
                  </code>
                  . Rotate it if it may have leaked.
                </p>
                <RotateApiKey agentId={agent.id} />
              </CardContent>
            </Folder>
            <Folder as="h2" tab="Danger zone" accent="var(--color-error)">
              <CardContent>
                <DeleteAgent agentId={agent.id} name={agent.name} />
              </CardContent>
            </Folder>
          </div>
        </div>
      ) : null}
    </div>
  );
}
