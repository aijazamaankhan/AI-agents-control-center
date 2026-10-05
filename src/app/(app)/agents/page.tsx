import { Bot, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { AgentAvatar } from "@/features/agents/components/agent-avatar";
import { CONNECTION_LABEL, relativeTime } from "@/features/agents/format";
import { listAgents } from "@/features/agents/server/agent-service";
import { HealthBadge } from "@/features/tasks/components/health-badge";
import { agentHealthMap } from "@/features/tasks/server/task-service";
import { listDepartments } from "@/features/departments/server/department-service";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";
import type { AgentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Agents" };

const STATUSES: AgentStatus[] = [
  "ONLINE",
  "WORKING",
  "IDLE",
  "WAITING",
  "FAILED",
  "OFFLINE",
  "DISCONNECTED",
];

type Search = { department?: string; status?: string; q?: string };

export default async function AgentsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireOrgContext();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as AgentStatus)
    ? (sp.status as AgentStatus)
    : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const [departments, agents, all, health] = await Promise.all([
    listDepartments(ctx),
    listAgents(ctx, { departmentId: sp.department || undefined, status, q: q || undefined }),
    listAgents(ctx),
    agentHealthMap(ctx),
  ]);
  const canManage = can(ctx.role, "agents:manage");
  const filtered = Boolean(sp.department || status || q);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Agents</h1>
          <p className="mt-1 text-sm text-muted">
            {all.length} connected agents across {departments.length} departments.
          </p>
        </div>
        {canManage && departments.length > 0 ? (
          <Link href="/agents/new" className={buttonStyles("primary", "md")}>
            <Plus aria-hidden className="size-4" /> Connect Agent
          </Link>
        ) : null}
      </div>

      {all.length > 0 ? (
        <form
          role="search"
          className="grid gap-3 rounded-[18px] border border-border bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_200px_180px_auto]"
        >
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search agents"
              aria-label="Search agents"
              className="pl-9"
            />
          </div>
          <Select
            name="department"
            defaultValue={sp.department ?? ""}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={status ?? ""} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <button type="submit" className={buttonStyles("secondary", "md")}>
              Filter
            </button>
            {filtered ? (
              <Link href="/agents" className={buttonStyles("ghost", "md")}>
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      ) : null}

      {all.length === 0 ? (
        <Card className="rounded-[22px]">
          <EmptyState
            icon={Bot}
            title="Your AI workforce is empty."
            description={
              departments.length === 0
                ? "Create a department first — every agent belongs to one."
                : "Connect an agent you already run — SDK, REST API, webhook or MCP."
            }
            action={
              canManage ? (
                departments.length === 0 ? (
                  <Link href="/departments" className={buttonStyles("primary", "md")}>
                    Create a department
                  </Link>
                ) : (
                  <Link href="/agents/new" className={buttonStyles("primary", "md")}>
                    <Plus aria-hidden className="size-4" /> Connect Your First Agent
                  </Link>
                )
              ) : null
            }
          />
        </Card>
      ) : agents.length === 0 ? (
        <Card className="rounded-[22px]">
          <EmptyState icon={Search} title="No agents match these filters." />
        </Card>
      ) : (
        <ul className="grid gap-3" aria-label="Agents">
          {agents.map((a) => (
            <li key={a.id}>
              <Link
                href={`/agents/${a.id}`}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-[18px] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-raised md:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_120px_110px]"
              >
                <AgentAvatar provider={a.provider} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted">{a.id}</p>
                </div>
                <p className="col-start-2 truncate text-sm text-muted md:col-start-auto">
                  {a.department.name}
                </p>
                <p className="col-start-2 truncate text-sm text-muted md:col-start-auto">
                  {a.provider} · {a.model}
                  <span className="block text-[11px]">{CONNECTION_LABEL[a.connectionType]}</span>
                </p>
                <div className="col-start-2 md:col-start-auto">
                  <StatusIndicator status={a.status} />
                  {health[a.id] ? (
                    <div className="mt-1">
                      <HealthBadge health={health[a.id]!.health} reasons={health[a.id]!.reasons} />
                    </div>
                  ) : null}
                </div>
                <p className="col-start-2 text-xs text-muted md:col-start-auto">
                  {relativeTime(a.lastActiveAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
