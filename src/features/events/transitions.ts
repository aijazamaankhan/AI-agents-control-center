import type { AgentStatus, ExecutionEventType, TaskStatus } from "@/generated/prisma/enums";
import type { AgentEventType } from "./schemas";

export const EVENT_TYPE_MAP: Record<AgentEventType, ExecutionEventType> = {
  "task.started": "TASK_STARTED",
  "task.completed": "TASK_COMPLETED",
  "task.failed": "TASK_FAILED",
  "task.cancelled": "TASK_CANCELLED",
  "llm.call": "LLM_CALL",
  "tool.call": "TOOL_CALL",
  "approval.requested": "APPROVAL_REQUESTED",
  log: "LOG",
};

export const TERMINAL: TaskStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];

/**
 * Next task status for an event, or an error message if the transition is illegal.
 * Late llm/tool/log events on a finished task are accepted (they still happened) but
 * never reopen it.
 */
export function nextTaskStatus(
  current: TaskStatus,
  event: ExecutionEventType,
): TaskStatus | { error: string } {
  const terminal = TERMINAL.includes(current);
  switch (event) {
    case "TASK_COMPLETED":
    case "TASK_FAILED":
    case "TASK_CANCELLED":
      if (terminal) return { error: `Task is already ${current.toLowerCase()}.` };
      return event === "TASK_COMPLETED"
        ? "COMPLETED"
        : event === "TASK_FAILED"
          ? "FAILED"
          : "CANCELLED";
    case "APPROVAL_REQUESTED":
      return terminal ? current : "WAITING";
    case "LLM_CALL":
    case "TOOL_CALL":
      // Work resumed after an approval → running again.
      return current === "WAITING" ? "RUNNING" : current;
    default:
      return current;
  }
}

/**
 * Agent status implied by an event. `otherActive` = the agent's other RUNNING/WAITING
 * tasks after this event, so finishing one task doesn't hide another in progress.
 */
export function agentStatusAfter(
  event: ExecutionEventType,
  otherActive: { running: number; waiting: number },
): AgentStatus {
  switch (event) {
    case "TASK_FAILED":
      return "FAILED";
    case "APPROVAL_REQUESTED":
      return "WAITING";
    case "TASK_COMPLETED":
    case "TASK_CANCELLED":
      return otherActive.running > 0 ? "WORKING" : otherActive.waiting > 0 ? "WAITING" : "ONLINE";
    case "LOG":
      return otherActive.running > 0 ? "WORKING" : otherActive.waiting > 0 ? "WAITING" : "ONLINE";
    default:
      return "WORKING";
  }
}

/** Deterministic JSON (sorted keys) so equal payloads hash equally regardless of key order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** Feed line for an event — never includes prompts, arguments or results. */
export function summarize(e: {
  type: ExecutionEventType;
  taskName?: string | null;
  provider?: string | null;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  toolName?: string | null;
  success?: boolean | null;
  action?: string;
  message?: string;
  error?: string | null;
}): string {
  const n = (v = 0) => v.toLocaleString("en-US");
  switch (e.type) {
    case "TASK_STARTED":
      return `Started task "${e.taskName ?? ""}"`;
    case "TASK_COMPLETED":
      return `Task completed · ${e.taskName ?? ""}`;
    case "TASK_FAILED":
      return `Task failed${e.error ? `: ${e.error.slice(0, 120)}` : ""}`;
    case "TASK_CANCELLED":
      return "Task cancelled";
    case "LLM_CALL":
      return `${e.model ?? "LLM"} · ${n(e.inputTokens)} in / ${n(e.outputTokens)} out`;
    case "TOOL_CALL":
      return `Called ${e.toolName}${e.success === false ? " (failed)" : ""}`;
    case "APPROVAL_REQUESTED":
      return `Approval requested: ${e.action ?? ""}`;
    case "APPROVAL_DECIDED":
      return e.message ?? "Approval decided";
    case "LOG":
      return e.message ?? "";
  }
}
