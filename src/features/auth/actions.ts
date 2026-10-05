"use server";

import { redirect } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { getRequestMeta } from "@/lib/auth/request-meta";
import { deleteSessionByToken } from "@/lib/auth/sessions";
import { logger } from "@/lib/logger";
import { recordAudit } from "@/lib/security/audit";
import {
  echoValues,
  fieldErrorsFrom,
  formDataToObject,
  type ActionState,
} from "@/lib/validation/action-state";
import { loginSchema, safeRedirectPath, signupSchema } from "./schemas";
import { logIn, signUp } from "./server/auth-service";

function failure(err: unknown, raw: Record<string, string>): ActionState {
  const values = echoValues(raw);
  if (err instanceof AppError) return { ok: false, message: err.message, values };
  logger.error("Auth action failed", { error: err });
  return { ok: false, message: "Something went wrong. Please try again.", values };
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echoValues(raw) };

  try {
    const result = await signUp(parsed.data, await getRequestMeta());
    await setSessionCookie(result.token, result.expiresAt);
  } catch (err) {
    return failure(err, raw);
  }
  redirect("/onboarding");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echoValues(raw) };

  let destination: string;
  try {
    const result = await logIn(parsed.data, await getRequestMeta());
    await setSessionCookie(result.token, result.expiresAt);
    destination = result.hasOrganization ? safeRedirectPath(raw.next) : "/onboarding";
  } catch (err) {
    return failure(err, raw);
  }
  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionCookie();
  if (token) {
    const userId = await deleteSessionByToken(token);
    if (userId) {
      await recordAudit({
        action: "user.logout",
        actorUserId: userId,
        resourceType: "user",
        resourceId: userId,
        meta: await getRequestMeta(),
      });
    }
  }
  await clearSessionCookie();
  redirect("/login");
}
