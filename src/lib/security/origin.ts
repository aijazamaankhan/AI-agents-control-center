import { AppError } from "@/lib/api/errors";

/**
 * CSRF guard for cookie-authenticated JSON mutations: the browser-sent Origin must
 * match the request's own origin (or NEXT_PUBLIC_APP_URL behind a proxy).
 * Server actions get the equivalent check from Next.js itself.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new AppError("FORBIDDEN", "Cross-site request blocked.");
  const allowed = new Set([new URL(request.url).origin]);
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    } catch {
      // ignore malformed config; request origin still applies
    }
  }
  if (!allowed.has(origin)) throw new AppError("FORBIDDEN", "Cross-site request blocked.");
}
