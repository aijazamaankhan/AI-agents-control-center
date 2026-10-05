import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as postEvent } from "@/app/api/agent-events/route";
import { changePassword, signOutOtherSessions } from "@/features/account/server/account-service";
import {
  getOrganizationAdmin,
  listInquiriesAdmin,
  listOrganizationsAdmin,
  listUsersAdmin,
  platformAuditLog,
  platformOverview,
  resetUserPassword,
  revokeAgentKeys,
  revokeUserSessions,
  setInquiryHandled,
  setOrganizationSuspended,
  setUserSuspended,
} from "@/features/admin/server/admin-service";
import { agentSchema } from "@/features/agents/schemas";
import { createAgent } from "@/features/agents/server/agent-service";
import { logIn, signUp } from "@/features/auth/server/auth-service";
import { createDepartment } from "@/features/departments/server/department-service";
import { submitDemoRequest } from "@/features/inquiries/server/inquiry-service";
import { resolveOrgContext, resolveSessionToken, type ResolvedSession } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { createTenant, uniqueEmail } from "../support/factories";

async function makeAdmin(): Promise<ResolvedSession> {
  const email = uniqueEmail("admin");
  const { userId, token } = await signUp({
    name: "Velorex Admin",
    email,
    password: "admin-password-1",
  });
  await db.user.update({ where: { id: userId }, data: { isPlatformAdmin: true } });
  return (await resolveSessionToken(token))!;
}

const sendEvent = (apiKey: string) =>
  postEvent(
    new Request("http://localhost/api/agent-events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": randomUUID(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: "log", message: "hi" }),
    }),
  );

