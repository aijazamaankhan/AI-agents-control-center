import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName } from "./session-token";
import {
  resolveOrgContext,
  resolveSessionToken,
  type OrgContext,
  type ResolvedSession,
} from "./sessions";

/** Current session for this request (memoized per render). */
export const getCurrentSession = cache(async (): Promise<ResolvedSession | null> => {
  const store = await cookies();
  return resolveSessionToken(store.get(sessionCookieName())?.value);
});

export async function requireSession(): Promise<ResolvedSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

export const getCurrentOrgContext = cache(async (): Promise<OrgContext | null> => {
  const session = await getCurrentSession();
  return session ? resolveOrgContext(session) : null;
});

/** Authenticated user with an active organization; otherwise redirects. */
export async function requireOrgContext(): Promise<OrgContext> {
  await requireSession();
  const ctx = await getCurrentOrgContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}
