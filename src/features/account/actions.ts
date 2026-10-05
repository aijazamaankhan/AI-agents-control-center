"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/api/errors";
import { getCurrentSession } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/auth/request-meta";
import { logger } from "@/lib/logger";
import {
  echoValues,
  fieldErrorsFrom,
  formDataToObject,
  type ActionState,
} from "@/lib/validation/action-state";
import { changePasswordSchema, profileSchema } from "./schemas";
import { changePassword, signOutOtherSessions, updateProfile } from "./server/account-service";

const EXPIRED: ActionState = {
  ok: false,
  message: "Your session has expired. Please sign in again.",
};

function failure(err: unknown): ActionState {
  if (err instanceof AppError) {
    const fieldErrors = err.details?.fieldErrors as ActionState["fieldErrors"];
    return { ok: false, message: fieldErrors ? undefined : err.message, fieldErrors };
  }
  logger.error("Account action failed", { error: err });
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return EXPIRED;
  const raw = formDataToObject(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echoValues(raw) };
  try {
    await updateProfile(session, parsed.data.name, await getRequestMeta());
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved.", values: echoValues(raw) };
  } catch (err) {
    return failure(err);
  }
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return EXPIRED;
  const parsed = changePasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  try {
    await changePassword(session, parsed.data, await getRequestMeta());
    return { ok: true, message: "Password changed. Other devices were signed out." };
  } catch (err) {
    return failure(err);
  }
}

export async function signOutOthersAction(_prev: ActionState): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return EXPIRED;
  try {
    const count = await signOutOtherSessions(session, await getRequestMeta());
    revalidatePath("/settings");
    return {
      ok: true,
      message: count
        ? `Signed out ${count} other session${count === 1 ? "" : "s"}.`
        : "No other sessions.",
    };
  } catch (err) {
    return failure(err);
  }
}
