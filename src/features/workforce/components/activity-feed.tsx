"use client";

import { Activity } from "lucide-react";
import { formatClock, formatCost, formatTokens } from "../format";
import type { ActivityEvent, ActivityKind, WorkforceDepartment } from "../types";
import { departmentAccent } from "../visuals";

const KIND_LABEL: Record<ActivityKind, { label: string; color: string }> = {
  "task.started": { label: "Task started", color: "var(--color-cyan)" },
  "llm.call": { label: "LLM call", color: "var(--color-purple)" },
  "tool.call": { label: "Tool call", color: "var(--color-lime)" },
  "approval.requested": { label: "Approval", color: "var(--color-warning)" },
  "approval.granted": { label: "Approved", color: "var(--color-primary)" },
  "task.completed": { label: "Completed", color: "var(--color-primary)" },
  "task.failed": { label: "Failed", color: "var(--color-error)" },
};

interface ActivityFeedProps {
  events: ActivityEvent[];
  departments: WorkforceDepartment[];
  limit?: number;
}

export function ActivityFeed({ events, departments, limit = 10 }: ActivityFeedProps) {
  const indexOf = (id: string) => departments.findIndex((d) => d.id === id);

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted">
        <Activity aria-hidden className="size-4" /> Waiting for the first agent event…
      </div>
    );
  }

  return (
    <ol className="space-y-1.5" aria-label="Live activity">
      {events.slice(0, limit).map((e) => {
        const kind = KIND_LABEL[e.kind];
        const accent = departmentAccent(e.departmentName, indexOf(e.departmentId));
        return (
          <li
            key={e.id}
            className="animate-rise rounded-control border border-border bg-raised/60 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: accent }} />
                <span className="truncate font-medium text-foreground">{e.agentName}</span>
                <span className="truncate text-muted">· {e.departmentName}</span>
              </span>
              <time className="shrink-0 font-mono text-muted tabular-nums">
                {formatClock(e.at)}
              </time>
            </div>
            <p className="mt-1 flex items-start gap-2 text-xs">
              <span className="shrink-0 font-medium" style={{ color: kind.color }}>
                {kind.label}
              </span>
              <span className="min-w-0 text-muted">{e.text}</span>
            </p>
            {e.tokens ? (
              <p className="mt-1 font-mono text-[11px] text-muted tabular-nums">
                {formatTokens(e.tokens)} tokens · {formatCost(e.cost ?? 0)}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
