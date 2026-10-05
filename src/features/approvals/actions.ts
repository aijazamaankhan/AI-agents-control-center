"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/api/errors";
import { getCurrentOrgContext } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/auth/request-meta";
import { logger } from "@/lib/logger";
import { fieldErrorsFrom, formDataToObject, type ActionState } from "@/lib/validation/action-state";
import { decideFormSchema } from "./schemas";
import { decideApproval } from "./server/approval-service";

export async function decideApprovalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return { ok: false, message: "Your session has expired. Sign in again." };
  const parsed = decideFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  const { id, decision, note } = parsed.data;
  try {
    await decideApproval(ctx, id, decision, note, await getRequestMeta());
  } catch (err) {
    if (err instanceof AppError) return { ok: false, message: err.message };
    logger.error("Approval decision failed", { error: err });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  revalidatePath("/approvals");
  revalidatePath("/popup/approvals");
  revalidatePath("/dashboard");
  return { ok: true, message: decision === "APPROVED" ? "Approved." : "Rejected." };
}