describe("platform admin", () => {
  it("refuses non-admins everywhere", async () => {
    const t = await createTenant();
    const session = (await resolveSessionToken(t.token))!;
    expect(session.user.isPlatformAdmin).toBe(false);
    await expect(platformOverview(session)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listOrganizationsAdmin(session)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setOrganizationSuspended(session, t.org.id, true)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(resetUserPassword(session, t.userId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sees every customer and can search by company or owner email", async () => {
    const admin = await makeAdmin();
    const t = await createTenant("Zebra Logistics");
    expect((await listOrganizationsAdmin(admin, { q: "zebra" })).rows.map((r) => r.name)).toContain(
      "Zebra Logistics",
    );
    expect((await listOrganizationsAdmin(admin, { q: t.email })).rows[0]!.id).toBe(t.org.id);
    expect((await platformOverview(admin)).counts.organizations).toBeGreaterThan(0);
    const detail = await getOrganizationAdmin(admin, t.org.id);
    expect(detail.memberships[0]).toMatchObject({ role: "OWNER", user: { email: t.email } });
    expect(JSON.stringify(detail)).not.toMatch(/password_hash|passwordHash|ciphertext/);
  });

  it("suspends an organization: members are flagged and agent keys stop working; reactivation restores", async () => {
    const admin = await makeAdmin();
    const t = await createTenant();
    const dep = await createDepartment(t.ctx, { name: "Sales", description: "" });
    const { apiKey } = await createAgent(
      t.ctx,
      agentSchema.parse({
        name: "Agent Alpha",
        departmentId: dep.id,
        provider: "Anthropic",
        model: "Claude Sonnet",
        connectionType: "SDK",
      }),
    );
    expect((await sendEvent(apiKey)).status).toBe(201);

    await setOrganizationSuspended(admin, t.org.id, true);
    const ctx = await resolveOrgContext((await resolveSessionToken(t.token))!);
    expect(ctx?.organizationSuspended).toBe(true);
    const blocked = await sendEvent(apiKey);
    expect(blocked.status).toBe(403);

    await setOrganizationSuspended(admin, t.org.id, false);
    expect(
      (await resolveOrgContext((await resolveSessionToken(t.token))!))?.organizationSuspended,
    ).toBe(false);
    expect((await sendEvent(apiKey)).status).toBe(201);
    const actions = (await platformAuditLog(admin, { action: "admin.organization" })).rows
      .filter((r) => r.resourceId === t.org.id)
      .map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining(["admin.organization_suspended", "admin.organization_reactivated"]),
    );
  });

  it("suspends a user: sessions end immediately and sign-in is refused", async () => {
    const admin = await makeAdmin();
    const t = await createTenant();
    await setUserSuspended(admin, t.userId, true);
    expect(await resolveSessionToken(t.token)).toBeNull();
    await expect(logIn({ email: t.email, password: t.password })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await setUserSuspended(admin, t.userId, false);
    await expect(logIn({ email: t.email, password: t.password })).resolves.toBeTruthy();
  });

  it("resets a password to a one-time temporary value and signs the user out", async () => {
    const admin = await makeAdmin();
    const t = await createTenant();
    const temporary = await resetUserPassword(admin, t.userId);
    expect(temporary).toMatch(/^Tmp-/);
    expect(await resolveSessionToken(t.token)).toBeNull();
    await expect(logIn({ email: t.email, password: t.password })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(logIn({ email: t.email, password: temporary })).resolves.toBeTruthy();
    const stored = await db.user.findUniqueOrThrow({ where: { id: t.userId } });
    expect(stored.passwordHash).not.toContain(temporary);
  });

  it("signs a user out everywhere and revokes an agent's keys", async () => {
    const admin = await makeAdmin();
    const t = await createTenant();
    await logIn({ email: t.email, password: t.password });
    expect(await revokeUserSessions(admin, t.userId)).toBeGreaterThanOrEqual(2);
    expect(await db.session.count({ where: { userId: t.userId } })).toBe(0);

    const dep = await createDepartment(t.ctx, { name: "Ops", description: "" });
    const { id, apiKey } = await createAgent(
      t.ctx,
      agentSchema.parse({
        name: "Agent Beta",
        departmentId: dep.id,
        provider: "OpenAI",
        model: "GPT-5",
        connectionType: "SDK",
      }),
    );
    expect(await revokeAgentKeys(admin, id)).toBe(1);
    expect((await sendEvent(apiKey)).status).toBe(401);
  });

  it("protects admins from acting on themselves", async () => {
    const admin = await makeAdmin();
    await expect(setUserSuspended(admin, admin.user.id, true)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(resetUserPassword(admin, admin.user.id)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect((await listUsersAdmin(admin, { q: admin.user.email })).rows[0]!.isPlatformAdmin).toBe(
      true,
    );
  });

  it("lists enquiries and marks them handled", async () => {
    const admin = await makeAdmin();
    const res = await submitDemoRequest(
      {
        name: "Sam Lee",
        email: `sam-${randomUUID()}@acme.io`,
        company: "Acme",
        phone: "",
        teamSize: "",
        message: "",
      },
      { ipAddress: `adm-${randomUUID()}` },
    );
    expect(
      (await listInquiriesAdmin(admin, { status: "open", type: "DEMO" })).rows.some(
        (r) => r.id === res.id,
      ),
    ).toBe(true);
    await setInquiryHandled(admin, res.id!, true);
    expect(
      (await listInquiriesAdmin(admin, { status: "handled" })).rows.some((r) => r.id === res.id),
    ).toBe(true);
  });
});

describe("account security", () => {
  it("changes password with the current one and signs out other sessions", async () => {
    const t = await createTenant();
    const other = await logIn({ email: t.email, password: t.password });
    const session = (await resolveSessionToken(t.token))!;
    await expect(
      changePassword(session, {
        currentPassword: "wrong-password",
        newPassword: "brand-new-pass-1",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await changePassword(session, { currentPassword: t.password, newPassword: "brand-new-pass-1" });
    expect(await resolveSessionToken(t.token)).not.toBeNull(); // current session kept
    expect(await resolveSessionToken(other.token)).toBeNull(); // others revoked
    await expect(logIn({ email: t.email, password: "brand-new-pass-1" })).resolves.toBeTruthy();
  });

  it("signs out all other sessions", async () => {
    const t = await createTenant();
    await logIn({ email: t.email, password: t.password });
    await logIn({ email: t.email, password: t.password });
    const session = (await resolveSessionToken(t.token))!;
    expect(await signOutOtherSessions(session)).toBe(2);
    expect(await resolveSessionToken(t.token)).not.toBeNull();
  });
});
