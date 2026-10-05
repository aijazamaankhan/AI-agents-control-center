import { errorResponse } from "@/lib/api/errors";
import { authenticateAgent } from "@/features/events/server/agent-auth";
import { getApprovalForAgent } from "@/features/approvals/server/approval-service";

export const dynamic = "force-dynamic";

/** GET /api/agent/approvals/:id — the agent polls the decision on its own request. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await authenticateAgent(request);
    const { id } = await params;
    return Response.json({ data: await getApprovalForAgent(ctx, id) });
  } catch (err) {
    return errorResponse(err);
  }
}
