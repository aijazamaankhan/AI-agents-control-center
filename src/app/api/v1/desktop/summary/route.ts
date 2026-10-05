import { errorResponse } from "@/lib/api/errors";
import { requireApiContext } from "@/lib/api/route-helpers";
import { desktopSummary } from "@/features/desktop/server/desktop-service";

export const dynamic = "force-dynamic";

/** GET /api/v1/desktop/summary — tray counts + items to notify about (desktop app polls this). */
export async function GET() {
  try {
    const ctx = await requireApiContext();
    return Response.json(
      { data: await desktopSummary(ctx) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
