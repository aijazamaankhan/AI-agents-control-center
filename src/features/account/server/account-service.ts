import "server-only";
import { AppError } from "@/lib/api/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { RequestMeta, ResolvedSession } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { recordAudit } from "@/lib/security/audit";

export async function updateProfile(
  session: ResolvedSession,
  name: string,
  meta: RequestMeta = {},
) {
  await db.user.update({ where: { id: session.user.id }, data: { name } });
  await recordAudit({
    action: "user.profile_updated",
    actorUserId: session.user.id,
    resourceType: "user",
    resourceId: session.user.id,
    meta,
  });
}

/** Verifies the current password, sets the new one and signs out every other session. */
export async function changePassword(
  session: ResolvedSession,
  input: { currentPassword: string; newPassword: string },
  meta: RequestMeta = {},
) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AppError("VALIDATION_ERROR", "Current password is incorrect", {
      fieldErrors: { currentPassword: ["Current password is incorrect"] },
    });
  }
  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.user.id }, data: { passwordHash } });
    await tx.session.deleteMany({
      where: { userId: session.user.id, id: { not: session.sessionId } },
    });
    await recordAudit(
      {
        action: "user.password_changed",
        actorUserId: session.user.id,
        resourceType: "user",
        resourceId: session.user.id,
        meta,
      },
      tx,
    );
  });
}

export async function listSessions(session: ResolvedSession) {
  const rows = await db.session.findMany({
    where: { userId: session.user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, ipAddress: true, userAgent: true, expiresAt: true },
  });
  return rows.map((r) => ({ ...r, current: r.id === session.sessionId }));
}

export async function signOutOtherSessions(session: ResolvedSession, meta: RequestMeta = {}) {
  const { count } = await db.session.deleteMany({
    where: { userId: session.user.id, id: { not: session.sessionId } },
  });
  await recordAudit({
    action: "user.sessions_revoked",
    actorUserId: session.user.id,
    resourceType: "user",
    resourceId: session.user.id,
    metadata: { count },
    meta,
  });
  return count;
}
