import { SAMPLE_PRICING_PER_MTOK } from "./sample-data";
import type { ActivityEvent, AgentRuntime, WorkforceAgent, WorkforceDepartment } from "./types";

/**
 * Preview simulation: generates believable activity for the SAMPLE workforce so the
 * map can be demonstrated before real agents report events. Pure + deterministic
 * given the RNG, so it is unit-testable. Real data will drive the same AgentRuntime
 * shape from ingested events (Phase 4–5).
 */

export type Rng = () => number;

/** mulberry32 — small, fast, seedable. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimState {
  agents: Record<string, AgentRuntime>;
  events: ActivityEvent[];
  totals: { tokens: number; cost: number; completed: number; failed: number };
  seq: number;
}

export const MAX_EVENTS = 40;

const idle = (): AgentRuntime => ({
  status: "IDLE",
  stage: null,
  task: null,
  tool: null,
  tokens: 0,
  cost: 0,
  completed: 0,
  failed: 0,
});

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length) % items.length]!;
}

export function priceTokens(model: string, input: number, output: number): number {
  const p = SAMPLE_PRICING_PER_MTOK[model] ?? { input: 1, output: 4 };
  return (input * p.input + output * p.output) / 1_000_000;
}

/** Deterministic starting picture: a busy but plausible workforce. */
export function initialSimState(departments: WorkforceDepartment[]): SimState {
  const agents: Record<string, AgentRuntime> = {};
  const totals = { tokens: 0, cost: 0, completed: 0, failed: 0 };
  let i = 0;
  for (const dep of departments) {
    for (const agent of dep.agents) {
      const r = idle();
      const task = agent.tasks[0]?.name ?? null;
      if (i % 3 === 0) Object.assign(r, { status: "WORKING", stage: "llm", task });
      else if (i % 3 === 1 && i % 2 === 0)
        Object.assign(r, { status: "WORKING", stage: "tool", task, tool: agent.tools[0] ?? null });
      else if (agent.approvalAction && i % 4 === 1)
        Object.assign(r, { status: "WAITING", stage: "review", task });
      // Plausible usage earlier in the session so totals aren't zero while agents are busy.
      const input = 6000 + ((i * 7919) % 42000);
      const output = Math.round(input * 0.22);
      r.tokens = input + output;
      r.cost = priceTokens(agent.model, input, output);
      r.completed = (i * 3) % 7;
      totals.tokens += r.tokens;
      totals.cost += r.cost;
      totals.completed += r.completed;
      agents[agent.id] = r;
      i++;
    }
  }
  return { agents, events: [], totals, seq: 0 };
}

function findAgent(departments: WorkforceDepartment[], agentId: string) {
  for (const dep of departments) {
    const agent = dep.agents.find((a) => a.id === agentId);
    if (agent) return { dep, agent };
  }
  return null;
}

type Transition = {
  runtime: AgentRuntime;
  event?: Omit<
    ActivityEvent,
    "id" | "at" | "agentId" | "agentName" | "departmentId" | "departmentName"
  >;
};

/** Advances one agent through: idle → start → llm → tool → (review) → done/failed → idle. */
export function advanceAgent(agent: WorkforceAgent, current: AgentRuntime, rng: Rng): Transition {
  const r: AgentRuntime = { ...current };
  switch (current.stage) {
    case null: {
      const task = pick(agent.tasks, rng);
      return {
        runtime: { ...r, status: "WORKING", stage: "start", task: task.name, tool: null },
        event: { kind: "task.started", text: `Started task "${task.name}"` },
      };
    }
    case "start": {
      const input = Math.round(1500 + rng() * 14000);
      const output = Math.round(300 + rng() * 3200);
      const cost = priceTokens(agent.model, input, output);
      return {
        runtime: { ...r, stage: "llm", tokens: r.tokens + input + output, cost: r.cost + cost },
        event: {
          kind: "llm.call",
          text: `${agent.model} · ${input.toLocaleString("en-US")} in / ${output.toLocaleString("en-US")} out`,
          tokens: input + output,
          cost,
        },
      };
    }
    case "llm": {
      const tool = pick(agent.tools, rng);
      const secs = (0.3 + rng() * 2.2).toFixed(1);
      return {
        runtime: { ...r, stage: "tool", tool },
        event: { kind: "tool.call", text: `Called ${tool} (${secs}s)` },
      };
    }
    case "tool": {
      const roll = rng();
      if (agent.approvalAction && roll < 0.45) {
        return {
          runtime: { ...r, status: "WAITING", stage: "review", tool: null },
          event: {
            kind: "approval.requested",
            text: `Approval requested: ${agent.approvalAction}`,
          },
        };
      }
      if (roll > 0.94) {
        return {
          runtime: { ...r, status: "FAILED", stage: "failed", tool: null, failed: r.failed + 1 },
          event: { kind: "task.failed", text: `Task failed: ${pick(agent.tools, rng)} timed out` },
        };
      }
      const result = agent.tasks.find((t) => t.name === r.task)?.result ?? "Done";
      return {
        runtime: { ...r, stage: "done", tool: null, completed: r.completed + 1 },
        event: { kind: "task.completed", text: `Task completed · ${result}` },
      };
    }
    case "review": {
      const result = agent.tasks.find((t) => t.name === r.task)?.result ?? "Done";
      return {
        runtime: { ...r, status: "WORKING", stage: "done", completed: r.completed + 1 },
        event: { kind: "approval.granted", text: `Approved by a manager · ${result}` },
      };
    }
    case "done":
    case "failed":
      return { runtime: { ...r, status: "IDLE", stage: null, task: null, tool: null } };
  }
}

/** One simulation tick: advances 1–2 random agents and records their events. */
export function stepSim(
  state: SimState,
  departments: WorkforceDepartment[],
  rng: Rng,
  now: number,
): SimState {
  const ids = Object.keys(state.agents);
  if (ids.length === 0) return state;
  const moves = rng() < 0.5 ? 1 : 2;
  const agents = { ...state.agents };
  const totals = { ...state.totals };
  let { seq } = state;
  const newEvents: ActivityEvent[] = [];

  for (let m = 0; m < moves; m++) {
    const id = pick(ids, rng);
    const found = findAgent(departments, id);
    if (!found) continue;
    const { runtime, event } = advanceAgent(found.agent, agents[id]!, rng);
    agents[id] = runtime;
    if (event) {
      seq += 1;
      newEvents.push({
        ...event,
        id: seq,
        at: now,
        agentId: id,
        agentName: found.agent.name,
        departmentId: found.dep.id,
        departmentName: found.dep.name,
      });
      if (event.tokens) totals.tokens += event.tokens;
      if (event.cost) totals.cost += event.cost;
      if (event.kind === "task.completed" || event.kind === "approval.granted")
        totals.completed += 1;
      if (event.kind === "task.failed") totals.failed += 1;
    }
  }

  return {
    agents,
    totals,
    seq,
    events: [...newEvents.reverse(), ...state.events].slice(0, MAX_EVENTS),
  };
}

export function countByStatus(state: SimState, agentIds?: string[]) {
  const ids = agentIds ?? Object.keys(state.agents);
  const out = { WORKING: 0, WAITING: 0, IDLE: 0, FAILED: 0 };
  for (const id of ids) {
    const s = state.agents[id]?.status;
    if (s) out[s] += 1;
  }
  return out;
}
