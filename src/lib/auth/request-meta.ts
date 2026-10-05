import "server-only";
import { headers } from "next/headers";
import type { RequestMeta } from "./sessions";

/**
 * Client IP/UA for audit and rate limiting. X-Forwarded-For is only trustworthy
 * behind a proxy that overwrites it — production must run behind one (docs/SECURITY.md).
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = forwarded || h.get("x-real-ip") || undefined;
  return { ipAddress, userAgent: h.get("user-agent") ?? undefined };
}
