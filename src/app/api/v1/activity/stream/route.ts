import { errorResponse } from "@/lib/api/errors";
import { requireApiContext } from "@/lib/api/route-helpers";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { recentActivity } from "@/features/events/server/activity";
import { sweepStaleAgents } from "@/features/events/server/ingest";

export const dynamic = "force-dynamic";

const POLL_MS = 2000;
const MAX_LIFETIME_MS = 5 * 60 * 1000; // the browser's EventSource reconnects automatically

/**
 * GET /api/v1/activity/stream — Server-Sent Events for the signed-in organization.
 * `activity` = new events, `status` = agent status changes. DB polling keeps it
 * stateless and multi-instance safe (no Redis needed at this scale).
 */
export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireApiContext();
  } catch (err) {
    return errorResponse(err);
  }
  const orgId = ctx.organizationId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const seen = new Set<string>();
      let statuses = new Map<string, string>();
      let cursor = new Date();
      let lastSweep = 0;
      const started = Date.now();
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", close);
      const send = (event: string, data: unknown) => {
        if (!closed)
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      try {
        while (!closed && Date.now() - started < MAX_LIFETIME_MS) {
          if (Date.now() - lastSweep > 15_000) {
            await sweepStaleAgents(orgId);
            lastSweep = Date.now();
          }
          // Overlap the window slightly and de-duplicate, so same-millisecond inserts are never missed.
          const since = new Date(cursor.getTime() - 3000);
          const items = (await recentActivity(ctx, { since, limit: 100 })).reverse();
          for (const item of items) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            send("activity", item);
            if (new Date(item.at) > cursor) cursor = new Date(item.at);
          }
          if (seen.size > 2000) seen.clear();

          const agents = await db.agent.findMany({
            where: { organizationId: orgId },
            select: { id: true, status: true },
          });
          const next = new Map(agents.map((a) => [a.id, a.status as string]));
          const changed = agents.filter((a) => statuses.get(a.id) !== a.status);
          if (changed.length)
            send("status", Object.fromEntries(changed.map((a) => [a.id, a.status])));
          statuses = next;

          controller.enqueue(encoder.encode(": ping\n\n"));
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
      } catch (error) {
        if (!closed) logger.error("Activity stream failed", { error });
      }
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
