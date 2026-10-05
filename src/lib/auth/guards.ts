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

/** Resolved org context including suspended orgs (pages decide how to present that). */
const resolveCurrentOrg = cache(async (): Promise<OrgContext | null> => {
  const session = await getCurrentSession();
  return session ? resolveOrgContext(session) : null;
});

/**
 * Org context for actions and APIs. A suspended organization yields null, so every
 * mutation and API call is refused while suspended.
 */
export const getCurrentOrgContext = cache(async (): Promise<OrgContext | null> => {
  const ctx = await resolveCurrentOrg();
  return ctx && !ctx.organizationSuspended ? ctx : null;
});

/** Authenticated user with an active organization; otherwise redirects. */
export async function requireOrgContext(): Promise<OrgContext> {
  await requireSession();
  const ctx = await resolveCurrentOrg();
  if (!ctx) redirect("/onboarding");
  if (ctx.organizationSuspended) redirect("/suspended");
  return ctx;
}

/** Velorex Studio staff only. Everyone else is sent to the admin login. */
export async function requirePlatformAdmin(): Promise<ResolvedSession> {
  const session = await getCurrentSession();
  // Signed out, or signed in with an account that has no admin access: the admin login page
  // explains which account to use (it's public, so this reveals nothing).
  if (!session?.user.isPlatformAdmin) redirect("/admin/login");
  return session;
}
