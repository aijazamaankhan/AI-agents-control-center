import "server-only";
import { AppError } from "@/lib/api/errors";
import type { OrgContext } from "@/lib/auth/sessions";
import { assertPublicHttpUrl } from "@/lib/security/outbound";
import { assertPermission } from "@/lib/security/permissions";
import { rateLimiter } from "@/lib/security/rate-limit";
import type { ConnectionInput } from "../schemas";

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  status?: number;
  latencyMs?: number;
}

export const TEST_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 } as const;

/** Maps an HTTP status to a human outcome. 405 counts as reachable (webhooks often accept POST only). */
export function interpretStatus(status: number): Omit<ConnectionTestResult, "latencyMs"> {
  if (status < 400 || status === 405)
    return { ok: true, status, message: `Connection successful (HTTP ${status}).` };
  if (status === 401 || status === 403)
    return {
      ok: false,
      status,
      message: `Endpoint reachable, but it rejected the credentials (HTTP ${status}).`,
    };
  if (status === 404)
    return {
      ok: false,
      status,
      message: "Endpoint reachable, but the URL path was not found (HTTP 404).",
    };
  if (status >= 500)
    return {
      ok: false,
      status,
      message: `The agent endpoint returned a server error (HTTP ${status}).`,
    };
  return { ok: false, status, message: `The agent endpoint responded with HTTP ${status}.` };
}

export function authHeaders(
  conn: Pick<ConnectionInput, "authType" | "authHeaderName" | "authUsername">,
  secret: { secret?: string; username?: string } | null,
): Record<string, string> {
  if (!secret?.secret) return {};
  switch (conn.authType) {
    case "API_KEY":
      return { [conn.authHeaderName || "X-API-Key"]: secret.secret };
    case "BEARER_TOKEN":
      return { Authorization: `Bearer ${secret.secret}` };
    case "BASIC": {
      const user = conn.authUsername || secret.username || "";
      return {
        Authorization: `Basic ${Buffer.from(`${user}:${secret.secret}`).toString("base64")}`,
      };
    }
    default:
      return {};
  }
}

/**
 * Reachability check against the agent's endpoint. SDK agents have nothing to call —
 * they prove connectivity by sending their first heartbeat/event (Phase 4).
 */
export async function testConnection(
  ctx: OrgContext,
  conn: Pick<
    ConnectionInput,
    "connectionType" | "endpointUrl" | "authType" | "authHeaderName" | "authUsername"
  >,
  secret: { secret?: string; username?: string } | null,
): Promise<ConnectionTestResult> {
  assertPermission(ctx.role, "agents:manage");
  if (!conn.endpointUrl) {
    return {
      ok: true,
      message:
        "No endpoint to call — this agent connects by sending events with its AgentOS API key.",
    };
  }

  const limited = await rateLimiter.hit(
    `conn-test:${ctx.user.id}`,
    TEST_LIMIT.limit,
    TEST_LIMIT.windowMs,
  );
  if (!limited.ok)
    throw new AppError("RATE_LIMITED", "Too many connection tests. Please wait a few minutes.");

  const url = await assertPublicHttpUrl(conn.endpointUrl);
  const started = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "AgentOS-ConnectionTest/1.0", ...authHeaders(conn, secret) },
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    await res.body?.cancel();
    return { ...interpretStatus(res.status), latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    const timeout =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      message: timeout
        ? "The endpoint did not respond within 5 seconds."
        : "Could not connect to the endpoint.",
      latencyMs: Math.round(performance.now() - started),
    };
  }
}
