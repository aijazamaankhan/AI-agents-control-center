import "server-only";
import { AppError } from "@/lib/api/errors";
import { db } from "@/lib/db/client";
import { hashApiKey } from "@/lib/security/crypto";
import { rateLimiter } from "@/lib/security/rate-limit";

/** Identity of the agent calling the Event/Heartbeat API — derived from its API key, never the body. */
export interface AgentContext {
  organizationId: string;
  agentId: string;
  departmentId: string;
  agentName: string;
  apiKeyId: string;
}

export const AGENT_RATE_LIMIT = { limit: 1200, windowMs: 60_000 } as const;

export function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-agentos-key")?.trim() || null;
}

export async function authenticateAgent(request: Request): Promise<AgentContext> {
  const key = extractApiKey(request);
  if (!key || key.length > 200) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Missing agent API key. Send `Authorization: Bearer aos_live_…`.",
    );
  }
  const record = await db.agentApiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    select: {
      id: true,
      revokedAt: true,
      lastUsedAt: true,
      organizationId: true,
      agent: { select: { id: true, name: true, departmentId: true, organizationId: true } },
    },
  });
  if (!record || record.revokedAt || record.agent.organizationId !== record.organizationId) {
    throw new AppError("UNAUTHENTICATED", "Invalid or revoked agent API key.");
  }

  const limited = await rateLimiter.hit(
    `agent-key:${record.id}`,
    AGENT_RATE_LIMIT.limit,
    AGENT_RATE_LIMIT.windowMs,
  );
  if (!limited.ok)
    throw new AppError("RATE_LIMITED", "Too many requests for this agent. Slow down and retry.");

  // Throttle writes: record usage at most once a minute.
  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000) {
    await db.agentApiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  }

  return {
    organizationId: record.organizationId,
    agentId: record.agent.id,
    departmentId: record.agent.departmentId,
    agentName: record.agent.name,
    apiKeyId: record.id,
  };
}

export function assertSameAgent(ctx: AgentContext, agentId: string | undefined) {
  if (agentId && agentId !== ctx.agentId) {
    throw new AppError("FORBIDDEN", "This API key belongs to a different agent.");
  }
}
