import "server-only";
import { randomBytes } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { hashPassword } from "@/lib/auth/password";
import type { RequestMeta, ResolvedSession } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { recordAudit } from "@/lib/security/audit";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Velorex Studio platform administration. Every function re-asserts the caller is a
 * platform admin (defence in depth on top of the route guard) and audits each change.
 * Secrets are never readable here: passwords are hashed and agent credentials encrypted,
 * so admins can reset/revoke, not view.
 */
export type AdminSession = ResolvedSession;

function assertAdmin(admin: AdminSession) {
  if (!admin.user.isPlatformAdmin) throw new AppError("FORBIDDEN", "Platform administrators only.");
}

export const ADMIN_PAGE_SIZE = 25;
const page = (n: number) => ({
  skip: (Math.max(1, n) - 1) * ADMIN_PAGE_SIZE,
  take: ADMIN_PAGE_SIZE,
});

export async function platformOverview(admin: AdminSession) {
  assertAdmin(admin);
  const day = new Date(Date.now() - 86_400_000);
  const week = new Date(Date.now() - 7 * 86_400_000);
  const [
    organizations,
    suspendedOrgs,
    users,
    newUsers,
    agents,
    activeAgents,
    tasks24h,
    events24h,
    openInquiries,
  ] = await Promise.all([
    db.organization.count(),
    db.organization.count({ where: { suspendedAt: { not: null } } }),
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: week } } }),
    db.agent.count(),
    db.agent.count({ where: { status: { in: ["ONLINE", "WORKING", "IDLE", "WAITING"] } } }),
    db.task.count({ where: { startedAt: { gte: day } } }),
    db.executionEvent.count({ where: { receivedAt: { gte: day } } }),
    db.inquiry.count({ where: { handledAt: null } }),
  ]);
  const [recentOrgs, recentInquiries] = await Promise.all([
    db.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, createdAt: true, suspendedAt: true },
    }),
    db.inquiry.findMany({
      where: { handledAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        name: true,
        email: true,
        company: true,
        service: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    counts: {
      organizations,
      suspendedOrgs,
      users,
      newUsers,
      agents,
      activeAgents,
      tasks24h,
      events24h,
      openInquiries,
    },
    recentOrgs,
    recentInquiries,
  };
}

export async function listOrganizationsAdmin(
  admin: AdminSession,
  opts: { q?: string; page?: number } = {},
) {
  assertAdmin(admin);
  const where: Prisma.OrganizationWhereInput = opts.q
    ? {
        OR: [
          { name: { contains: opts.q, mode: "insensitive" } },
          { id: opts.q },
          { memberships: { some: { user: { email: { contains: opts.q, mode: "insensitive" } } } } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    db.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...page(opts.page ?? 1),
      select: {
        id: true,
        name: true,
        industry: true,
        country: true,
        createdAt: true,
        suspendedAt: true,
        _count: { select: { memberships: true, agents: true, departments: true } },
        memberships: {
          where: { role: "OWNER" },
          take: 1,
          select: { user: { select: { email: true, name: true } } },
        },
      },
    }),
    db.organization.count({ where }),
  ]);
  return { total, rows };
}

export async function getOrganizationAdmin(admin: AdminSession, id: string) {
  assertAdmin(admin);
  const org = await db.organization.findUnique({
    where: { id },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true, lastLoginAt: true, suspendedAt: true },
          },
        },
      },
      departments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, _count: { select: { agents: true } } },
      },
      agents: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          provider: true,
          model: true,
          status: true,
          lastActiveAt: true,
          department: { select: { name: true } },
          credential: { select: { hint: true } },
          apiKeys: { where: { revokedAt: null }, select: { prefix: true, lastUsedAt: true } },
        },
      },
    },
  });
  if (!org) throw new AppError("RESOURCE_NOT_FOUND", "Organization not found");
  const [tasks7d, events7d] = await Promise.all([
    db.task.count({
      where: { organizationId: id, startedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    }),
    db.executionEvent.count({
      where: { organizationId: id, receivedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    }),
  ]);
  return { ...org, tasks7d, events7d };
}

export async function setOrganizationSuspended(
  admin: AdminSession,
  id: string,
  suspend: boolean,
  meta: RequestMeta = {},
) {
  assertAdmin(admin);
  const org = await db.organization.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!org) throw new AppError("RESOURCE_NOT_FOUND", "Organization not found");
  await db.organization.update({
    where: { id },
    data: { suspendedAt: suspend ? new Date() : null },
  });
  await recordAudit({
    action: suspend ? "admin.organization_suspended" : "admin.organization_reactivated",
    organizationId: id,
    actorUserId: admin.user.id,
    resourceType: "organization",
    resourceId: id,
    metadata: { name: org.name, by: admin.user.email },
    meta,
  });
}

