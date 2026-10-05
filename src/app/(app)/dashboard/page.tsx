import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CircleDollarSign,
  Clock,
  Coins,
  ListChecks,
  Loader,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { OnboardingChecklist } from "@/features/dashboard/components/onboarding-checklist";
import { getDashboardOverview } from "@/features/dashboard/server/dashboard-service";
import { WorkforceMap } from "@/features/workforce/components/workforce-map";
import { SAMPLE_WORKFORCE } from "@/features/workforce/sample-data";
import { formatTokens as formatCompact } from "@/features/workforce/format";
import { formatUsd } from "@/features/usage/pricing";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const { greeting, checklist, counts, snapshot, today, recentEvents } =
    await getDashboardOverview(ctx);
  const firstName = ctx.user.name.split(/\s+/)[0];
  const hasAgents = counts.total > 0;
  const hasDepartments = snapshot.workforce.length > 0;
  const canManage = can(ctx.role, "agents:manage");
  const cost = today.cost;

  // All counts are real; cost comes from the versioned price list (unpriced calls count as $0).
  const kpis = [
    {
      label: "Total agents",
      icon: Bot,
      value: String(counts.total),
      accent: "var(--color-foreground)",
      caption: hasAgents
        ? `${counts.OFFLINE + counts.DISCONNECTED} offline`
        : "No agents connected",
    },
    {
      label: "Working",
      icon: Loader,
      value: String(counts.WORKING),
      accent: "var(--color-primary)",
      caption: `${counts.ONLINE + counts.IDLE} online / idle`,
    },
    {
      label: "Waiting",
      icon: Clock,
      value: String(counts.WAITING),
      accent: "var(--color-warning)",
      caption: "Need approval",
    },
    {
      label: "Errors",
      icon: AlertTriangle,
      value: String(counts.FAILED),
      accent: "var(--color-error)",
      caption: "Failed agents",
    },
    {
      label: "Tasks today",
      icon: ListChecks,
      value: String(today.tasks),
      accent: "var(--color-cyan)",
      caption: today.tasks
        ? `${today.completed} completed · ${today.failed} failed`
        : "No tasks yet today",
    },
    {
      label: "Tokens",
      icon: Coins,
      value: formatCompact(today.tokens),
      accent: "var(--color-purple)",
      caption: today.tokens
        ? `${formatCompact(today.inputTokens)} in · ${formatCompact(today.outputTokens)} out`
        : "Today",
    },
    {
      label: "AI cost",
      icon: CircleDollarSign,
      value: cost ? formatUsd(cost.cost) : "—",
      accent: "var(--color-lime)",
      caption: !cost
        ? "Owners, admins & managers"
        : cost.unpricedCalls
          ? `Today · ${cost.unpricedCalls} unpriced calls`
          : "Today",
    },
  ];

  const connectHref = hasDepartments ? "/agents/new" : "/departments";

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {hasAgents
              ? `Your AI workforce: ${counts.total} agent${counts.total === 1 ? "" : "s"} across ${snapshot.workforce.length} departments.`
              : "Your control center is ready. Connect your first agent to start monitoring your AI workforce."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/help" className={buttonStyles("secondary", "sm")}>
            <Sparkles aria-hidden className="size-4 text-primary" /> How AgentOS works
          </Link>
          {canManage ? (
            <Link href={connectHref} className={buttonStyles("primary", "sm")}>
              <Plus aria-hidden className="size-4" /> Connect Agent
            </Link>
          ) : null}
        </div>
      </div>

      <section
        aria-label="Workforce KPIs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7"
      >
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </section>

      {hasAgents ? (
        <WorkforceMap
          departments={snapshot.workforce}
          live={{
            runtime: snapshot.runtime,
            events: recentEvents,
            totals: {
              tokens: today.tokens,
              cost: cost?.cost ?? 0,
              completed: today.completed,
              failed: today.failed,
            },
          }}
        />
      ) : (
        <WorkforceMap departments={SAMPLE_WORKFORCE} sample />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {hasAgents ? (
          <div className="rounded-[22px] border border-border bg-surface p-6 lg:col-span-2">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Next step
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">Bring your agents online</h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Agents show as <strong className="text-foreground">Offline</strong> until they send a
              heartbeat or event with their API key. Try it with the demo agent:{" "}
              <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs text-foreground">
                npm run demo:agent -- --key aos_live_…
              </code>
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/agents" className={buttonStyles("secondary", "md")}>
                View agents <ArrowRight aria-hidden className="size-4" />
              </Link>
              {canManage ? (
                <Link href="/agents/new" className={buttonStyles("ghost", "md")}>
                  <Plus aria-hidden className="size-4" /> Connect another agent
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[22px] border border-border bg-surface p-6 lg:col-span-2">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl"
            />
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Your workforce
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              Your AI workforce is empty.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              The map above shows a simulated sample. Connect an agent you already run — SDK, REST
              API, webhook or MCP — and AgentOS will show your real workforce here.
            </p>
            <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {["Connect", "Observe", "Review", "Control"].map((step, i) => (
                <li key={step} className="rounded-card border border-border bg-raised/60 p-3">
                  <span className="font-display text-2xl font-medium text-primary">0{i + 1}</span>
                  <p className="mt-1 text-sm font-medium text-foreground">{step}</p>
                </li>
              ))}
            </ol>
            {canManage ? (
              <Link href={connectHref} className={buttonStyles("primary", "md", "mt-6")}>
                <Plus aria-hidden className="size-4" />
                {hasDepartments ? "Connect Your First Agent" : "Create a department first"}
              </Link>
            ) : null}
          </div>
        )}
        <OnboardingChecklist items={checklist} />
      </div>
    </div>
  );
}
