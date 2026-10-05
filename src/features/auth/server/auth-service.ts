import "server-only";
import { AppError } from "@/lib/api/errors";
import { getDummyPasswordHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, type RequestMeta } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/security/audit";
import { RATE_LIMITS, rateLimiter } from "@/lib/security/rate-limit";
import { Prisma } from "@/generated/prisma/client";
import type { LoginInput, SignupInput } from "../schemas";

export interface AuthResult {
  userId: string;
  token: string;
  expiresAt: Date;
  hasOrganization: boolean;
}

const INVALID_CREDENTIALS = "Invalid email or password.";

export async function signUp(input: SignupInput, meta: RequestMeta = {}): Promise<AuthResult> {
  if (meta.ipAddress) {
    const { limit, windowMs } = RATE_LIMITS.signupPerIp;
    const res = await rateLimiter.hit(`signup:ip:${meta.ipAddress}`, limit, windowMs);
    if (!res.ok) throw new AppError("RATE_LIMITED", "Too many attempts. Please try again later.");
  }

  const passwordHash = await hashPassword(input.password);
  const userId = newId("user");
  try {
    await db.$transaction(async (tx) => {
      await tx.user.create({
        data: { id: userId, email: input.email, name: input.name, passwordHash },
      });
      await recordAudit(
        {
          action: "user.signup",
          actorUserId: userId,
          resourceType: "user",
          resourceId: userId,
          meta,
        },
        tx,
      );
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError("CONFLICT", "An account with this email already exists. Try signing in.");
    }
    throw err;
  }

  const session = await createSession(userId, meta);
  return { userId, token: session.token, expiresAt: session.expiresAt, hasOrganization: false };
}

export async function logIn(input: LoginInput, meta: RequestMeta = {}): Promise<AuthResult> {
  const checks = [
    rateLimiter.hit(
      `login:email:${input.email}`,
      RATE_LIMITS.loginPerEmail.limit,
      RATE_LIMITS.loginPerEmail.windowMs,
    ),
  ];
  if (meta.ipAddress) {
    checks.push(
      rateLimiter.hit(
        `login:ip:${meta.ipAddress}`,
        RATE_LIMITS.loginPerIp.limit,
        RATE_LIMITS.loginPerIp.windowMs,
      ),
    );
  }
  if ((await Promise.all(checks)).some((r) => !r.ok)) {
    throw new AppError("RATE_LIMITED", "Too many sign-in attempts. Please wait a few minutes.");
  }

  const user = await db.user.findUnique({ where: { email: input.email } });
  // Always run a full hash comparison so response time doesn't reveal whether the email exists.
  const valid = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await getDummyPasswordHash()),
  );

  if (!user || !valid) {
    await recordAudit({
      action: "user.login_failed",
      actorUserId: user?.id ?? null,
      resourceType: "user",
      resourceId: user?.id ?? null,
      meta,
    });
    throw new AppError("UNAUTHENTICATED", INVALID_CREDENTIALS);
  }

  if (user.suspendedAt) {
    throw new AppError(
      "FORBIDDEN",
      "This account has been suspended. Contact Velorex Studio support.",
    );
  }

  await rateLimiter.reset(`login:email:${input.email}`);
  const firstMembership = await db.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  const session = await createSession(user.id, meta, firstMembership?.organizationId ?? null);

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit({
    action: "user.login",
    actorUserId: user.id,
    organizationId: firstMembership?.organizationId ?? null,
    resourceType: "user",
    resourceId: user.id,
    meta,
  });

  return {
    userId: user.id,
    token: session.token,
    expiresAt: session.expiresAt,
    hasOrganization: Boolean(firstMembership),
  };
}
