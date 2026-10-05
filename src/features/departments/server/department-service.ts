import "server-only";
import { AppError } from "@/lib/api/errors";
import type { OrgContext, RequestMeta } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/security/audit";
import { assertPermission } from "@/lib/security/permissions";
import { Prisma } from "@/generated/prisma/client";
import {
  departmentNameKey,
  MAX_DEPARTMENTS,
  type DepartmentInput,
  type DepartmentUpdateInput,
} from "../schemas";

const DUPLICATE = "A department with this name already exists.";

export const departmentSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type DepartmentRecord = Prisma.DepartmentGetPayload<{ select: typeof departmentSelect }>;

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function listDepartments(ctx: OrgContext): Promise<DepartmentRecord[]> {
  return db.department.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: departmentSelect,
  });
}

export async function countDepartments(ctx: OrgContext): Promise<number> {
  return db.department.count({ where: { organizationId: ctx.organizationId } });
}

/** Lookup by id scoped to the caller's org — another tenant's id is simply "not found". */
export async function getDepartment(ctx: OrgContext, id: string): Promise<DepartmentRecord> {
  const dep = await db.department.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: departmentSelect,
  });
  if (!dep) throw new AppError("RESOURCE_NOT_FOUND", "Department not found");
  return dep;
}

async function assertCapacity(ctx: OrgContext, adding: number, tx: Prisma.TransactionClient = db) {
  const count = await tx.department.count({ where: { organizationId: ctx.organizationId } });
  if (count + adding > MAX_DEPARTMENTS) {
    throw new AppError(
      "CONFLICT",
      `An organization can have at most ${MAX_DEPARTMENTS} departments.`,
    );
  }
}

export async function createDepartment(
  ctx: OrgContext,
  input: DepartmentInput,
  meta: RequestMeta = {},
) {
  assertPermission(ctx.role, "departments:manage");
  try {
    return await db.$transaction(async (tx) => {
      await assertCapacity(ctx, 1, tx);
      const dep = await tx.department.create({
        data: {
          id: newId("department"),
          organizationId: ctx.organizationId,
          name: input.name,
          nameKey: departmentNameKey(input.name),
          description: input.description,
        },
        select: departmentSelect,
      });
      await recordAudit(
        {
          action: "department.created",
          organizationId: ctx.organizationId,
          actorUserId: ctx.user.id,
          resourceType: "department",
          resourceId: dep.id,
          metadata: { name: dep.name },
          meta,
        },
        tx,
      );
      return dep;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("CONFLICT", DUPLICATE);
    throw err;
  }
}

/** Onboarding step 2: creates the chosen departments, skipping names that already exist. */
export async function createDepartments(ctx: OrgContext, names: string[], meta: RequestMeta = {}) {
  assertPermission(ctx.role, "departments:manage");
  if (names.length === 0) return [];
  return db.$transaction(async (tx) => {
    const existing = await tx.department.findMany({
      where: { organizationId: ctx.organizationId },
      select: { nameKey: true },
    });
    const taken = new Set(existing.map((d) => d.nameKey));
    const fresh = names.filter((n) => !taken.has(departmentNameKey(n)));
    await assertCapacity(ctx, fresh.length, tx);

    const created: DepartmentRecord[] = [];
    for (const name of fresh) {
      const dep = await tx.department.create({
        data: {
          id: newId("department"),
          organizationId: ctx.organizationId,
          name,
          nameKey: departmentNameKey(name),
        },
        select: departmentSelect,
      });
      created.push(dep);
      await recordAudit(
        {
          action: "department.created",
          organizationId: ctx.organizationId,
          actorUserId: ctx.user.id,
          resourceType: "department",
          resourceId: dep.id,
          metadata: { name, source: "onboarding" },
          meta,
        },
        tx,
      );
    }
    return created;
  });
}

export async function updateDepartment(
  ctx: OrgContext,
  id: string,
  input: DepartmentUpdateInput,
  meta: RequestMeta = {},
) {
  assertPermission(ctx.role, "departments:manage");
  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.department.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });
      if (!before) throw new AppError("RESOURCE_NOT_FOUND", "Department not found");

      const data: Prisma.DepartmentUpdateInput = {};
      const changed: string[] = [];
      if (input.name !== undefined && input.name !== before.name) {
        data.name = input.name;
        data.nameKey = departmentNameKey(input.name);
        changed.push("name");
      }
      if (input.description !== undefined && input.description !== before.description) {
        data.description = input.description;
        changed.push("description");
      }
      if (changed.length === 0) {
        return {
          id: before.id,
          name: before.name,
          description: before.description,
          createdAt: before.createdAt,
          updatedAt: before.updatedAt,
        };
      }

      const dep = await tx.department.update({
        where: { id: before.id },
        data,
        select: departmentSelect,
      });
      await recordAudit(
        {
          action: "department.updated",
          organizationId: ctx.organizationId,
          actorUserId: ctx.user.id,
          resourceType: "department",
          resourceId: dep.id,
          metadata: {
            changed,
            ...(changed.includes("name") ? { from: before.name, to: dep.name } : {}),
          },
          meta,
        },
        tx,
      );
      return dep;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("CONFLICT", DUPLICATE);
    throw err;
  }
}

export async function deleteDepartment(ctx: OrgContext, id: string, meta: RequestMeta = {}) {
  assertPermission(ctx.role, "departments:manage");
  await db.$transaction(async (tx) => {
    const dep = await tx.department.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!dep) throw new AppError("RESOURCE_NOT_FOUND", "Department not found");
    // Phase 3: refuse while agents are assigned (CONFLICT) instead of orphaning them.
    await tx.department.delete({ where: { id: dep.id } });
    await recordAudit(
      {
        action: "department.deleted",
        organizationId: ctx.organizationId,
        actorUserId: ctx.user.id,
        resourceType: "department",
        resourceId: dep.id,
        metadata: { name: dep.name },
        meta,
      },
      tx,
    );
  });
}
