import { describe, expect, it } from "vitest";
import {
  createDepartment,
  createDepartments,
  deleteDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
} from "@/features/departments/server/department-service";
import { db } from "@/lib/db/client";
import { hasPrefix } from "@/lib/ids";
import { createTenant } from "../support/factories";

describe("departments", () => {
  it("creates, lists, renames and deletes with audit entries", async () => {
    const { ctx } = await createTenant();
    const sales = await createDepartment(ctx, { name: "Sales", description: "Revenue team" });
    expect(hasPrefix(sales.id, "department")).toBe(true);

    await createDepartment(ctx, { name: "Support", description: "" });
    expect((await listDepartments(ctx)).map((d) => d.name)).toEqual(["Sales", "Support"]);

    const renamed = await updateDepartment(ctx, sales.id, { name: "Revenue" });
    expect(renamed.name).toBe("Revenue");
    expect(renamed.description).toBe("Revenue team"); // untouched by a name-only update

    await deleteDepartment(ctx, sales.id);
    expect((await listDepartments(ctx)).map((d) => d.name)).toEqual(["Support"]);

    const actions = (
      await db.auditLog.findMany({
        where: { organizationId: ctx.organizationId, resourceType: "department" },
      })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(["department.created", "department.updated", "department.deleted"]),
    );
    const update = await db.auditLog.findFirstOrThrow({
      where: { organizationId: ctx.organizationId, action: "department.updated" },
    });
    expect(update.metadata).toMatchObject({ changed: ["name"], from: "Sales", to: "Revenue" });
  });

  it("enforces case-insensitive unique names per organization only", async () => {
    const a = await createTenant("Company A");
    const b = await createTenant("Company B");
    await createDepartment(a.ctx, { name: "Sales", description: "" });
    await expect(createDepartment(a.ctx, { name: "SALES", description: "" })).rejects.toMatchObject(
      {
        code: "CONFLICT",
      },
    );
    // Same name in another tenant is fine.
    await expect(createDepartment(b.ctx, { name: "Sales", description: "" })).resolves.toBeTruthy();

    const ops = await createDepartment(a.ctx, { name: "Ops", description: "" });
    await expect(updateDepartment(a.ctx, ops.id, { name: "sales" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("bulk-creates onboarding departments, skipping existing names", async () => {
    const { ctx } = await createTenant();
    await createDepartment(ctx, { name: "Finance", description: "" });
    const created = await createDepartments(ctx, ["Sales", "finance", "HR"]);
    expect(created.map((d) => d.name)).toEqual(["Sales", "HR"]);
    expect(await db.department.count({ where: { organizationId: ctx.organizationId } })).toBe(3);
  });

  it("only lets OWNER and ADMIN manage departments", async () => {
    const { ctx } = await createTenant();
    const dep = await createDepartment({ ...ctx, role: "ADMIN" }, { name: "Ops", description: "" });
    for (const role of ["MANAGER", "MEMBER", "VIEWER"] as const) {
      const as = { ...ctx, role };
      await expect(
        createDepartment(as, { name: `X ${role}`, description: "" }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(updateDepartment(as, dep.id, { name: "Hacked" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(deleteDepartment(as, dep.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      // ...but everyone in the org can read.
      expect((await getDepartment(as, dep.id)).name).toBe("Ops");
    }
  });

  it("never exposes or mutates another tenant's departments", async () => {
    const a = await createTenant("Company A");
    const b = await createTenant("Company B");
    const secret = await createDepartment(b.ctx, { name: "Secret Lab", description: "B only" });

    expect(await listDepartments(a.ctx)).toEqual([]);
    await expect(getDepartment(a.ctx, secret.id)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
    await expect(updateDepartment(a.ctx, secret.id, { name: "Pwned" })).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
    await expect(deleteDepartment(a.ctx, secret.id)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });

    expect((await getDepartment(b.ctx, secret.id)).name).toBe("Secret Lab");
  });
});