export async function listUsersAdmin(
  admin: AdminSession,
  opts: { q?: string; page?: number } = {},
) {
  assertAdmin(admin);
  const where: Prisma.UserWhereInput = opts.q
    ? {
        OR: [
          { email: { contains: opts.q, mode: "insensitive" } },
          { name: { contains: opts.q, mode: "insensitive" } },
          { id: opts.q },
        ],
      }
    : {};
  const now = new Date();
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...page(opts.page ?? 1),
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        lastLoginAt: true,
        suspendedAt: true,
        isPlatformAdmin: true,
        memberships: { select: { role: true, organization: { select: { id: true, name: true } } } },
        _count: { select: { sessions: { where: { expiresAt: { gt: now } } } } },
      },
    }),
    db.user.count({ where }),
  ]);
  return { total, rows };
}

async function targetUser(admin: AdminSession, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, isPlatformAdmin: true },
  });
  if (!user) throw new AppError("RESOURCE_NOT_FOUND", "User not found");
  if (user.id === admin.user.id)
    throw new AppError("BAD_REQUEST", "You can't do this to your own account here — use Settings.");
  return user;
}

export async function setUserSuspended(
  admin: AdminSession,
  userId: string,
  suspend: boolean,
  meta: RequestMeta = {},
) {
  assertAdmin(admin);
  const user = await targetUser(admin, userId);
  if (suspend && user.isPlatformAdmin)
    throw new AppError("BAD_REQUEST", "Remove platform admin access before suspending this user.");
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { suspendedAt: suspend ? new Date() : null },
    });
    if (suspend) await tx.session.deleteMany({ where: { userId } });
    await recordAudit(
      {
        action: suspend ? "admin.user_suspended" : "admin.user_reactivated",
        actorUserId: admin.user.id,
        resourceType: "user",
        resourceId: userId,
        metadata: { email: user.email },
        meta,
      },
      tx,
    );
  });
}

export async function revokeUserSessions(
  admin: AdminSession,
  userId: string,
  meta: RequestMeta = {},
) {
  assertAdmin(admin);
  const user = await targetUser(admin, userId);
  const { count } = await db.session.deleteMany({ where: { userId } });
  await recordAudit({
    action: "admin.user_sessions_revoked",
    actorUserId: admin.user.id,
    resourceType: "user",
    resourceId: userId,
    metadata: { email: user.email, count },
    meta,
  });
  return count;
}

/** Sets a random temporary password (returned once, never stored in plaintext) and signs the user out. */
export async function resetUserPassword(
  admin: AdminSession,
  userId: string,
  meta: RequestMeta = {},
) {
  assertAdmin(admin);
  const user = await targetUser(admin, userId);
  const temporary = `Tmp-${randomBytes(9).toString("base64url")}`;
  const passwordHash = await hashPassword(temporary);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId } });
    await recordAudit(
      {
        action: "admin.user_password_reset",
        actorUserId: admin.user.id,
        resourceType: "user",
        resourceId: userId,
        metadata: { email: user.email },
        meta,
      },
      tx,
    );
  });
  return temporary;
}

export async function revokeAgentKeys(
  admin: AdminSession,
  agentId: string,
  meta: RequestMeta = {},
) {
  assertAdmin(admin);
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, organizationId: true },
  });
  if (!agent) throw new AppError("RESOURCE_NOT_FOUND", "Agent not found");
  const { count } = await db.agentApiKey.updateMany({
    where: { agentId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await recordAudit({
    action: "admin.agent_keys_revoked",
    organizationId: agent.organizationId,
    actorUserId: admin.user.id,
    resourceType: "agent",
    resourceId: agentId,
    metadata: { name: agent.name, count },
    meta,
  });
  return count;
}

export async function listInquiriesAdmin(
  admin: AdminSession,
  opts: { type?: "SERVICE" | "DEMO"; status?: "open" | "handled"; page?: number } = {},
) {
  assertAdmin(admin);
  const where: Prisma.InquiryWhereInput = {
    ...(opts.type ? { type: opts.type } : {}),
    ...(opts.status === "open"
      ? { handledAt: null }
      : opts.status === "handled"
        ? { handledAt: { not: null } }
        : {}),
  };
  const [rows, total] = await Promise.all([
    db.inquiry.findMany({ where, orderBy: { createdAt: "desc" }, ...page(opts.page ?? 1) }),
    db.inquiry.count({ where }),
  ]);
  return { total, rows };
}

export async function setInquiryHandled(
  admin: AdminSession,
  id: string,
  handled: boolean,
  meta: RequestMeta = {},
) {
  assertAdmin(admin);
  const row = await db.inquiry.findUnique({ where: { id }, select: { id: true } });
  if (!row) throw new AppError("RESOURCE_NOT_FOUND", "Enquiry not found");
  await db.inquiry.update({ where: { id }, data: { handledAt: handled ? new Date() : null } });
  await recordAudit({
    action: "admin.inquiry_handled",
    actorUserId: admin.user.id,
    resourceType: "inquiry",
    resourceId: id,
    metadata: { handled },
    meta,
  });
}

export async function platformAuditLog(
  admin: AdminSession,
  opts: { action?: string; page?: number } = {},
) {
  assertAdmin(admin);
  const where: Prisma.AuditLogWhereInput = opts.action
    ? { action: { startsWith: opts.action } }
    : {};
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...page(opts.page ?? 1),
      include: {
        actor: { select: { email: true } },
        organization: { select: { name: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);
  return { total, rows };
}
