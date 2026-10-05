/**
 * AgentOS SDK — report what your AI agent does to AgentOS.
 *
 *   const agentos = new AgentOS({ apiKey: process.env.AGENTOS_API_KEY!, baseUrl: "http://localhost:3000" });
 *   const task = await agentos.task.start({ name: "Find SaaS leads" });
 *   await agentos.llm.call({ provider: "anthropic", model: "claude-sonnet", inputTokens: 12430, outputTokens: 2840 });
 *   await agentos.tool.call({ name: "web_search" });
 *   await agentos.task.complete({ result: { leadsFound: 47 } });
 *
 * Zero dependencies; uses only `fetch` and `crypto.randomUUID` (Node ≥ 18, Deno, Bun, browsers).
 * Every event gets an Idempotency-Key; retries reuse it, so nothing is ever double-counted.
 * Written in erasable TypeScript so Node can run it directly (type stripping).
 */

export interface AgentOSOptions {
  /** Agent API key (`aos_live_…`) shown when the agent was connected. */
  apiKey: string;
  /** AgentOS URL. Default: http://localhost:3000 */
  baseUrl?: string;
  /** Optional: asserted server-side to match the key's agent. */
  agentId?: string;
  /** Retries for network errors / 5xx / 429 (same Idempotency-Key). Default 3. */
  maxRetries?: number;
  fetch?: typeof fetch;
}

export interface EventResult {
  event_id: string;
  task_id: string | null;
  execution_id: string | null;
  duplicate: boolean;
}

export interface LlmCallInput {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  latencyMs?: number;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCallInput {
  name: string;
  latencyMs?: number;
  success?: boolean;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalInput {
  action: string;
  reason?: string;
  risk?: "low" | "medium" | "high";
  taskId?: string;
}

export type AgentStatus = "ONLINE" | "WORKING" | "IDLE" | "WAITING" | "FAILED";

export class AgentOSError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AgentOSError";
    this.status = status;
    this.code = code;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A started task. Methods report against this task automatically. */
export class TaskHandle {
  readonly id: string;
  readonly executionId: string | null;
  readonly #client: AgentOS;
  constructor(client: AgentOS, id: string, executionId: string | null) {
    this.#client = client;
    this.id = id;
    this.executionId = executionId;
  }
  llmCall(input: Omit<LlmCallInput, "taskId">) {
    return this.#client.llm.call({ ...input, taskId: this.id });
  }
  toolCall(input: Omit<ToolCallInput, "taskId">) {
    return this.#client.tool.call({ ...input, taskId: this.id });
  }
  requestApproval(input: Omit<ApprovalInput, "taskId">) {
    return this.#client.approval.request({ ...input, taskId: this.id });
  }
  complete(input: { result?: unknown } = {}) {
    return this.#client.task.complete({ ...input, taskId: this.id });
  }
  fail(input: { error?: string } = {}) {
    return this.#client.task.fail({ ...input, taskId: this.id });
  }
}

export class AgentOS {
  readonly baseUrl: string;
  readonly #apiKey: string;
  readonly #agentId: string | undefined;
  readonly #maxRetries: number;
  readonly #fetch: typeof fetch;
  /** Last started, unfinished task — used when a call omits taskId. */
  #current: TaskHandle | null = null;

  readonly task: {
    start: (input: { name: string; description?: string; taskId?: string }) => Promise<TaskHandle>;
    complete: (input?: { taskId?: string; result?: unknown }) => Promise<EventResult>;
    fail: (input?: { taskId?: string; error?: string }) => Promise<EventResult>;
    cancel: (input?: { taskId?: string; reason?: string }) => Promise<EventResult>;
  };
  readonly llm: { call: (input: LlmCallInput) => Promise<EventResult> };
  readonly tool: { call: (input: ToolCallInput) => Promise<EventResult> };
  readonly approval: { request: (input: ApprovalInput) => Promise<EventResult> };
  readonly agent: {
    heartbeat: (status?: AgentStatus, currentTaskId?: string) => Promise<unknown>;
    /** Sends a heartbeat now and every `intervalMs`; returns a stop function. */
    startHeartbeat: (intervalMs?: number) => () => void;
  };

