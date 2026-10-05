import { formatTokens } from "@/features/workforce/format";
import { formatUsd } from "../pricing";

interface Point {
  date: string;
  cost: number;
  tokens: number;
  llmCalls: number;
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Daily bars (pure CSS, server-rendered) with an accessible data table behind them. */
export function UsageChart({ series, metric }: { series: Point[]; metric: "cost" | "tokens" }) {
  const value = (p: Point) => (metric === "cost" ? p.cost : p.tokens);
  const fmt = (n: number) => (metric === "cost" ? formatUsd(n) : formatTokens(n));
  const max = Math.max(...series.map(value), 0);
  const peak = series.reduce((a, b) => (value(b) > value(a) ? b : a), series[0]!);
  const label =
    max > 0
      ? `Daily ${metric} from ${shortDate(series[0]!.date)} to ${shortDate(series.at(-1)!.date)}; peak ${fmt(value(peak))} on ${shortDate(peak.date)}.`
      : `No ${metric} recorded in this period.`;
  const every = Math.ceil(series.length / 8);

  return (
    <figure>
      <div role="img" aria-label={label} className="flex h-48 items-end gap-[2px] sm:gap-1">
        {series.map((p) => {
          const v = value(p);
          const h = max > 0 ? Math.max((v / max) * 100, v > 0 ? 2 : 0) : 0;
          return (
            <div
              key={p.date}
              title={`${shortDate(p.date)} · ${fmt(v)} · ${p.llmCalls} calls`}
              className="group relative flex h-full min-w-0 flex-1 items-end"
            >
              <div
                className="mx-auto w-full max-w-12 rounded-t-[3px] bg-primary/70 transition-colors group-hover:bg-primary"
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden className="mt-2 flex gap-[2px] text-[10px] text-muted sm:gap-1">
        {series.map((p, i) => (
          <span key={p.date} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {i % every === 0 ? shortDate(p.date) : ""}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">{label}</figcaption>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted hover:text-foreground">
          Show data table
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 text-right font-medium">Cost</th>
                <th className="py-1 text-right font-medium">Tokens</th>
                <th className="py-1 text-right font-medium">LLM calls</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.date} className="border-t border-border">
                  <td className="py-1">{shortDate(p.date)}</td>
                  <td className="py-1 text-right tabular-nums">{formatUsd(p.cost)}</td>
                  <td className="py-1 text-right tabular-nums">{formatTokens(p.tokens)}</td>
                  <td className="py-1 text-right tabular-nums">{p.llmCalls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
