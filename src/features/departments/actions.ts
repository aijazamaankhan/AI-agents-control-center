"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { getCurrentOrgContext } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/auth/request-meta";
import { logger } from "@/lib/logger";
import {
  echoValues,
  fieldErrorsFrom,
  formDataToObject,
  type ActionState,
} from "@/lib/validation/action-state";
import { departmentSchema, onboardingDepartmentsSchema } from "./schemas";
import {
  createDepartment,
  createDepartments,
  deleteDepartment,
  updateDepartment,
} from "./server/department-service";

const EXPIRED: ActionState = {
  ok: false,
  message: "Your session has expired. Please sign in again.",
};

function failure(err: unknown, raw?: Record<string, string>): ActionState {
  const values = raw ? echoValues(raw) : undefined;
  if (err instanceof AppError) return { ok: false, message: err.message, values };
  logger.error("Department action failed", { error: err });
  return { ok: false, message: "Something went wrong. Please try again.", values };
}

export async function createDepartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return EXPIRED;
  const raw = formDataToObject(formData);
  const parsed = departmentSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echoValues(raw) };

  try {
    const dep = await createDepartment(ctx, parsed.data, await getRequestMeta());
    revalidatePath("/", "layout");
    return { ok: true, message: `${dep.name} created.`, values: {} };
  } catch (err) {
    return failure(err, raw);
  }
}

export async function updateDepartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return EXPIRED;
  const raw = formDataToObject(formData);
  const parsed = departmentSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echoValues(raw) };

  try {
    await updateDepartment(ctx, raw.id ?? "", parsed.data, await getRequestMeta());
    revalidatePath("/", "layout");
    return { ok: true, message: "Department saved.", values: echoValues(raw) };
  } catch (err) {
    return failure(err, raw);
  }
}

export async function deleteDepartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return EXPIRED;
  try {
    await deleteDepartment(ctx, String(formData.get("id") ?? ""), await getRequestMeta());
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/", "layout");
  redirect("/departments");
}

/** Onboarding step 2. */
export async function saveOnboardingDepartmentsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return EXPIRED;
  const parsed = onboardingDepartmentsSchema.safeParse(formData.getAll("department").map(String));
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the department names." };

  try {
    await createDepartments(ctx, parsed.data, await getRequestMeta());
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
