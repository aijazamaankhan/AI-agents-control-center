import { ArrowLeft, Clock, Coins, Hash, Wrench, Bot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { AgentAvatar } from "@/features/agents/components/agent-avatar";
import { formatDuration, TaskStatusBadge } from "@/features/events/components/task-table";
import { ExecutionTrace } from "@/features/tasks/components/execution-trace";
import { getTaskTrace } from "@/features/tasks/server/task-service";
import { formatTokens } from "@/features/workforce/format";
import { AppError } from "@/lib/api/errors";
import { requireOrgContext } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Task" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrgContext();
  const task = await getTaskTrace(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "RESOURCE_NOT_FOUND") notFound();
    throw e;
  });
  const total = task.inputTokens + task.outputTokens + task.cachedTokens;
  const live = task.status === "RUNNING" || task.status === "WAITING";
  const duration = task.elapsedMs;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" /> Tasks
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{task.name}</h1>
          <span className="rounded-full border border-border bg-raised px-2.5 py-1">
            <TaskStatusBadge status={task.status} />
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <Link
            href={`/agents/${task.agent.id}`}
            className="inline-flex items-center gap-2 text-foreground hover:underline"
          >
            <AgentAvatar provider={task.agent.provider} /> {task.agent.name}
          </Link>
          <span>·</span>
          {task.department ? (
            <Link
              href={`/departments/${task.department.id}`}
              className="hover:text-foreground hover:underline"
            >
              {task.department.name}
            </Link>
          ) : (
            <span>—</span>
          )}
          <span>·</span>
          <span>
            Started{" "}
            {task.startedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" })}
          </span>
          <span>·</span>
          <code className="font-mono text-xs">{task.id}</code>
        </p>
        {task.description ? <p className="text-sm text-muted">{task.description}</p> : null}
      </header>

      <section aria-label="Task totals" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard
          label="Tokens"
          value={formatTokens(total)}
          icon={Coins}
          accent="var(--color-purple)"
          caption={`${formatTokens(task.inputTokens)} in · ${formatTokens(task.outputTokens)} out`}
        />
        <KpiCard
          label="Cached"
          value={formatTokens(task.cachedTokens)}
          icon={Coins}
          accent="var(--color-lime)"
          caption="tokens"
        />
        <KpiCard
          label="Duration"
          value={formatDuration(duration)}
          icon={Clock}
          accent="var(--color-cyan)"
          caption={live ? "Still running" : "Total"}
        />
        <KpiCard
          label="LLM calls"
          value={String(task.llmCalls)}
          icon={Bot}
          accent="var(--color-purple)"
          caption="Model requests"
        />
        <KpiCard
          label="Tool calls"
          value={String(task.toolCalls)}
          icon={Wrench}
          accent="var(--color-lime)"
          caption="Actions"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="rounded-[22px]">
          <CardHeader>
            <CardTitle>Execution trace</CardTitle>
          </CardHeader>
          <CardContent>
            {task.events.length ? (
              <ExecutionTrace
                startedAt={task.startedAt}
                events={task.events.map((e) => ({ ...e, metadata: e.metadata as unknown }))}
              />
            ) : (
              <p className="text-sm text-muted">No events recorded for this task.</p>
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          {task.error || task.result !== null ? (
            <Card className="rounded-[22px]">
              <CardHeader>
                <CardTitle>{task.error ? "Error" : "Result"}</CardTitle>
              </CardHeader>
              <CardContent>
                {task.error ? <p className="text-sm text-error">{task.error}</p> : null}
                {task.result !== null ? (
                  <pre className="scroller-x rounded-control bg-background p-3 font-mono text-xs text-foreground">
                    {JSON.stringify(task.result, null, 2)}
                  </pre>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          <Card className="rounded-[22px]">
            <CardHeader>
              <CardTitle>Executions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {task.executions.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 truncate font-mono text-xs text-muted">
                      <Hash aria-hidden className="size-3.5" /> {x.id}
                    </span>
                    <TaskStatusBadge status={x.status} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
