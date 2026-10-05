"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/api/errors";
import { getCurrentSession } from "@/lib/auth/guards";
import { getRequestMeta } from "@/lib/auth/request-meta";
import { logger } from "@/lib/logger";
import type { ActionState } from "@/lib/validation/action-state";
import {
  resetUserPassword,
  revokeAgentKeys,
  revokeUserSessions,
  setInquiryHandled,
  setOrganizationSuspended,
  setUserSuspended,
} from "./server/admin-service";

const OPERATIONS = [
  "org.suspend",
  "org.reactivate",
  "user.suspend",
  "user.reactivate",
  "user.signout",
  "user.reset_password",
  "agent.revoke_keys",
  "inquiry.handled",
  "inquiry.reopen",
] as const;
type Operation = (typeof OPERATIONS)[number];

/** Single entry point for admin buttons: { op, id } from hidden inputs. */
export async function adminAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session?.user.isPlatformAdmin)
    return { ok: false, message: "Platform administrators only." };
  const op = String(formData.get("op") ?? "") as Operation;
  const id = String(formData.get("id") ?? "");
  if (!OPERATIONS.includes(op) || !id) return { ok: false, message: "Unknown action." };
  const meta = await getRequestMeta();

  try {
    let result: ActionState;
    switch (op) {
      case "org.suspend":
      case "org.reactivate":
        await setOrganizationSuspended(session, id, op === "org.suspend", meta);
        result = {
          ok: true,
          message: op === "org.suspend" ? "Organization suspended." : "Organization reactivated.",
        };
        break;
      case "user.suspend":
      case "user.reactivate":
        await setUserSuspended(session, id, op === "user.suspend", meta);
        result = {
          ok: true,
          message: op === "user.suspend" ? "User suspended and signed out." : "User reactivated.",
        };
        break;
      case "user.signout": {
        const count = await revokeUserSessions(session, id, meta);
        result = { ok: true, message: `Signed out of ${count} session${count === 1 ? "" : "s"}.` };
        break;
      }
      case "user.reset_password": {
        const temporary = await resetUserPassword(session, id, meta);
        result = {
          ok: true,
          message: "Temporary password set. Share it securely — it's shown only once.",
          data: { temporaryPassword: temporary },
        };
        break;
      }
      case "agent.revoke_keys": {
        const count = await revokeAgentKeys(session, id, meta);
        result = { ok: true, message: `Revoked ${count} API key${count === 1 ? "" : "s"}.` };
        break;
      }
      case "inquiry.handled":
      case "inquiry.reopen":
        await setInquiryHandled(session, id, op === "inquiry.handled", meta);
        result = {
          ok: true,
          message: op === "inquiry.handled" ? "Marked as handled." : "Reopened.",
        };
        break;
    }
    revalidatePath("/admin", "layout");
    return result;
  } catch (err) {
    if (err instanceof AppError) return { ok: false, message: err.message };
    logger.error("Admin action failed", { error: err, op });
    return { ok: false, message: "Something went wrong." };
  }
}
