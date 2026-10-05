# Agents — Domain Model & Integration Guide

> This file documents AgentOS's _agent domain_. (Contributors using AI coding
> agents: also follow `CODE_STYLE.md`, `SECURITY.md` and `ARCHITECTURE.md`.)

## Identity

Every connected agent gets a permanent ID `agt_<ULID>`. Every event it reports is
associated with `organization_id`, `agent_id` and `department_id` (resolved
server-side from the agent record — never trusted from the payload).

## Profile fields

Name, ID, description, provider, model, department, status, created date,
last active, connection type, capabilities.

## Connection types

`SDK`, `REST_API`, `WEBHOOK`, `MCP`, `API_INTEGRATION`, `CUSTOM`.

## Status

`ONLINE`, `WORKING`, `IDLE`, `WAITING`, `FAILED`, `OFFLINE`, `DISCONNECTED` —
always rendered with icon + label (never color alone).

Heartbeat (`POST /api/agent/heartbeat`) sets ONLINE/WORKING/IDLE; when the
heartbeat expires the agent becomes `OFFLINE` (never deleted or failed).

## Health

Derived from last heartbeat, last success/failure, failure rate, average latency,
average cost, token usage and error count → `HEALTHY | WARNING | CRITICAL`.

## SDK (Phase 4)

```ts
const agentos = new AgentOS({ apiKey: process.env.AGENTOS_API_KEY });
const task = await agentos.task.start({ name: "Find SaaS leads" });
await agentos.llm.call({
  provider: "anthropic",
  model: "claude-sonnet",
  inputTokens: 12430,
  outputTokens: 2840,
});
await agentos.tool.call({ name: "web_search" });
await agentos.task.complete({ result: { leadsFound: 47 } });
```

The SDK attaches `agent_id`, `task_id`, `execution_id`, `event_id`/Idempotency-Key,
timestamps, provider/model, tokens and latency. The organization is derived from
the API key server-side.

## Permissions

Per-agent capability rules: _allowed_, _denied_, _approval required_. Enforced
server-side when an agent requests an action (Phase 7).

## Implemented in Phase 3

- Connect via `/agents/new`; the agent receives an API key `aos_live_…` (shown once).
  Put it in the agent's environment as `AGENTOS_API_KEY` with `AGENTOS_AGENT_ID`.
- Endpoint credentials (API key header, bearer token, basic auth) are encrypted at rest
  and only used server-side (e.g. Test connection).
- Capabilities carry a rule: `ALLOWED`, `APPROVAL_REQUIRED`, `DENIED`. Enforcement on
  agent action requests and the approval queue arrive in Phase 7.
- Status is `OFFLINE` until the agent reports (Phase 4 heartbeat/events).