  constructor(options: AgentOSOptions) {
    if (!options.apiKey) throw new Error("AgentOS: apiKey is required");
    this.#apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "http://localhost:3000").replace(/\/+$/, "");
    this.#agentId = options.agentId;
    this.#maxRetries = options.maxRetries ?? 3;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);

    const taskIdOrCurrent = (taskId?: string) => {
      const id = taskId ?? this.#current?.id;
      if (!id) throw new Error("AgentOS: no taskId given and no task in progress");
      return id;
    };
    const finish = (id: string) => {
      if (this.#current?.id === id) this.#current = null;
    };

    this.task = {
      start: async ({ name, description, taskId }) => {
        const res = await this.send({
          event_type: "task.started",
          name,
          description,
          task_id: taskId,
        });
        const handle = new TaskHandle(this, res.task_id!, res.execution_id);
        this.#current = handle;
        return handle;
      },
      complete: async ({ taskId, result } = {}) => {
        const id = taskIdOrCurrent(taskId);
        const res = await this.send({ event_type: "task.completed", task_id: id, result });
        finish(id);
        return res;
      },
      fail: async ({ taskId, error } = {}) => {
        const id = taskIdOrCurrent(taskId);
        const res = await this.send({ event_type: "task.failed", task_id: id, error });
        finish(id);
        return res;
      },
      cancel: async ({ taskId, reason } = {}) => {
        const id = taskIdOrCurrent(taskId);
        const res = await this.send({ event_type: "task.cancelled", task_id: id, reason });
        finish(id);
        return res;
      },
    };

    this.llm = {
      call: (i) =>
        this.send({
          event_type: "llm.call",
          task_id: i.taskId ?? this.#current?.id,
          provider: i.provider,
          model: i.model,
          input_tokens: i.inputTokens,
          output_tokens: i.outputTokens,
          cached_tokens: i.cachedTokens ?? 0,
          latency_ms: i.latencyMs,
          metadata: i.metadata,
        }),
    };

    this.tool = {
      call: (i) =>
        this.send({
          event_type: "tool.call",
          task_id: i.taskId ?? this.#current?.id,
          tool_name: i.name,
          latency_ms: i.latencyMs,
          success: i.success ?? true,
          metadata: i.metadata,
        }),
    };

    this.approval = {
      request: (i) =>
        this.send({
          event_type: "approval.requested",
          task_id: i.taskId ?? this.#current?.id,
          action: i.action,
          reason: i.reason,
          risk: i.risk,
        }),
    };

    this.agent = {
      heartbeat: (
        status = this.#current ? "WORKING" : "ONLINE",
        currentTaskId = this.#current?.id,
      ) =>
        this.#post("/api/agent/heartbeat", {
          agent_id: this.#agentId,
          status,
          current_task_id: currentTaskId,
        }),
      startHeartbeat: (intervalMs = 30_000) => {
        const beat = () => this.agent.heartbeat().catch(() => undefined);
        void beat();
        const timer = setInterval(beat, intervalMs);
        return () => clearInterval(timer);
      },
    };
  }

  /** Low-level: send any event. A fresh Idempotency-Key is generated unless you pass one. */
  async send(
    event: Record<string, unknown>,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<EventResult> {
    const body: Record<string, unknown> = { ...event, occurred_at: new Date().toISOString() };
    if (this.#agentId) body.agent_id = this.#agentId;
    for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
    return (await this.#post("/api/agent-events", body, idempotencyKey)) as EventResult;
  }

  async #post(path: string, body: unknown, idempotencyKey?: string): Promise<unknown> {
    let attempt = 0;
    for (;;) {
      try {
        const res = await this.#fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.#apiKey}`,
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: unknown;
          error?: { code: string; message: string };
        };
        if (res.ok) return json.data;
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt >= this.#maxRetries) {
          throw new AgentOSError(
            res.status,
            json.error?.code ?? "HTTP_ERROR",
            json.error?.message ?? `HTTP ${res.status}`,
          );
        }
      } catch (err) {
        if (err instanceof AgentOSError || attempt >= this.#maxRetries) throw err;
      }
      attempt += 1;
      await sleep(Math.min(250 * 2 ** attempt, 4000)); // same Idempotency-Key on every retry
    }
  }
}

export default AgentOS;
