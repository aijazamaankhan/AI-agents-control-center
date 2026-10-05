"use server";

import { AppError } from "@/lib/api/errors";
import { getRequestMeta } from "@/lib/auth/request-meta";
import { logger } from "@/lib/logger";
import {
  echoValues,
  fieldErrorsFrom,
  formDataToObject,
  type ActionState,
} from "@/lib/validation/action-state";
import { demoRequestSchema, serviceInquirySchema } from "./schemas";
import { submitDemoRequest, submitServiceInquiry } from "./server/inquiry-service";

function failure(err: unknown, raw: Record<string, string>): ActionState {
  const values = echoValues(raw);
  if (err instanceof AppError) return { ok: false, message: err.message, values };
  logger.error("Inquiry submission failed", { error: err });
  return {
    ok: false,
    message: "We couldn't send your request. Please try again or email us directly.",
    values,
  };
}

export async function submitServiceInquiryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const parsed = serviceInquirySchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echoValues(raw) };
  try {
    await submitServiceInquiry(parsed.data, await getRequestMeta());
    return {
      ok: true,
      message: `Thanks, ${parsed.data.name.split(" ")[0]}! Your request has been received — we'll reply to ${parsed.data.email}.`,
    };
  } catch (err) {
    return failure(err, raw);
  }
}

export async function submitDemoRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = formDataToObject(formData);
  const parsed = demoRequestSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echoValues(raw) };
  try {
    await submitDemoRequest(parsed.data, await getRequestMeta());
    return {
      ok: true,
      message: `Thanks! We'll contact you at ${parsed.data.email} to schedule your AgentOS demo.`,
    };
  } catch (err) {
    return failure(err, raw);
  }
}
