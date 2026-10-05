import { AlertTriangle, CircleDollarSign, Coins, Cpu, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { getOrganization } from "@/features/organizations/server/organization-service";
import { UsageBreakdown } from "@/features/usage/components/usage-breakdown";
import { UsageChart } from "@/features/usage/components/usage-chart";
import { formatUsd } from "@/features/usage/pricing";
import { parsePeriod, USAGE_PERIODS } from "@/features/usage/schemas";
import { getUsageReport } from "@/features/usage/server/usage-service";
import { formatTokens } from "@/features/workforce/format";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Costs & Usage" };

function change(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "New this period" : "No change";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}% vs previous period`;
}

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "costs:read")) {
    return (
      <Card className="mx-auto max-w-xl">
        <EmptyState
          icon={Lock}
          title="Costs are visible to owners, admins and managers"
          description="Ask an owner or admin of your company if you need cost reports."
        />
      </Card>
    );
  }

  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const metric = sp.metric === "tokens" ? "tokens" : "cost";
  const org = await getOrganization(ctx);
  const report = await getUsageReport(ctx, org.timezone, period);
  const { totals, previous } = report;
  const hasUsage = totals.llmCalls > 0;
  const href = (p: string, m: string) => `/costs?${new URLSearchParams({ period: p, metric: m })}`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Costs & Usage</h1>
          <p className="mt-1 text-sm text-muted">
            Token usage and AI spend from your agents&apos; reported model calls, priced with a
            versioned price list. Days follow your company timezone ({org.timezone}).
          </p>
        </div>
        <nav aria-label="Period" className="flex gap-1 rounded-control border border-border p-1">
          {Object.keys(USAGE_PERIODS).map((p) => (
            <Link
              key={p}
              href={href(p, metric)}
              aria-current={p === period ? "page" : undefined}
              className={cn(
                "rounded-[8px] px-3 py-1 text-sm",
                p === period
                  ? "bg-primary/15 font-medium text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              Last {p.replace("d", " days")}
            </Link>
          ))}
        </nav>
      </div>

      <section aria-label="Usage KPIs" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="AI cost"
          icon={CircleDollarSign}
          value={formatUsd(totals.cost)}
          accent="var(--color-lime)"
          caption={change(totals.cost, previous.cost)}
        />
        <KpiCard
          label="Tokens"
          icon={Coins}
          value={formatTokens(totals.tokens)}
          accent="var(--color-purple)"
          caption={`${formatTokens(totals.inputTokens)} in · ${formatTokens(totals.outputTokens)} out · ${formatTokens(totals.cachedTokens)} cached`}
        />
        <KpiCard
          label="LLM calls"
          icon={Cpu}
          value={totals.llmCalls.toLocaleString("en-US")}
          accent="var(--color-cyan)"
          caption={
            totals.llmCalls
              ? `${formatUsd(totals.cost / totals.llmCalls)} avg per call`
              : "No calls yet"
          }
        />
        <KpiCard
          label="Unpriced calls"
          icon={AlertTriangle}
          value={totals.unpricedCalls.toLocaleString("en-US")}
          accent={totals.unpricedCalls ? "var(--color-warning)" : "var(--color-foreground)"}
          caption={
            totals.unpricedCalls
              ? "Model has no price yet — cost counted as $0"
              : "All calls priced"
          }
        />
      </section>

      {totals.unpricedCalls > 0 ? (
        <p className="rounded-control border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          Some model calls have no price yet, so they count as $0. They are priced automatically as
          soon as Velorex Studio adds a price for that model
          {ctx.user.isPlatformAdmin ? (
            <>
              {" "}
              —{" "}
              <Link href="/admin/pricing" className="font-medium text-orange hover:underline">
                open Pricing in the admin panel
              </Link>
            </>
          ) : null}
          .
        </p>
      ) : null}

      {hasUsage ? (
        <>
          <Card className="rounded-[18px] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Daily {metric === "cost" ? "cost" : "tokens"}
              </h2>
              <div className="flex gap-1 text-xs" role="group" aria-label="Chart metric">
                {(["cost", "tokens"] as const).map((m) => (
                  <Link
                    key={m}
                    href={href(period, m)}
                    aria-current={m === metric ? "true" : undefined}
                    className={cn(
                      "rounded-full border px-3 py-1",
                      m === metric
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted hover:text-foreground",
                    )}
                  >
                    {m === "cost" ? "Cost" : "Tokens"}
                  </Link>
                ))}
              </div>
            </div>
            <UsageChart series={report.series} metric={metric} />
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <UsageBreakdown
              title="By department"
              rows={report.departments}
              totalCost={totals.cost}
              totalTokens={totals.tokens}
              hrefFor={(id) => `/departments/${id}`}
            />
            <UsageBreakdown
              title="By agent"
              rows={report.agents}
              totalCost={totals.cost}
              totalTokens={totals.tokens}
              hrefFor={(id) => `/agents/${id}?tab=usage`}
            />
            <UsageBreakdown
              title="By model"
              rows={report.models}
              totalCost={totals.cost}
              totalTokens={totals.tokens}
            />
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={Coins}
            title="No model usage in this period"
            description="When your agents report llm.call events (SDK or Event API), tokens and cost show up here within seconds."
            action={
              <Link href="/help#costs" className="text-sm font-medium text-primary hover:underline">
                How costs are calculated →
              </Link>
            }
          />
        </Card>
      )}
    </div>
  );
}
