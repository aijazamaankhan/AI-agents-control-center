import { describe, expect, it } from "vitest";
import { logIn, signUp } from "@/features/auth/server/auth-service";
import { verifyPassword } from "@/lib/auth/password";
import { deleteSessionByToken, resolveSessionToken } from "@/lib/auth/sessions";
import { hashSessionToken } from "@/lib/auth/session-token";
import { db } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { uniqueEmail } from "../support/factories";

describe("authentication", () => {
  it("signs up a user with a hashed password and a hashed session token", async () => {
    const email = uniqueEmail();
    const result = await signUp({ name: "Ada Lovelace", email, password: "analytical-engine" });

    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toContain("analytical-engine");
    expect(await verifyPassword("analytical-engine", user.passwordHash)).toBe(true);

    const session = await db.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.tokenHash).toBe(hashSessionToken(result.token));
    expect(session.tokenHash).not.toBe(result.token);
    expect(result.hasOrganization).toBe(false);

    const audit = await db.auditLog.findFirst({
      where: { actorUserId: user.id, action: "user.signup" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects duplicate emails with a CONFLICT", async () => {
    const email = uniqueEmail();
    await signUp({ name: "A", email, password: "first-password" });
    await expect(signUp({ name: "B", email, password: "second-password" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("logs in with correct credentials and returns a generic error otherwise", async () => {
    const email = uniqueEmail();
    await signUp({ name: "Grace", email, password: "cobol-forever" });

    const ok = await logIn({ email, password: "cobol-forever" });
    expect(await resolveSessionToken(ok.token)).toMatchObject({ user: { email } });

    const wrongPassword = await logIn({ email, password: "nope-nope-nope" }).catch(
      (e: AppError) => e,
    );
    const unknownUser = await logIn({ email: uniqueEmail(), password: "whatever-pass" }).catch(
      (e: AppError) => e,
    );
    expect(wrongPassword).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Invalid email or password.",
    });
    expect(unknownUser).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Invalid email or password.",
    });

    const failed = await db.auditLog.count({
      where: { action: "user.login_failed", actor: { email } },
    });
    expect(failed).toBe(1);
  });

  it("rate limits repeated failed logins per email", async () => {
    const email = uniqueEmail();
    await signUp({ name: "Rate", email, password: "correct-password" });
    for (let i = 0; i < 10; i++)
      await logIn({ email, password: "wrong-password" }).catch(() => undefined);
    await expect(logIn({ email, password: "correct-password" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("invalidates sessions on logout and on expiry", async () => {
    const email = uniqueEmail();
    const { token } = await signUp({ name: "Lin", email, password: "temporary-pass" });
    expect(await resolveSessionToken(token)).not.toBeNull();
    await deleteSessionByToken(token);
    expect(await resolveSessionToken(token)).toBeNull();

    const second = await logIn({ email, password: "temporary-pass" });
    await db.session.update({
      where: { tokenHash: hashSessionToken(second.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await resolveSessionToken(second.token)).toBeNull();
    expect(await resolveSessionToken("garbage-token")).toBeNull();
    expect(await resolveSessionToken(undefined)).toBeNull();
  });
});
