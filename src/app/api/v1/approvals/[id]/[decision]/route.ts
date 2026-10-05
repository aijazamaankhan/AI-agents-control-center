import { AppError, errorResponse } from "@/lib/api/errors";
import { parseJsonBody, requireApiContext } from "@/lib/api/route-helpers";
import { getRequestMeta } from "@/lib/auth/request-meta";
import { assertSameOrigin } from "@/lib/security/origin";
import { decisionSchema } from "@/features/approvals/schemas";
import { decideApproval } from "@/features/approvals/server/approval-service";

export const dynamic = "force-dynamic";

/** POST /api/v1/approvals/:id/approve | /reject — body { note? }. Owners, admins, managers. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; decision: string }> },
) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    const { id, decision } = await params;
    if (decision !== "approve" && decision !== "reject")
      throw new AppError("RESOURCE_NOT_FOUND", "Not found.");
    const { note } = await parseJsonBody(request, decisionSchema);
    const approval = await decideApproval(
      ctx,
      id,
      decision === "approve" ? "APPROVED" : "REJECTED",
      note,
      await getRequestMeta(),
    );
    return Response.json({ data: { id: approval.id, status: approval.status.toLowerCase() } });
  } catch (err) {
    return errorResponse(err);
  }
}
