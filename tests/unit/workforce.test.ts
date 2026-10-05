import { describe, expect, it } from "vitest";
import { computeLayout, LAYOUT, MAX_VISIBLE_AGENTS } from "@/features/workforce/layout";
import { SAMPLE_WORKFORCE } from "@/features/workforce/sample-data";
import {
  advanceAgent,
  countByStatus,
  createRng,
  initialSimState,
  MAX_EVENTS,
  priceTokens,
  stepSim,
} from "@/features/workforce/simulation";
import type { WorkforceDepartment } from "@/features/workforce/types";
import { ACCENTS, departmentAccent, departmentIcon } from "@/features/workforce/visuals";
import { Building2, Headphones, TrendingUp } from "lucide-react";

function makeDepartments(count: number, agentsEach: number): WorkforceDepartment[] {
  return Array.from({ length: count }, (_, d) => ({
    id: `dep_${d}`,
    name: `Department ${d}`,
    agents: Array.from({ length: agentsEach }, (_, a) => ({
      id: `agt_${d}_${a}`,
      name: `Agent ${a}`,
      provider: "Custom" as const,
      model: "Llama 70B",
      tools: ["tool"],
      tasks: [{ name: "Task", result: "Done" }],
    })),
  }));
}

describe("workforce layout", () => {
  it("grows horizontally with any number of departments", () => {
    const small = computeLayout(makeDepartments(3, 2));
    const large = computeLayout(makeDepartments(40, 2));
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.width).toBeGreaterThanOrEqual(LAYOUT.laneStart + 40 * LAYOUT.laneWidth);
    expect(large.height).toBe(small.height); // more departments never make the map taller
  });

  it("caps visible agents per lane and reports the overflow", () => {
    const layout = computeLayout(makeDepartments(1, 11));
    const lane = layout.lanes[0]!;
    expect(lane.agents).toHaveLength(MAX_VISIBLE_AGENTS);
    expect(lane.overflow).toBe(11 - MAX_VISIBLE_AGENTS);
    expect(lane.overflowY).not.toBeNull();
    expect(layout.height).toBeGreaterThanOrEqual(lane.overflowY!);
  });

  it("keeps lanes from overlapping and produces a path per visible agent", () => {
    const layout = computeLayout(SAMPLE_WORKFORCE);
    for (let i = 1; i < layout.lanes.length; i++) {
      expect(layout.lanes[i]!.x - layout.lanes[i - 1]!.x).toBeGreaterThanOrEqual(LAYOUT.cardWidth);
    }
    for (const lane of layout.lanes) {
      expect(Object.keys(lane.agentPaths)).toHaveLength(lane.agents.length);
      expect(lane.hubPath.startsWith("M ")).toBe(true);
    }
  });

  it("handles an organization with no departments", () => {
    const layout = computeLayout([]);
    expect(layout.lanes).toEqual([]);
    expect(layout.width).toBeGreaterThan(LAYOUT.hub.width);
  });
});

describe("preview simulation", () => {
  it("is deterministic for a given seed", () => {
    const run = () => {
      const rng = createRng(42);
      let s = initialSimState(SAMPLE_WORKFORCE);
      for (let i = 0; i < 50; i++) s = stepSim(s, SAMPLE_WORKFORCE, rng, 1000 + i);
      return s;
    };
    expect(run()).toEqual(run());
  });

  it("walks an agent through the full task lifecycle", () => {
    const agent = SAMPLE_WORKFORCE[0]!.agents[0]!; // no approval step
    const rng = createRng(1);
    let rt = initialSimState([{ id: "d", name: "D", agents: [{ ...agent, id: "x" }] }]).agents.x!;
    rt = { ...rt, status: "IDLE", stage: null, task: null };
    const kinds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const t = advanceAgent(agent, rt, rng);
      rt = t.runtime;
      if (t.event) kinds.push(t.event.kind);
    }
    expect(kinds.slice(0, 3)).toEqual(["task.started", "llm.call", "tool.call"]);
    expect(["task.completed", "task.failed"]).toContain(kinds[3]);
    expect(rt.status).toBe("IDLE");
  });

  it("only requests approval for agents with an approval action", () => {
    const rng = createRng(3);
    const noApproval = SAMPLE_WORKFORCE[0]!.agents[0]!;
    for (let i = 0; i < 200; i++) {
      const t = advanceAgent(
        noApproval,
        {
          status: "WORKING",
          stage: "tool",
          task: "x",
          tool: null,
          tokens: 0,
          cost: 0,
          completed: 0,
          failed: 0,
        },
        rng,
      );
      expect(t.event?.kind).not.toBe("approval.requested");
    }
  });

  it("keeps totals consistent with emitted events and bounds the feed", () => {
    const rng = createRng(9);
    const initial = initialSimState(SAMPLE_WORKFORCE);
    let s = initial;
    let tokens = initial.totals.tokens;
    for (let i = 0; i < 300; i++) {
      const next = stepSim(s, SAMPLE_WORKFORCE, rng, i);
      const fresh = next.events.filter((e) => e.id > s.seq);
      tokens += fresh.reduce((sum, e) => sum + (e.tokens ?? 0), 0);
      s = next;
    }
    expect(s.totals.tokens).toBe(tokens);
    expect(s.events.length).toBeLessThanOrEqual(MAX_EVENTS);
    const c = countByStatus(s);
    expect(c.WORKING + c.WAITING + c.IDLE + c.FAILED).toBe(Object.keys(s.agents).length);
  });

  it("prices tokens per model", () => {
    expect(priceTokens("Claude Sonnet", 1_000_000, 0)).toBe(3);
    expect(priceTokens("Claude Sonnet", 0, 1_000_000)).toBe(15);
  });
});

describe("department visuals", () => {
  it("derives stable accents for unlimited, user-created departments", () => {
    expect(departmentAccent("Warehouse Robotics")).toBe(departmentAccent("warehouse robotics"));
    expect(ACCENTS).toContain(departmentAccent("Anything at all"));
    expect(departmentAccent("A", 0)).not.toBe(departmentAccent("B", 1));
  });

  it("guesses icons from department names with a safe fallback", () => {
    expect(departmentIcon("Sales")).toBe(TrendingUp);
    expect(departmentIcon("Customer Support")).toBe(Headphones);
    expect(departmentIcon("Zebra Wrangling")).toBe(Building2);
  });
});
