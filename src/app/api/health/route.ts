import { db } from "@/lib/db/client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = performance.now();
  let database: { status: "ok" | "error"; latencyMs: number };
  try {
    await db.$queryRaw`SELECT 1`;
    database = { status: "ok", latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    logger.error("Health check: database unreachable", { error });
    database = { status: "error", latencyMs: Math.round(performance.now() - started) };
  }

  const healthy = database.status === "ok";
  return Response.json(
    { status: healthy ? "ok" : "degraded", checks: { database }, time: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
