import type { ActivityItem } from "../server/activity";
import { formatTokens } from "@/features/workforce/format";

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  TASK_STARTED: { label: "Task started", color: "var(--color-cyan)" },
  TASK_COMPLETED: { label: "Completed", color: "var(--color-primary)" },
  TASK_FAILED: { label: "Failed", color: "var(--color-error)" },
  TASK_CANCELLED: { label: "Cancelled", color: "var(--color-muted)" },
  LLM_CALL: { label: "LLM call", color: "var(--color-purple)" },
  TOOL_CALL: { label: "Tool call", color: "var(--color-lime)" },
  APPROVAL_REQUESTED: { label: "Approval", color: "var(--color-warning)" },
  LOG: { label: "Log", color: "var(--color-muted)" },
};

export function ActivityList({
  items,
  showAgent = true,
}: {
  items: ActivityItem[];
  showAgent?: boolean;
}) {
  return (
    <ol className="divide-y divide-border" aria-label="Activity">
      {items.map((e) => {
        const t = TYPE_LABEL[e.type] ?? TYPE_LABEL.LOG!;
        return (
          <li
            key={e.id}
            className="grid grid-cols-[90px_minmax(0,1fr)] gap-3 px-4 py-3 sm:grid-cols-[90px_120px_minmax(0,1fr)_auto]"
          >
            <time className="font-mono text-xs text-muted tabular-nums" dateTime={e.at}>
              {new Date(e.at).toLocaleTimeString("en-US", { hour12: false })}
            </time>
            <span className="text-xs font-medium" style={{ color: t.color }}>
              {t.label}
            </span>
            <span className="col-span-2 min-w-0 text-sm text-foreground sm:col-span-1">
              {showAgent ? <span className="font-medium">{e.agentName} · </span> : null}
              {e.summary}
              {e.taskName && e.type !== "TASK_STARTED" ? (
                <span className="text-muted"> — {e.taskName}</span>
              ) : null}
            </span>
            {e.tokens ? (
              <span className="col-span-2 font-mono text-xs text-muted tabular-nums sm:col-span-1">
                {formatTokens(e.tokens)} tok
              </span>
            ) : (
              <span className="hidden sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
