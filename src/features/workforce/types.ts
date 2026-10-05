export type Provider = "Anthropic" | "OpenAI" | "Google" | "Custom";

/** Static description of an agent (what the control plane knows about it). */
export interface WorkforceAgent {
  id: string;
  name: string;
  provider: Provider;
  model: string;
  tools: string[];
  tasks: { name: string; result: string }[];
  /** Action that requires human approval before completing, if any. */
  approvalAction?: string;
}

export interface WorkforceDepartment {
  id: string;
  name: string;
  agents: WorkforceAgent[];
}

/** OFFLINE only occurs for real agents (no heartbeat yet); the preview simulation never produces it. */
export type AgentStatus = "WORKING" | "WAITING" | "IDLE" | "FAILED" | "OFFLINE";
export type TraceStage = "start" | "llm" | "tool" | "review" | "done" | "failed";

/** Live state of an agent, driven by events (or the preview simulation). */
export interface AgentRuntime {
  status: AgentStatus;
  stage: TraceStage | null;
  task: string | null;
  tool: string | null;
  tokens: number;
  cost: number;
  completed: number;
  failed: number;
}

export type ActivityKind =
  | "task.started"
  | "llm.call"
  | "tool.call"
  | "approval.requested"
  | "approval.granted"
  | "task.completed"
  | "task.failed"
  | "task.cancelled"
  | "log";

export interface ActivityEvent {
  id: number | string;
  at: number;
  agentId: string;
  agentName: string;
  departmentId: string;
  departmentName: string;
  kind: ActivityKind;
  text: string;
  tokens?: number;
  cost?: number;
}
