import { errorResponse } from "@/lib/api/errors";
import { requireApiContext } from "@/lib/api/route-helpers";
import { assertPermission } from "@/lib/security/permissions";
import { getOrganization } from "@/features/organizations/server/organization-service";
import { parsePeriod } from "@/features/usage/schemas";
import { getUsageReport } from "@/features/usage/server/usage-service";

export const dynamic = "force-dynamic";

/** GET /api/v1/usage?period=7d|30d|90d — tokens and cost for the caller's organization. */
export async function GET(request: Request) {
  try {
    const ctx = await requireApiContext();
    assertPermission(ctx.role, "costs:read");
    const period = parsePeriod(new URL(request.url).searchParams.get("period"));
    const org = await getOrganization(ctx);
    return Response.json({ data: await getUsageReport(ctx, org.timezone, period) });
  } catch (err) {
    return errorResponse(err);
  }
}
