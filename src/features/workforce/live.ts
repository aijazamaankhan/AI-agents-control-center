import type { ActivityEvent, ActivityKind, AgentRuntime } from "./types";

/** Shape of an `activity` message from /api/v1/activity/stream (see features/events/server/activity.ts). */
export interface StreamActivity {
  id: string;
  at: string;
  type: string;
  agentId: string;
  agentName: string;
  departmentId: string;
  departmentName: string;
  taskId: string | null;
  summary: string;
  tokens: number;
  toolName: string | null;
  taskName: string | null;
}

const KIND: Record<string, ActivityKind> = {
  TASK_STARTED: "task.started",
  TASK_COMPLETED: "task.completed",
  TASK_FAILED: "task.failed",
  TASK_CANCELLED: "task.cancelled",
  LLM_CALL: "llm.call",
  TOOL_CALL: "tool.call",
  APPROVAL_REQUESTED: "approval.requested",
  APPROVAL_DECIDED: "log",
  LOG: "log",
};

export function toActivityEvent(a: StreamActivity): ActivityEvent {
  return {
    id: a.id,
    at: new Date(a.at).getTime(),
    agentId: a.agentId,
    agentName: a.agentName,
    departmentId: a.departmentId,
    departmentName: a.departmentName,
    kind: KIND[a.type] ?? "log",
    text: a.summary,
    tokens: a.tokens || undefined,
  };
}

/** Applies a reported event to an agent's live runtime (pure; unit-tested). */
export function applyActivity(rt: AgentRuntime, a: StreamActivity): AgentRuntime {
  const task = a.taskName ?? rt.task;
  switch (a.type) {
    case "TASK_STARTED":
      return { ...rt, status: "WORKING", stage: "start", task: a.taskName, tool: null };
    case "LLM_CALL":
      return { ...rt, status: "WORKING", stage: "llm", task, tokens: rt.tokens + a.tokens };
    case "TOOL_CALL":
      return { ...rt, status: "WORKING", stage: "tool", task, tool: a.toolName };
    case "APPROVAL_REQUESTED":
      return { ...rt, status: "WAITING", stage: "review", task };
    case "APPROVAL_DECIDED":
      return rt.status === "WAITING" ? { ...rt, status: "WORKING", stage: null } : rt;
    case "TASK_COMPLETED":
      return {
        ...rt,
        status: "IDLE",
        stage: null,
        task: null,
        tool: null,
        completed: rt.completed + 1,
      };
    case "TASK_FAILED":
      return { ...rt, status: "FAILED", stage: "failed", task, tool: null, failed: rt.failed + 1 };
    case "TASK_CANCELLED":
      return { ...rt, status: "IDLE", stage: null, task: null, tool: null };
    default:
      return rt;
  }
}

/** Server agent status → map status. */
export function mapStatus(status: string): AgentRuntime["status"] {
  if (status === "WORKING" || status === "WAITING" || status === "FAILED") return status;
  if (status === "ONLINE" || status === "IDLE") return "IDLE";
  return "OFFLINE";
}
