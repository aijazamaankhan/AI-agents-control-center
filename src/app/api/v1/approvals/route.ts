import { errorResponse } from "@/lib/api/errors";
import { requireApiContext } from "@/lib/api/route-helpers";
import {
  APPROVAL_FILTERS,
  listApprovals,
  type ApprovalFilter,
} from "@/features/approvals/server/approval-service";

export const dynamic = "force-dynamic";

/** GET /api/v1/approvals?status=pending|approved|rejected|all&page=1 */
export async function GET(request: Request) {
  try {
    const ctx = await requireApiContext();
    const sp = new URL(request.url).searchParams;
    const status = sp.get("status") ?? "pending";
    const filter = (APPROVAL_FILTERS as readonly string[]).includes(status)
      ? (status as ApprovalFilter)
      : "pending";
    const page = Math.max(1, Number(sp.get("page")) || 1);
    return Response.json({ data: await listApprovals(ctx, { filter, page }) });
  } catch (err) {
    return errorResponse(err);
  }
}
