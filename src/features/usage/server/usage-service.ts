import "server-only";
import type { OrgContext } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { addDays, localDay } from "@/lib/time";
import { USAGE_PERIODS, type UsagePeriod } from "../schemas";

/**
 * Usage & cost read side. Everything comes from the `usage_daily` aggregates (never raw
 * event scans) and is always scoped to the caller's organization.
 */

export interface UsageTotals {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  tokens: number;
  llmCalls: number;
  unpricedCalls: number;
}

export interface UsageBreakdownRow extends UsageTotals {
  id: string;
  label: string;
  sublabel?: string;
}

type SumRow = {
  _sum: {
    costUsd: { toNumber(): number } | null;
    inputTokens: bigint | null;
    outputTokens: bigint | null;
    cachedTokens: bigint | null;
    llmCalls: number | null;
    unpricedCalls: number | null;
  };
};

const SUM = {
  costUsd: true,
  inputTokens: true,
  outputTokens: true,
  cachedTokens: true,
  llmCalls: true,
  unpricedCalls: true,
} as const;

function totalsOf(row: SumRow | undefined): UsageTotals {
  const s = row?._sum;
  const inputTokens = Number(s?.inputTokens ?? 0);
  const outputTokens = Number(s?.outputTokens ?? 0);
  const cachedTokens = Number(s?.cachedTokens ?? 0);
  return {
    cost: s?.costUsd?.toNumber() ?? 0,
    inputTokens,
    outputTokens,
    cachedTokens,
    tokens: inputTokens + outputTokens + cachedTokens,
    llmCalls: s?.llmCalls ?? 0,
    unpricedCalls: s?.unpricedCalls ?? 0,
  };
}

function range(timeZone: string, days: number, now = new Date()) {
  const to = localDay(now, timeZone);
  const from = addDays(to, -(days - 1));
  return { from, to };
}

type Filter = { agentId?: string; departmentId?: string };

/** Totals for today (organization timezone). */
export async function usageToday(ctx: OrgContext, timeZone: string, filter: Filter = {}) {
  const day = localDay(new Date(), timeZone);
  const agg = await db.usageDaily.aggregate({
    where: { organizationId: ctx.organizationId, day, ...filter },
    _sum: SUM,
  });
  return totalsOf(agg);
}

/** Totals over the last `days` days. */
export async function usageTotals(
  ctx: OrgContext,
  timeZone: string,
  days: number,
  filter: Filter = {},
) {
  const { from, to } = range(timeZone, days);
  const agg = await db.usageDaily.aggregate({
    where: { organizationId: ctx.organizationId, day: { gte: from, lte: to }, ...filter },
    _sum: SUM,
  });
  return totalsOf(agg);
}

/** The Costs & Usage page: totals, previous-period comparison, daily series and breakdowns. */
export async function getUsageReport(
  ctx: OrgContext,
  timeZone: string,
  period: UsagePeriod,
  filter: Filter = {},
) {
  const days = USAGE_PERIODS[period];
  const { from, to } = range(timeZone, days);
  const prevFrom = addDays(from, -days);
  const prevTo = addDays(from, -1);
  const where = { organizationId: ctx.organizationId, day: { gte: from, lte: to }, ...filter };

  const [current, previous, byDay, byDept, byAgent, byModel] = await Promise.all([
    db.usageDaily.aggregate({ where, _sum: SUM }),
    db.usageDaily.aggregate({
      where: { ...where, day: { gte: prevFrom, lte: prevTo } },
      _sum: SUM,
    }),
    db.usageDaily.groupBy({ by: ["day"], where, _sum: SUM, orderBy: { day: "asc" } }),
    db.usageDaily.groupBy({ by: ["departmentId"], where, _sum: SUM }),
    db.usageDaily.groupBy({ by: ["agentId"], where, _sum: SUM }),
    db.usageDaily.groupBy({ by: ["priceKey", "provider", "model"], where, _sum: SUM }),
  ]);

  const [departments, agents] = await Promise.all([
    db.department.findMany({
      where: { organizationId: ctx.organizationId, id: { in: byDept.map((r) => r.departmentId) } },
      select: { id: true, name: true },
    }),
    db.agent.findMany({
      where: { organizationId: ctx.organizationId, id: { in: byAgent.map((r) => r.agentId) } },
      select: { id: true, name: true, department: { select: { name: true } } },
    }),
  ]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const agentInfo = new Map(agents.map((a) => [a.id, a]));

  const byCost = (a: UsageBreakdownRow, b: UsageBreakdownRow) =>
    b.cost - a.cost || b.tokens - a.tokens;

  const dayTotals = new Map(byDay.map((r) => [r.day.toISOString().slice(0, 10), totalsOf(r)]));
  const series = Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i).toISOString().slice(0, 10);
    return { date, ...(dayTotals.get(date) ?? totalsOf(undefined)) };
  });

  // Several model spellings can share one price key; merge them.
  const models = new Map<string, UsageBreakdownRow>();
  for (const r of byModel) {
    const t = totalsOf(r);
    const prev = models.get(r.priceKey);
    models.set(
      r.priceKey,
      prev ? mergeTotals(prev, t) : { id: r.priceKey, label: r.model, sublabel: r.provider, ...t },
    );
  }

  return {
    period,
    days,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    totals: totalsOf(current),
    previous: totalsOf(previous),
    series,
    departments: byDept
      .map((r) => ({
        id: r.departmentId,
        label: deptName.get(r.departmentId) ?? "Deleted department",
        ...totalsOf(r),
      }))
      .sort(byCost),
    agents: byAgent
      .map((r) => ({
        id: r.agentId,
        label: agentInfo.get(r.agentId)?.name ?? "Deleted agent",
        sublabel: agentInfo.get(r.agentId)?.department.name,
        ...totalsOf(r),
      }))
      .sort(byCost),
    models: [...models.values()].sort(byCost),
  };
}

function mergeTotals<T extends UsageTotals>(a: T, b: UsageTotals): T {
  return {
    ...a,
    cost: a.cost + b.cost,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cachedTokens: a.cachedTokens + b.cachedTokens,
    tokens: a.tokens + b.tokens,
    llmCalls: a.llmCalls + b.llmCalls,
    unpricedCalls: a.unpricedCalls + b.unpricedCalls,
  };
}

export type UsageReport = Awaited<ReturnType<typeof getUsageReport>>;
