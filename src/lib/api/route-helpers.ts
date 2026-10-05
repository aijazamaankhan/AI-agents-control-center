import "server-only";
import type { z } from "zod";
import { getCurrentOrgContext } from "@/lib/auth/guards";
import type { OrgContext } from "@/lib/auth/sessions";
import { AppError } from "./errors";

export async function requireApiContext(): Promise<OrgContext> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) throw new AppError("UNAUTHENTICATED", "Sign in to continue.");
  return ctx;
}

export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues)
      (fieldErrors[issue.path.join(".") || "_"] ??= []).push(issue.message);
    throw new AppError("VALIDATION_ERROR", "Some fields are invalid.", { fieldErrors });
  }
  return parsed.data;
}
