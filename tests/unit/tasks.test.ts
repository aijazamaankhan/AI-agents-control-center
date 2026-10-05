import { describe, expect, it } from "vitest";
import {
  computeHealth,
  failureStreak,
  formatOffset,
  HEALTH_THRESHOLDS,
} from "@/features/tasks/health";
import { taskFiltersSchema } from "@/features/tasks/schemas";

const now = new Date("2026-10-05T12:00:00Z");
const base = {
  status: "ONLINE",
  lastHeartbeatAt: new Date(now.getTime() - 10_000),
  completed: 10,
  failed: 0,
  failureStreak: 0,
  avgLatencyMs: 900,
  now,
};

describe("agent health", () => {
  it("is unknown before any signal", () => {
    expect(computeHealth({ ...base, lastHeartbeatAt: null, completed: 0 }).health).toBe("UNKNOWN");
  });
  it("is healthy with recent heartbeats and no failures", () => {
    expect(computeHealth(base)).toEqual({ health: "HEALTHY", reasons: [] });
  });
  it("warns on moderate failure rate, high latency or short silence", () => {
    expect(computeHealth({ ...base, completed: 8, failed: 1 }).health).toBe("WARNING");
    expect(
      computeHealth({ ...base, avgLatencyMs: HEALTH_THRESHOLDS.latencyWarningMs }).reasons[0],
    ).toMatch(/latency/);
    expect(
      computeHealth({ ...base, lastHeartbeatAt: new Date(now.getTime() - 5 * 60_000) }).reasons[0],
    ).toMatch(/5 min/);
  });
  it("is critical on high failure rate, failure streaks or long silence", () => {
    expect(computeHealth({ ...base, completed: 2, failed: 2 }).health).toBe("CRITICAL");
    expect(computeHealth({ ...base, failureStreak: 3, status: "FAILED" }).reasons).toContain(
      "3 consecutive failed tasks",
    );
    expect(
      computeHealth({ ...base, lastHeartbeatAt: new Date(now.getTime() - 3 * 3_600_000) }).health,
    ).toBe("CRITICAL");
  });
  it("ignores failure rate on tiny samples", () => {
    expect(computeHealth({ ...base, completed: 1, failed: 1 }).health).toBe("HEALTHY");
  });
  it("counts the leading failure streak", () => {
    expect(failureStreak(["FAILED", "FAILED", "COMPLETED", "FAILED"])).toBe(2);
    expect(failureStreak(["COMPLETED", "FAILED"])).toBe(0);
    expect(failureStreak([])).toBe(0);
  });
});

describe("trace offsets", () => {
  it("formats offsets from task start", () => {
    expect(formatOffset(0)).toBe("+0ms");
    expect(formatOffset(1820)).toBe("+1.8s");
    expect(formatOffset(124_000)).toBe("+2m 04s");
    expect(formatOffset(-5)).toBe("+0ms");
  });
});

describe("task filters", () => {
  it("drops unknown values instead of failing", () => {
    expect(
      taskFiltersSchema.parse({ status: "EXPLODED", range: "forever", page: "-3" }),
    ).toMatchObject({
      status: undefined,
      range: "7d",
      page: 1,
    });
    expect(
      taskFiltersSchema.parse({ status: "FAILED", range: "today", page: "4", q: "  leads " }),
    ).toMatchObject({
      status: "FAILED",
      range: "today",
      page: 4,
      q: "leads",
    });
  });
});
