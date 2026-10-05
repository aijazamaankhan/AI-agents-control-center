import { AppError, errorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { authenticateAgent } from "@/features/events/server/agent-auth";
import { ingestEvent } from "@/features/events/server/ingest";
import { agentEventSchema, IDEMPOTENCY_KEY } from "@/features/events/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent-events — agents report tasks, model calls and tool calls.
 * Auth: `Authorization: Bearer <agent API key>`. Requires `Idempotency-Key`.
 * 201 for a new event, 200 with `duplicate: true` for a repeat (nothing double-counted).
 */
export async function POST(request: Request) {
  try {
    const ctx = await authenticateAgent(request);
    const key = request.headers.get("idempotency-key")?.trim();
    if (!key)
      throw new AppError(
        "IDEMPOTENCY_KEY_REQUIRED",
        "Send a unique Idempotency-Key header with every event.",
      );
    if (!IDEMPOTENCY_KEY.test(key)) {
      throw new AppError(
        "BAD_REQUEST",
        "Idempotency-Key must be 1–200 characters: letters, digits, _ - : .",
      );
    }
    const input = await parseJsonBody(request, agentEventSchema);
    const result = await ingestEvent(ctx, key, input);
    return Response.json({ data: result }, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
