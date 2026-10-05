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
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return {
    sessionId: session.id,
    user: session.user,
    activeOrganizationId: session.activeOrganizationId,
  };
}

/**
 * Resolves the organization the session acts in. The membership is re-checked on
 * every call, so a removed member (or a stale/tampered active org) loses access
 * immediately. Falls back to the user's earliest membership.
 */
export async function resolveOrgContext(session: ResolvedSession): Promise<OrgContext | null> {
  let membership = session.activeOrganizationId
    ? await db.membership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: session.activeOrganizationId,
            userId: session.user.id,
          },
        },
      })
    : null;

  if (!membership) {
    membership = await db.membership.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
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
  };
}

export async function deleteSessionByToken(token: string): Promise<string | null> {
  const session = await db.session.findUnique({ where: { tokenHash: hashSessionToken(token) } });
  if (!session) return null;
  await db.session.delete({ where: { id: session.id } });
  return session.userId;
}
