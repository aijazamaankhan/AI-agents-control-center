import {
  Bot,
  CircleCheck,
  CircleX,
  Ban,
  FileText,
  Hand,
  Play,
  Wrench,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { formatTokens } from "@/features/workforce/format";
import { formatOffset } from "../health";

export interface TraceEvent {
  id: string;
  type: string;
  occurredAt: Date;
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  latencyMs: number | null;
  toolName: string | null;
  success: boolean | null;
  summary: string;
  metadata: unknown;
  executionId: string | null;
}

const STEP: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  TASK_STARTED: { label: "Task started", icon: Play, color: "var(--color-cyan)" },
  LLM_CALL: { label: "LLM call", icon: Bot, color: "var(--color-purple)" },
  TOOL_CALL: { label: "Tool call", icon: Wrench, color: "var(--color-lime)" },
  APPROVAL_REQUESTED: { label: "Approval requested", icon: Hand, color: "var(--color-warning)" },
  TASK_COMPLETED: { label: "Task completed", icon: CircleCheck, color: "var(--color-primary)" },
  TASK_FAILED: { label: "Task failed", icon: CircleX, color: "var(--color-error)" },
  TASK_CANCELLED: { label: "Task cancelled", icon: Ban, color: "var(--color-muted)" },
  LOG: { label: "Log", icon: FileText, color: "var(--color-muted)" },
};

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono text-foreground tabular-nums">{value}</dd>
    </>
  );
}

/** Ordered, expandable execution trace (spec §13). Uses <details> — works without JS. */
export function ExecutionTrace({ events, startedAt }: { events: TraceEvent[]; startedAt: Date }) {
  return (
    <ol className="relative space-y-2" aria-label="Execution trace">
      {events.map((e, i) => {
        const step = STEP[e.type] ?? STEP.LOG!;
        const Icon = step.icon;
        const tokens = e.inputTokens + e.outputTokens + e.cachedTokens;
        const hasMeta =
          e.metadata && typeof e.metadata === "object" && Object.keys(e.metadata).length > 0;
        return (
          <li key={e.id} className="relative pl-10">
            {i < events.length - 1 ? (
              <span
                aria-hidden
                className="absolute top-8 bottom-[-12px] left-[15px] w-px bg-border"
              />
            ) : null}
            <span
              className="absolute top-2.5 left-0 flex size-8 items-center justify-center rounded-full border"
              style={{
                borderColor: `color-mix(in oklab, ${step.color} 40%, transparent)`,
                color: step.color,
                background: "var(--color-surface)",
              }}
            >
              <Icon aria-hidden className="size-4" />
            </span>
            <details className="group rounded-card border border-border bg-raised/40 open:bg-raised/70">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="font-mono text-xs text-muted tabular-nums">
                  {e.occurredAt.toLocaleTimeString("en-US", { hour12: false })}
                  <span className="ml-1.5 text-muted/70">
                    {formatOffset(e.occurredAt.getTime() - startedAt.getTime())}
                  </span>
                </span>
                <span
                  className="text-xs font-semibold tracking-wide uppercase"
                  style={{ color: step.color }}
                >
                  {step.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{e.summary}</span>
                {tokens ? (
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {formatTokens(tokens)} tok
                  </span>
                ) : null}
                {e.latencyMs !== null ? (
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {(e.latencyMs / 1000).toFixed(2)}s
                  </span>
                ) : null}
                <ChevronDown
                  aria-hidden
                  className="size-4 text-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="border-t border-border px-4 py-3">
                <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
                  {e.provider ? <Detail label="Provider" value={e.provider} /> : null}
                  {e.model ? <Detail label="Model" value={e.model} /> : null}
                  {e.type === "LLM_CALL" ? (
                    <>
                      <Detail label="Input tokens" value={e.inputTokens.toLocaleString("en-US")} />
                      <Detail
                        label="Output tokens"
                        value={e.outputTokens.toLocaleString("en-US")}
                      />
                      <Detail
                        label="Cached tokens"
                        value={e.cachedTokens.toLocaleString("en-US")}
                      />
                    </>
                  ) : null}
                  {e.toolName ? <Detail label="Tool" value={e.toolName} /> : null}
                  {e.success !== null ? (
                    <Detail label="Succeeded" value={e.success ? "Yes" : "No"} />
                  ) : null}
                  {e.latencyMs !== null ? (
                    <Detail label="Latency" value={`${e.latencyMs.toLocaleString("en-US")} ms`} />
                  ) : null}
                  <Detail label="Event ID" value={e.id} />
                  {e.executionId ? <Detail label="Execution" value={e.executionId} /> : null}
                </dl>
                {hasMeta ? (
                  <pre className="scroller-x mt-3 rounded-control bg-background p-3 font-mono text-[11px] text-muted">
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
