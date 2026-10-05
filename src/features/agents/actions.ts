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
import { agentSchema, capabilitiesSchema, connectionSchema } from "./schemas";
import {
  createAgent,
  deleteAgent,
  loadAgentSecret,
  markConnectionVerified,
  rotateAgentApiKey,
  setAgentCapabilities,
  updateAgent,
} from "./server/agent-service";
import { testConnection } from "./server/connection-test";

const EXPIRED: ActionState = {
  ok: false,
  message: "Your session has expired. Please sign in again.",
};

/** Echo the form back without secrets (authSecret is never returned to the browser). */
const echo = (raw: Record<string, string>) => echoValues(raw);

function failure(err: unknown, raw: Record<string, string>): ActionState {
  if (err instanceof AppError) {
    const fieldErrors = (err.details?.fieldErrors as ActionState["fieldErrors"]) ?? undefined;
    return {
      ok: false,
      message: fieldErrors ? undefined : err.message,
      fieldErrors,
      values: echo(raw),
    };
  }
  logger.error("Agent action failed", { error: err });
  return { ok: false, message: "Something went wrong. Please try again.", values: echo(raw) };
}

export async function createAgentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return EXPIRED;
  const raw = formDataToObject(formData);
  const parsed = agentSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echo(raw) };
  try {
    const { id, apiKey } = await createAgent(ctx, parsed.data, await getRequestMeta());
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `${parsed.data.name} connected.`,
      data: { agentId: id, apiKey, name: parsed.data.name },
    };
  } catch (err) {
    return failure(err, raw);
  }
}

export async function updateAgentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return EXPIRED;
  const raw = formDataToObject(formData);
  const parsed = agentSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), values: echo(raw) };
  try {
    await updateAgent(ctx, raw.agentId ?? "", parsed.data, await getRequestMeta());
    revalidatePath("/", "layout");
    return { ok: true, message: "Agent saved.", values: echo(raw) };
  } catch (err) {
    return failure(err, raw);
  }
}

/** Tests the connection described by the form; on edit, a blank secret falls back to the stored one. */
export async function testConnectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return EXPIRED;
  const raw = formDataToObject(formData);
  const parsed = connectionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  try {
    const conn = parsed.data;
    let secret: { secret?: string; username?: string } | null = conn.authSecret
      ? { secret: conn.authSecret, username: conn.authUsername }
      : null;
    if (!secret && raw.agentId) secret = await loadAgentSecret(ctx, raw.agentId);
    const result = await testConnection(ctx, conn, secret);
    if (raw.agentId && conn.endpointUrl)
      await markConnectionVerified(ctx, raw.agentId, result.ok, await getRequestMeta());
    return {
      ok: result.ok,
      message:
        result.latencyMs !== undefined
          ? `${result.message} · ${result.latencyMs} ms`
          : result.message,
    };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, message: err.message };
    logger.error("Connection test failed", { error: err });
    return { ok: false, message: "Could not run the connection test." };
  }
}

export async function updateCapabilitiesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return EXPIRED;
  const parsed = capabilitiesSchema.safeParse(formData.get("capabilities")?.toString());
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid capabilities" };
  try {
    await setAgentCapabilities(
      ctx,
      String(formData.get("agentId") ?? ""),
      parsed.data,
      await getRequestMeta(),
    );
    revalidatePath("/", "layout");
    return { ok: true, message: "Permissions saved." };
  } catch (err) {
    return failure(err, {});
  }
}

export async function rotateApiKeyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return EXPIRED;
  try {
    const apiKey = await rotateAgentApiKey(
      ctx,
      String(formData.get("agentId") ?? ""),
      await getRequestMeta(),
    );
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: "New API key created. The previous key no longer works.",
      data: { apiKey },
    };
  } catch (err) {
    return failure(err, {});
  }
}

export async function deleteAgentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await getCurrentOrgContext();
  if (!ctx) return EXPIRED;
  try {
    await deleteAgent(ctx, String(formData.get("agentId") ?? ""), await getRequestMeta());
  } catch (err) {
    return failure(err, {});
  }
  revalidatePath("/", "layout");
  redirect("/agents");
}
