import { describe, expect, it } from "vitest";
import { signUp } from "@/features/auth/server/auth-service";
import {
  createOrganization,
  getOrganization,
  updateOrganization,
} from "@/features/organizations/server/organization-service";
import { resolveOrgContext, resolveSessionToken } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { hasPrefix, newId } from "@/lib/ids";
import { createTenant, ORG_INPUT, uniqueEmail } from "../support/factories";

describe("organizations", () => {
  it("creates an org, OWNER membership, active session and audit entry atomically", async () => {
    const auth = await signUp({ name: "Owner", email: uniqueEmail(), password: "owner-password" });
    const session = (await resolveSessionToken(auth.token))!;
    expect(await resolveOrgContext(session)).toBeNull();

    const org = await createOrganization(
      { userId: auth.userId, sessionId: session.sessionId },
      ORG_INPUT,
    );
    expect(hasPrefix(org.id, "organization")).toBe(true);
    expect(org.slug).toMatch(/^acme-corporation-[a-f0-9]{6}$/);

    const ctx = await resolveOrgContext((await resolveSessionToken(auth.token))!);
    expect(ctx).toMatchObject({ organizationId: org.id, role: "OWNER" });

    const audit = await db.auditLog.findFirst({
      where: { organizationId: org.id, action: "organization.created" },
    });
    expect(audit?.actorUserId).toBe(auth.userId);
  });

  it("lets OWNER update the organization and audits changed fields", async () => {
    const { ctx } = await createTenant();
    const updated = await updateOrganization(ctx, {
      ...ORG_INPUT,
      name: "Acme Global",
      timezone: "Asia/Kolkata",
    });
    expect(updated.name).toBe("Acme Global");

    const audit = await db.auditLog.findFirstOrThrow({
      where: { organizationId: ctx.organizationId, action: "organization.updated" },
    });
    expect(audit.metadata).toEqual({ changed: ["name", "timezone"] });
  });

  it("forbids MEMBER and VIEWER from updating the organization", async () => {
    const { ctx } = await createTenant();
    for (const role of ["MANAGER", "MEMBER", "VIEWER"] as const) {
      await expect(
        updateOrganization({ ...ctx, role }, { ...ORG_INPUT, name: "Hacked" }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    expect((await getOrganization(ctx)).name).toBe("Acme Corporation");
  });

  it("rolls back the whole creation if any step fails", async () => {
    const auth = await signUp({ name: "Owner", email: uniqueEmail(), password: "owner-password" });
    const before = await db.organization.count();
    await expect(
      createOrganization({ userId: auth.userId, sessionId: newId("session") }, ORG_INPUT),
    ).rejects.toThrow();
    expect(await db.organization.count()).toBe(before);
    expect(await db.membership.count({ where: { userId: auth.userId } })).toBe(0);
  });
});
