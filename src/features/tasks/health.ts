/**
 * Agent health (spec §53): Healthy / Warning / Critical with human-readable reasons.
 * Pure, so the thresholds are unit-tested and documented in one place.
 */
export type Health = "HEALTHY" | "WARNING" | "CRITICAL" | "UNKNOWN";

export interface HealthInput {
  status: string;
  lastHeartbeatAt: Date | null;
  /** Last 24 h */
  completed: number;
  failed: number;
  /** Consecutive failures among the most recent tasks. */
  failureStreak: number;
  avgLatencyMs: number | null;
  now?: Date;
}

export const HEALTH_THRESHOLDS = {
  failureRateWarning: 0.1,
  failureRateCritical: 0.3,
  failureStreakCritical: 3,
  latencyWarningMs: 10_000,
  silentWarningMs: 2 * 60 * 1000,
  silentCriticalMs: 60 * 60 * 1000,
} as const;

export function computeHealth(input: HealthInput): { health: Health; reasons: string[] } {
  const now = input.now ?? new Date();
  const t = HEALTH_THRESHOLDS;
  if (!input.lastHeartbeatAt && input.completed + input.failed === 0) {
    return { health: "UNKNOWN", reasons: ["No heartbeat or events yet"] };
  }
  const critical: string[] = [];
  const warning: string[] = [];

  const finished = input.completed + input.failed;
  const failureRate = finished ? input.failed / finished : 0;
  if (finished >= 3 && failureRate >= t.failureRateCritical)
    critical.push(`${Math.round(failureRate * 100)}% of tasks failed (24 h)`);
  else if (finished >= 3 && failureRate >= t.failureRateWarning)
    warning.push(`${Math.round(failureRate * 100)}% of tasks failed (24 h)`);
  if (input.failureStreak >= t.failureStreakCritical)
    critical.push(`${input.failureStreak} consecutive failed tasks`);
  if (input.status === "FAILED" && input.failureStreak < t.failureStreakCritical)
    warning.push("Last task failed");

  if (input.lastHeartbeatAt) {
    const silent = now.getTime() - input.lastHeartbeatAt.getTime();
    if (silent >= t.silentCriticalMs)
      critical.push(`No heartbeat for ${Math.round(silent / 3_600_000)} h`);
    else if (silent >= t.silentWarningMs)
      warning.push(`No heartbeat for ${Math.round(silent / 60_000)} min`);
  }
  if (input.avgLatencyMs !== null && input.avgLatencyMs >= t.latencyWarningMs) {
    warning.push(`High LLM latency (${(input.avgLatencyMs / 1000).toFixed(1)}s avg)`);
  }

  if (critical.length) return { health: "CRITICAL", reasons: [...critical, ...warning] };
  if (warning.length) return { health: "WARNING", reasons: warning };
  return { health: "HEALTHY", reasons: [] };
}

/** Length of the run of FAILED at the start of a newest-first status list. */
export function failureStreak(statusesNewestFirst: string[]): number {
  let n = 0;
  for (const s of statusesNewestFirst) {
    if (s === "FAILED") n++;
    else if (s === "COMPLETED" || s === "CANCELLED") break;
  }
  return n;
}

/** "+1.4s" style offset of an event from the task start. */
export function formatOffset(ms: number): string {
  if (ms < 0) ms = 0;
  if (ms < 1000) return `+${ms}ms`;
  if (ms < 60_000) return `+${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  return `+${m}m ${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}s`;
}
