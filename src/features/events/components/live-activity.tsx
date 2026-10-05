"use client";

import { Pause, Play, Radio } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui/input";
import { formatTokens } from "@/features/workforce/format";
import type { StreamActivity } from "@/features/workforce/live";
import { cn } from "@/lib/utils";

const TYPE: Record<string, { label: string; color: string }> = {
  TASK_STARTED: { label: "Task started", color: "var(--color-cyan)" },
  TASK_COMPLETED: { label: "Completed", color: "var(--color-primary)" },
  TASK_FAILED: { label: "Failed", color: "var(--color-error)" },
  TASK_CANCELLED: { label: "Cancelled", color: "var(--color-muted)" },
  LLM_CALL: { label: "LLM call", color: "var(--color-purple)" },
  TOOL_CALL: { label: "Tool call", color: "var(--color-lime)" },
  APPROVAL_REQUESTED: { label: "Approval", color: "var(--color-warning)" },
  LOG: { label: "Log", color: "var(--color-muted)" },
};

const MAX = 300;

interface Props {
  initial: StreamActivity[];
  departments: { id: string; name: string }[];
  agents: { id: string; name: string }[];
}

/** Full-page real-time activity stream (SSE) with client-side filters and pause. */
export function LiveActivity({ initial, departments, agents }: Props) {
  const [items, setItems] = useState<StreamActivity[]>(initial);
  const [paused, setPaused] = useState(false);
  const [buffer, setBuffer] = useState<StreamActivity[]>([]);
  const [connected, setConnected] = useState(false);
  const [department, setDepartment] = useState("");
  const [agent, setAgent] = useState("");

  const pausedRef = useRef(false);

  useEffect(() => {
    const source = new EventSource("/api/v1/activity/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("activity", (msg) => {
      const a = JSON.parse((msg as MessageEvent).data) as StreamActivity;
      const add = (list: StreamActivity[]) =>
        list.some((x) => x.id === a.id) ? list : [a, ...list].slice(0, MAX);
      // While paused, new events wait in a buffer so the list doesn't move under the reader.
      if (pausedRef.current) setBuffer(add);
      else setItems(add);
    });
    return () => source.close();
  }, []);

  const togglePause = () => {
    const next = !paused;
    pausedRef.current = next;
    setPaused(next);
    if (!next && buffer.length) {
      setItems((list) => {
        const known = new Set(list.map((i) => i.id));
        return [...buffer.filter((b) => !known.has(b.id)), ...list].slice(0, MAX);
      });
      setBuffer([]);
    }
  };

  const visible = useMemo(
    () =>
      items.filter(
        (i) => (!department || i.departmentId === department) && (!agent || i.agentId === agent),
      ),
    [items, department, agent],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-border bg-surface p-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
            connected ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted",
          )}
        >
          <Radio aria-hidden className={cn("size-3.5", connected && !paused && "animate-blink")} />
          {connected ? (paused ? "Paused" : "Live") : "Connecting…"}
        </span>
        <Select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Filter by department"
          className="w-48"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          aria-label="Filter by agent"
          className="w-48"
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={togglePause}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-control border border-border bg-raised px-3 text-sm text-foreground hover:border-primary/50"
        >
          {paused ? (
            <Play aria-hidden className="size-4" />
          ) : (
            <Pause aria-hidden className="size-4" />
          )}
          {paused ? `Resume${buffer.length ? ` (${buffer.length} new)` : ""}` : "Pause"}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[18px] border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
          Agent activity will appear here when your agents start working.
        </p>
      ) : (
        <ol
          aria-label="Activity stream"
          className="divide-y divide-border overflow-hidden rounded-[18px] border border-border bg-surface"
        >
          {visible.map((e) => {
            const t = TYPE[e.type] ?? TYPE.LOG!;
            return (
              <li
                key={e.id}
                className="grid animate-rise grid-cols-[84px_minmax(0,1fr)] items-start gap-3 px-4 py-3 sm:grid-cols-[84px_110px_minmax(0,1fr)_auto]"
              >
                <time className="font-mono text-xs text-muted tabular-nums" dateTime={e.at}>
                  {new Date(e.at).toLocaleTimeString("en-US", { hour12: false })}
                </time>
                <span className="text-xs font-semibold" style={{ color: t.color }}>
                  {t.label}
                </span>
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <p className="text-sm text-foreground">
                    <Link href={`/agents/${e.agentId}`} className="font-medium hover:underline">
                      {e.agentName}
                    </Link>
                    <span className="text-muted"> · {e.departmentName}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {e.summary}
                    {e.taskId ? (
                      <>
                        {" "}
                        —{" "}
                        <Link
                          href={`/tasks/${e.taskId}`}
                          className="text-foreground hover:text-primary hover:underline"
                        >
                          {e.taskName ?? "view task"}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
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
      )}
    </div>
  );
}
