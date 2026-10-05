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
import { addPriceSchema } from "./schemas";
import { addPrice } from "./server/pricing-service";

export async function addPriceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session?.user.isPlatformAdmin)
    return { ok: false, message: "Platform administrators only." };
  const raw = formDataToObject(formData);
  const parsed = addPriceSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echoValues(raw) };

  try {
    const { price, repriced } = await addPrice(session, parsed.data, await getRequestMeta());
    revalidatePath("/admin/pricing");
    return {
      ok: true,
      message: `Saved ${price.provider} / ${price.model} v${price.version}.${
        repriced ? ` ${repriced} earlier unpriced call${repriced === 1 ? "" : "s"} now priced.` : ""
      }`,
    };
  } catch (err) {
    if (err instanceof AppError)
      return { ok: false, message: err.message, values: echoValues(raw) };
    logger.error("Add price failed", { error: err });
    return { ok: false, message: "Something went wrong.", values: echoValues(raw) };
  }
}
