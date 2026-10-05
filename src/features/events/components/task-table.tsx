import { CircleCheck, CircleX, Clock, LoaderCircle, Ban, type LucideIcon } from "lucide-react";
import type { TaskStatus } from "@/generated/prisma/enums";
import { formatTokens } from "@/features/workforce/format";
import { relativeTime } from "@/features/agents/format";

export interface TaskRow {
  id: string;
  name: string;
  status: TaskStatus;
  startedAt: Date;
  durationMs: number | null;
  inputTokens: bigint;
  outputTokens: bigint;
  cachedTokens: bigint;
  llmCalls: number;
  toolCalls: number;
  error: string | null;
}

export const TASK_STATUS: Record<TaskStatus, { label: string; icon: LucideIcon; color: string }> = {
  QUEUED: { label: "Queued", icon: Clock, color: "var(--color-muted)" },
  RUNNING: { label: "Running", icon: LoaderCircle, color: "var(--color-primary)" },
  WAITING: { label: "Waiting", icon: Clock, color: "var(--color-warning)" },
  COMPLETED: { label: "Completed", icon: CircleCheck, color: "var(--color-primary)" },
  FAILED: { label: "Failed", icon: CircleX, color: "var(--color-error)" },
  CANCELLED: { label: "Cancelled", icon: Ban, color: "var(--color-muted)" },
};

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Status shown with icon + label + colour (never colour alone). */
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = TASK_STATUS[status];
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color: s.color }}
    >
      <Icon aria-hidden className={`size-3.5 ${status === "RUNNING" ? "animate-spin" : ""}`} />
      {s.label}
    </span>
  );
}

export function TaskTable({ tasks }: { tasks: TaskRow[] }) {
  return (
    <div className="scroller-x">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] tracking-wide text-muted uppercase">
            <th className="px-4 py-3 font-medium">Task</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Started</th>
            <th className="px-4 py-3 font-medium">Duration</th>
            <th className="px-4 py-3 text-right font-medium">Tokens</th>
            <th className="px-4 py-3 text-right font-medium">Calls</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tasks.map((t) => (
            <tr key={t.id} className="align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">{t.name}</p>
                <p className="font-mono text-[11px] text-muted">{t.id}</p>
                {t.error ? <p className="mt-1 text-xs text-error">{t.error}</p> : null}
              </td>
              <td className="px-4 py-3">
                <TaskStatusBadge status={t.status} />
              </td>
              <td className="px-4 py-3 text-muted">{relativeTime(t.startedAt)}</td>
              <td className="px-4 py-3 text-muted tabular-nums">{formatDuration(t.durationMs)}</td>
              <td className="px-4 py-3 text-right text-foreground tabular-nums">
                {formatTokens(Number(t.inputTokens + t.outputTokens + t.cachedTokens))}
              </td>
              <td className="px-4 py-3 text-right text-muted tabular-nums">
                {t.llmCalls} LLM · {t.toolCalls} tool
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
