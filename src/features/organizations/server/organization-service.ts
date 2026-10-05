import "server-only";
import { randomBytes } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import type { OrgContext, RequestMeta } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/security/audit";
import { assertPermission } from "@/lib/security/permissions";
import { slugify, type OrganizationInput } from "../schemas";

export interface Creator {
  userId: string;
  sessionId: string;
}

/** Creates a tenant, makes the creator OWNER and switches their session to it — atomically. */
export async function createOrganization(
  creator: Creator,
  input: OrganizationInput,
  meta: RequestMeta = {},
) {
  const organizationId = newId("organization");
  const slug = `${slugify(input.name)}-${randomBytes(3).toString("hex")}`;

  return db.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { id: organizationId, slug, ...input } });
    await tx.membership.create({
      data: { id: newId("membership"), organizationId, userId: creator.userId, role: "OWNER" },
    });
    await tx.session.update({
      where: { id: creator.sessionId, userId: creator.userId },
      data: { activeOrganizationId: organizationId },
    });
    await recordAudit(
      {
        action: "organization.created",
        organizationId,
        actorUserId: creator.userId,
        resourceType: "organization",
        resourceId: organizationId,
        metadata: { name: input.name },
        meta,
      },
      tx,
    );
    return org;
  });
}

/** The caller's active organization. Always scoped by the server-side context. */
export async function getOrganization(ctx: OrgContext) {
  const org = await db.organization.findFirst({ where: { id: ctx.organizationId } });
  if (!org) throw new AppError("RESOURCE_NOT_FOUND", "Organization not found");
  return org;
}

export async function updateOrganization(
  ctx: OrgContext,
  input: OrganizationInput,
  meta: RequestMeta = {},
) {
  assertPermission(ctx.role, "org:update");

  return db.$transaction(async (tx) => {
    const before = await tx.organization.findFirst({ where: { id: ctx.organizationId } });
    if (!before) throw new AppError("RESOURCE_NOT_FOUND", "Organization not found");

    const changed = (Object.keys(input) as (keyof OrganizationInput)[]).filter(
      (k) => before[k] !== input[k],
    );
    const org = await tx.organization.update({ where: { id: ctx.organizationId }, data: input });
    if (changed.length > 0) {
      await recordAudit(
        {
          action: "organization.updated",
          organizationId: ctx.organizationId,
          actorUserId: ctx.user.id,
          resourceType: "organization",
          resourceId: ctx.organizationId,
          metadata: { changed },
          meta,
        },
        tx,
      );
    }
    return org;
  });
}

export async function countMembers(ctx: OrgContext): Promise<number> {
  return db.membership.count({ where: { organizationId: ctx.organizationId } });
}
