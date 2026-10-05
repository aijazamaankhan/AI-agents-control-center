import type { z } from "zod";

/** Result shape returned by form server actions (consumed by useActionState). */
export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Submitted values echoed back so React's post-action form reset doesn't wipe user input. Never secrets. */
  values?: Record<string, string>;
  /** Extra result data (e.g. a one-time API key to display). */
  data?: Record<string, string>;
}

export const initialActionState: ActionState = { ok: false };

export function fieldErrorsFrom(error: z.ZodError): ActionState["fieldErrors"] {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

const SECRET_FIELDS = new Set(["password", "currentPassword", "newPassword", "authSecret"]);

export function echoValues(raw: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(raw).filter(([k]) => !SECRET_FIELDS.has(k)));
}

export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}
