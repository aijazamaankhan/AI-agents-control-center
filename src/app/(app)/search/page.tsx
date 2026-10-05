import { Bot, Building2, ListChecks, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { AgentAvatar } from "@/features/agents/components/agent-avatar";
import { relativeTime } from "@/features/agents/format";
import { TaskStatusBadge } from "@/features/events/components/task-table";
import { firstParam } from "@/features/tasks/schemas";
import { globalSearch } from "@/features/tasks/server/task-service";
import { DepartmentIcon } from "@/features/workforce/components/department-icon";
import { requireOrgContext } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Search" };

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Bot;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
        <Icon aria-hidden className="size-4" /> {title}
      </h2>
      <Card className="divide-y divide-border overflow-hidden rounded-[18px]">{children}</Card>
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const ctx = await requireOrgContext();
  const q = firstParam((await searchParams).q) ?? "";
  const r = await globalSearch(ctx, q);
  const count = r.agents.length + r.departments.length + r.tasks.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Search</h1>
        <p className="mt-1 text-sm text-muted">
          {r.q.length < 2
            ? "Type at least 2 characters."
            : `${count} result${count === 1 ? "" : "s"} for “${r.q}”`}
        </p>
      </div>
      {r.q.length >= 2 && count === 0 ? (
        <Card className="rounded-[22px]">
          <EmptyState
            icon={Search}
            title="Nothing found"
            description="Try an agent, department or task name, or paste an ID."
          />
        </Card>
      ) : null}
      {r.agents.length ? (
        <Section title="Agents" icon={Bot}>
          {r.agents.map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60"
            >
              <AgentAvatar provider={a.provider} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{a.name}</span>
                <span className="block truncate text-xs text-muted">
                  {a.provider} · {a.model}
                </span>
              </span>
              <StatusIndicator status={a.status} />
            </Link>
          ))}
        </Section>
      ) : null}
      {r.departments.length ? (
        <Section title="Departments" icon={Building2}>
          {r.departments.map((d) => (
            <Link
              key={d.id}
              href={`/departments/${d.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60"
            >
              <DepartmentIcon name={d.name} className="size-4 text-muted" />
              <span className="text-sm font-medium text-foreground">{d.name}</span>
              <span className="truncate text-xs text-muted">{d.description}</span>
            </Link>
          ))}
        </Section>
      ) : null}
      {r.tasks.length ? (
        <Section title="Tasks" icon={ListChecks}>
          {r.tasks.map((t) => (
            <Link
              key={t.id}
              href={`/tasks/${t.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{t.name}</span>
                <span className="block truncate text-xs text-muted">
                  {t.agent.name} · {relativeTime(t.startedAt)}
                </span>
              </span>
              <TaskStatusBadge status={t.status} />
            </Link>
          ))}
        </Section>
      ) : null}
    </div>
  );
}
