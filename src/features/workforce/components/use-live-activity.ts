"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { applyActivity, mapStatus, toActivityEvent, type StreamActivity } from "../live";
import { MAX_EVENTS, type SimState } from "../simulation";
import type { ActivityEvent, AgentRuntime } from "../types";

export interface LiveSeed {
  runtime: Record<string, AgentRuntime>;
  events?: ActivityEvent[];
  totals?: { tokens: number; cost: number; completed: number; failed: number };
}

/** Real-time workforce state from Server-Sent Events. EventSource reconnects automatically. */
export function useLiveActivity(seed: LiveSeed | undefined, enabled: boolean) {
  const [state, setState] = useState<SimState>(() => ({
    agents: seed?.runtime ?? {},
    events: seed?.events ?? [],
    totals: seed?.totals ?? { tokens: 0, cost: 0, completed: 0, failed: 0 },
    seq: 0,
  }));
  const [connected, setConnected] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    // Re-render server data (KPI cards, counts) shortly after meaningful changes, debounced.
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 1500);
    };
    let initialStatus = true; // the first status message is a full snapshot, not a change
    const source = new EventSource("/api/v1/activity/stream");
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("activity", (msg) => {
      const a = JSON.parse((msg as MessageEvent).data) as StreamActivity;
      if (a.type.startsWith("TASK_")) scheduleRefresh();
      setState((s) => {
        if (s.events.some((e) => e.id === a.id)) return s;
        const rt = s.agents[a.agentId];
        return {
          ...s,
          agents: rt ? { ...s.agents, [a.agentId]: applyActivity(rt, a) } : s.agents,
          events: [toActivityEvent(a), ...s.events].slice(0, MAX_EVENTS),
          totals: {
            ...s.totals,
            tokens: s.totals.tokens + (a.tokens || 0),
            completed: s.totals.completed + (a.type === "TASK_COMPLETED" ? 1 : 0),
            failed: s.totals.failed + (a.type === "TASK_FAILED" ? 1 : 0),
          },
        };
      });
    });
    source.addEventListener("status", (msg) => {
      const statuses = JSON.parse((msg as MessageEvent).data) as Record<string, string>;
      if (!initialStatus) scheduleRefresh();
      initialStatus = false;
      setState((s) => {
        const agents = { ...s.agents };
        for (const [id, status] of Object.entries(statuses)) {
          const rt = agents[id];
          if (!rt) continue;
          const next = mapStatus(status);
          // Keep stage/task detail while still working; clear it when idle/offline.
          agents[id] =
            next === "WORKING" || next === "WAITING"
              ? { ...rt, status: next }
              : {
                  ...rt,
                  status: next,
                  stage: null,
                  tool: null,
                  task: next === "FAILED" ? rt.task : null,
                };
        }
        return { ...s, agents };
      });
    });
    return () => {
      clearTimeout(refreshTimer);
      source.close();
    };
  }, [enabled, router]);

  return { state, connected };
}
