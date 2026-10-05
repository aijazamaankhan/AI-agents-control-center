import "server-only";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/ids";
import type { Role } from "@/generated/prisma/enums";
import { generateSessionToken, hashSessionToken, SESSION_TTL_MS } from "./session-token";

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  /** Velorex Studio staff with access to /admin. */
  isPlatformAdmin: boolean;
}

export interface ResolvedSession {
  sessionId: string;
  user: SessionUser;
  activeOrganizationId: string | null;
}

/** Tenant context for every org-scoped operation. Built server-side only. */
export interface OrgContext {
  sessionId: string;
  user: SessionUser;
  organizationId: string;
  role: Role;
  /** Suspended by Velorex Studio — members are blocked until reactivated. */
  organizationSuspended: boolean;
}

export async function createSession(
  userId: string,
  meta: RequestMeta = {},
  activeOrganizationId: string | null = null,
): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await db.session.create({
    data: {
      id: newId("session"),
      tokenHash: hashSessionToken(token),
      userId,
      activeOrganizationId,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent?.slice(0, 512),
    },
  });
  return { token, expiresAt, sessionId: session.id };
}

export async function resolveSessionToken(
  token: string | undefined,
): Promise<ResolvedSession | null> {
  if (!token || token.length > 128) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        select: { id: true, name: true, email: true, isPlatformAdmin: true, suspendedAt: true },
      },
    },
  });
  if (!session) return null;
  // Suspended users lose access immediately, even with a valid session.
  if (session.user.suspendedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const user: SessionUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    isPlatformAdmin: session.user.isPlatformAdmin,
  };
  return {
    sessionId: session.id,
    user,
    activeOrganizationId: session.activeOrganizationId,
  };
}

/**
 * Resolves the organization the session acts in. The membership is re-checked on
 * every call, so a removed member (or a stale/tampered active org) loses access
 * immediately. Falls back to the user's earliest membership.
 */
export async function resolveOrgContext(session: ResolvedSession): Promise<OrgContext | null> {
  const include = { organization: { select: { suspendedAt: true } } } as const;
  let membership = session.activeOrganizationId
    ? await db.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: session.activeOrganizationId,
            userId: session.user.id,
          },
        },
        include,
      })
    : null;

  if (!membership) {
    membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      include,
    });
    await db.session.update({
      where: { id: session.sessionId },
      data: { activeOrganizationId: membership?.organizationId ?? null },
    });
  }
  if (!membership) return null;

  return {
    sessionId: session.sessionId,
    user: session.user,
    organizationId: membership.organizationId,
    role: membership.role,
    organizationSuspended: Boolean(membership.organization.suspendedAt),
  };
}

export async function deleteSessionByToken(token: string): Promise<string | null> {
  const session = await db.session.findUnique({ where: { tokenHash: hashSessionToken(token) } });
  if (!session) return null;
  await db.session.delete({ where: { id: session.id } });
  return session.userId;
}
