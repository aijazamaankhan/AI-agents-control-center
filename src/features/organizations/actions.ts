"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { getCurrentOrgContext, requireSession } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/auth/request-meta";
import { logger } from "@/lib/logger";
import {
  echoValues,
  fieldErrorsFrom,
  formDataToObject,
  type ActionState,
} from "@/lib/validation/action-state";
import { organizationSchema } from "./schemas";
import { createOrganization, updateOrganization } from "./server/organization-service";

function failure(err: unknown, raw: Record<string, string>): ActionState {
  const values = echoValues(raw);
  if (err instanceof AppError) return { ok: false, message: err.message, values };
  logger.error("Organization action failed", { error: err });
  return { ok: false, message: "Something went wrong. Please try again.", values };
}

export async function createOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const raw = formDataToObject(formData);
  const parsed = organizationSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echoValues(raw) };

  try {
    await createOrganization(
      { userId: session.user.id, sessionId: session.sessionId },
      parsed.data,
      await getRequestMeta(),
    );
  } catch (err) {
    return failure(err, raw);
  }
  redirect("/dashboard");
}

export async function updateOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return { ok: false, message: "Your session has expired. Please sign in again." };

  const raw = formDataToObject(formData);
  const parsed = organizationSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echoValues(raw) };

  try {
    await updateOrganization(ctx, parsed.data, await getRequestMeta());
  } catch (err) {
    return failure(err, raw);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Organization settings saved.", values: echoValues(raw) };
}
