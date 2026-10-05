import { errorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route-helpers";
import { authenticateAgent } from "@/features/events/server/agent-auth";
import { recordHeartbeat } from "@/features/events/server/ingest";
import { heartbeatSchema } from "@/features/events/schemas";

export const dynamic = "force-dynamic";

/** POST /api/agent/heartbeat — keeps the agent ONLINE/WORKING; silence for 2 min → OFFLINE. */
export async function POST(request: Request) {
  try {
    const ctx = await authenticateAgent(request);
    const input = await parseJsonBody(request, heartbeatSchema);
    return Response.json({ data: await recordHeartbeat(ctx, input) });
  } catch (err) {
    return errorResponse(err);
  }
}
