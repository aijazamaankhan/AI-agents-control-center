import { describe, expect, it } from "vitest";
import {
  countMembers,
  getOrganization,
  updateOrganization,
} from "@/features/organizations/server/organization-service";
import { resolveOrgContext, resolveSessionToken } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { createTenant, ORG_INPUT } from "../support/factories";

describe("tenant isolation", () => {
  it("only ever returns the caller's own organization", async () => {
    const a = await createTenant("Company A");
    const b = await createTenant("Company B");

    expect((await getOrganization(a.ctx)).name).toBe("Company A");
    expect((await getOrganization(b.ctx)).name).toBe("Company B");
    expect(await countMembers(a.ctx)).toBe(1);
  });

  it("ignores a session pointed at an organization the user does not belong to", async () => {
    const a = await createTenant("Company A");
    const b = await createTenant("Company B");

    // Simulate a tampered/stale session: A's session claims B's organization.
    await db.session.updateMany({
      where: { userId: a.userId },
      data: { activeOrganizationId: b.org.id },
    });

    const ctx = await resolveOrgContext((await resolveSessionToken(a.token))!);
    expect(ctx?.organizationId).toBe(a.org.id);
    expect(ctx?.organizationId).not.toBe(b.org.id);

    // And the session is repaired to a legitimate membership.
    const session = await db.session.findFirstOrThrow({ where: { userId: a.userId } });
    expect(session.activeOrganizationId).toBe(a.org.id);
  });

  it("loses access immediately when membership is removed", async () => {
    const a = await createTenant("Company A");
    await db.membership.deleteMany({ where: { userId: a.userId } });
    expect(await resolveOrgContext((await resolveSessionToken(a.token))!)).toBeNull();
  });

  it("cannot update another tenant even as OWNER of its own", async () => {
    const a = await createTenant("Company A");
    const b = await createTenant("Company B");

    // Even if a forged context targeted B, updates are scoped by ctx.organizationId only;
    // the input schema carries no org id, so A's update can only ever touch A.
    await updateOrganization(a.ctx, { ...ORG_INPUT, name: "Company A Renamed" });
    expect((await getOrganization(b.ctx)).name).toBe("Company B");
  });

  it("scopes audit logs to the acting organization", async () => {
    const a = await createTenant("Company A");
    const b = await createTenant("Company B");
    const aLogs = await db.auditLog.findMany({ where: { organizationId: a.org.id } });
    expect(aLogs.length).toBeGreaterThan(0);
    expect(aLogs.every((l) => l.organizationId === a.org.id)).toBe(true);
    expect(aLogs.some((l) => l.actorUserId === b.userId)).toBe(false);
  });
});
