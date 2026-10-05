import Link from "next/link";
import { Folder } from "@/components/ui/folder";
import { formatTokens } from "@/features/workforce/format";
import { formatUsd } from "../pricing";
import type { UsageBreakdownRow } from "../server/usage-service";

/** Ranked breakdown (by cost, then tokens) with a share-of-total bar. */
export function UsageBreakdown({
  title,
  rows,
  totalCost,
  totalTokens,
  hrefFor,
}: {
  title: string;
  rows: UsageBreakdownRow[];
  totalCost: number;
  totalTokens: number;
  hrefFor?: (id: string) => string;
}) {
  const byCost = totalCost > 0;
  return (
    <Folder as="h2" tab={title} className="p-5 pt-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No usage in this period.</p>
      ) : (
        <ul className="space-y-3" aria-label={title}>
          {rows.slice(0, 8).map((r) => {
            const share = byCost
              ? r.cost / totalCost
              : totalTokens > 0
                ? r.tokens / totalTokens
                : 0;
            return (
              <li key={r.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {hrefFor ? (
                      <Link href={hrefFor(r.id)} className="text-foreground hover:text-primary">
                        {r.label}
                      </Link>
                    ) : (
                      <span className="text-foreground">{r.label}</span>
                    )}
                    {r.sublabel ? (
                      <span className="ml-2 text-xs text-muted">{r.sublabel}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-foreground tabular-nums">{formatUsd(r.cost)}</span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(share * 100)}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right text-[11px] text-muted tabular-nums">
                    {formatTokens(r.tokens)} tok · {Math.round(share * 100)}%
                  </span>
                </div>
                {r.unpricedCalls > 0 ? (
                  <p className="mt-0.5 text-[11px] text-warning">
                    {r.unpricedCalls} unpriced call{r.unpricedCalls === 1 ? "" : "s"}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Folder>
  );
}
