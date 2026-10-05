import { ChevronLeft, ChevronRight, ListChecks, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { AgentAvatar } from "@/features/agents/components/agent-avatar";
import { relativeTime } from "@/features/agents/format";
import { listAgents } from "@/features/agents/server/agent-service";
import { listDepartments } from "@/features/departments/server/department-service";
import { formatDuration, TaskStatusBadge } from "@/features/events/components/task-table";
import { getOrganization } from "@/features/organizations/server/organization-service";
import {
  DATE_RANGES,
  firstParam,
  TASK_STATUSES,
  taskFiltersSchema,
} from "@/features/tasks/schemas";
import { searchTasks, usedModels } from "@/features/tasks/server/task-service";
import { formatTokens } from "@/features/workforce/format";
import { requireOrgContext } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrgContext();
  const sp = await searchParams;
  const filters = taskFiltersSchema.parse(
    Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, firstParam(v)])),
  );
  const org = await getOrganization(ctx);
  const [result, departments, agents, models] = await Promise.all([
    searchTasks(ctx, filters, org.timezone),
    listDepartments(ctx),
    listAgents(ctx),
    usedModels(ctx),
  ]);
  const active = Boolean(
    filters.q ||
    filters.department ||
    filters.agent ||
    filters.status ||
    filters.provider ||
    filters.model,
  );
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, page }))
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) params.set(k, String(v));
    return `/tasks?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Tasks</h1>
        <p className="mt-1 text-sm text-muted">
          {result.total} task{result.total === 1 ? "" : "s"} ·{" "}
          {DATE_RANGES[filters.range].toLowerCase()}
        </p>
      </div>

      <form
        role="search"
        className="grid gap-3 rounded-[18px] border border-border bg-surface p-3 md:grid-cols-4 xl:grid-cols-[minmax(0,1.4fr)_repeat(6,minmax(0,1fr))_auto]"
      >
        <div className="relative md:col-span-2 xl:col-span-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          />
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Search tasks or task_…"
            aria-label="Search tasks"
            className="pl-9"
          />
        </div>
        <Select name="department" defaultValue={filters.department ?? ""} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select name="agent" defaultValue={filters.agent ?? ""} aria-label="Agent">
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status">
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
        <Select name="provider" defaultValue={filters.provider ?? ""} aria-label="Provider">
          <option value="">All providers</option>
          {models.providers.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Select name="model" defaultValue={filters.model ?? ""} aria-label="Model">
          <option value="">All models</option>
          {models.models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
        <Select name="range" defaultValue={filters.range} aria-label="Date range">
          {Object.entries(DATE_RANGES).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <button type="submit" className={buttonStyles("secondary", "md")}>
            Filter
          </button>
          {active ? (
            <Link href="/tasks" className={buttonStyles("ghost", "md")}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {result.tasks.length === 0 ? (
        <Card className="rounded-[22px]">
          <EmptyState
            icon={active ? Search : ListChecks}
            title={active ? "No tasks match these filters." : "No tasks yet"}
            description={
              active ? undefined : "Tasks appear here as soon as your agents report work."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-[22px]">
          <div className="scroller-x">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] tracking-wide text-muted uppercase">
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Started</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 text-right font-medium">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-raised/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {t.name}
                      </Link>
                      <p className="font-mono text-[11px] text-muted">{t.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/agents/${t.agent.id}`}
                        className="flex items-center gap-2 text-foreground hover:underline"
                      >
                        <AgentAvatar provider={t.agent.provider} />
                        <span className="truncate">{t.agent.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{t.departmentName}</td>
                    <td className="px-4 py-3">
                      <TaskStatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">{relativeTime(t.startedAt)}</td>
                    <td className="px-4 py-3 text-muted tabular-nums">
                      {formatDuration(t.durationMs)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground tabular-nums">
                      {formatTokens(t.tokens)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.pages > 1 ? (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted"
            >
              <span>
                Page {filters.page} of {result.pages}
              </span>
              <span className="flex gap-2">
                {filters.page > 1 ? (
                  <Link
                    href={pageHref(filters.page - 1)}
                    className={buttonStyles("secondary", "sm")}
                  >
                    <ChevronLeft aria-hidden className="size-4" /> Previous
                  </Link>
                ) : null}
                {filters.page < result.pages ? (
                  <Link
                    href={pageHref(filters.page + 1)}
                    className={buttonStyles("secondary", "sm")}
                  >
                    Next <ChevronRight aria-hidden className="size-4" />
                  </Link>
                ) : null}
              </span>
            </nav>
          ) : null}
        </Card>
      )}
    </div>
  );
}
