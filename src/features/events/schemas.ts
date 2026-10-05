import { z } from "zod";

/** Event API contract — docs/API.md. Field names are snake_case on the wire. */

const MAX_JSON_BYTES = 4096;
const TOKENS = z.number().int().min(0).max(50_000_000);

const smallJson = z
  .unknown()
  .refine(
    (v) => v === undefined || JSON.stringify(v).length <= MAX_JSON_BYTES,
    `Must be at most ${MAX_JSON_BYTES} bytes of JSON`,
  );

const clientTaskId = z
  .string()
  .regex(/^task_[A-Za-z0-9]{8,40}$/, "task_id must look like task_<8-40 letters/digits>");

const base = {
  agent_id: z.string().max(64).optional(),
  task_id: z.string().max(64).optional(),
  execution_id: z.string().max(64).optional(),
  occurred_at: z.iso.datetime({ offset: true }).optional(),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .refine(
      (v) => v === undefined || JSON.stringify(v).length <= MAX_JSON_BYTES,
      `metadata must be at most ${MAX_JSON_BYTES} bytes`,
    ),
};

export const agentEventSchema = z.discriminatedUnion("event_type", [
  z.object({
    ...base,
    event_type: z.literal("task.started"),
    task_id: clientTaskId.optional(),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
  }),
  z.object({
    ...base,
    event_type: z.literal("task.completed"),
    task_id: z.string().max(64),
    result: smallJson.optional(),
  }),
  z.object({
    ...base,
    event_type: z.literal("task.failed"),
    task_id: z.string().max(64),
    error: z.string().trim().max(1000).optional(),
  }),
  z.object({
    ...base,
    event_type: z.literal("task.cancelled"),
    task_id: z.string().max(64),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    ...base,
    event_type: z.literal("llm.call"),
    provider: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(100),
    input_tokens: TOKENS,
    output_tokens: TOKENS,
    cached_tokens: TOKENS.default(0),
    latency_ms: z.number().int().min(0).max(3_600_000).optional(),
  }),
  z.object({
    ...base,
    event_type: z.literal("tool.call"),
    tool_name: z.string().trim().min(1).max(100),
    latency_ms: z.number().int().min(0).max(3_600_000).optional(),
    success: z.boolean().default(true),
  }),
  z.object({
    ...base,
    event_type: z.literal("approval.requested"),
    action: z.string().trim().min(1).max(200),
    reason: z.string().trim().max(1000).optional(),
    risk: z.enum(["low", "medium", "high"]).optional(),
  }),
  z.object({
    ...base,
    event_type: z.literal("log"),
    level: z.enum(["info", "warn", "error"]).default("info"),
    message: z.string().trim().min(1).max(500),
  }),
]);

export type AgentEventInput = z.infer<typeof agentEventSchema>;
export type AgentEventType = AgentEventInput["event_type"];

export const heartbeatSchema = z.object({
  agent_id: z.string().max(64).optional(),
  status: z.enum(["ONLINE", "WORKING", "IDLE", "WAITING", "FAILED"]).default("ONLINE"),
  current_task_id: z.string().max(64).optional(),
  timestamp: z.iso.datetime({ offset: true }).optional(),
});

export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_\-:.]{1,200}$/;

/** Events may be reported late but not from the far past or the future. */
export const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
