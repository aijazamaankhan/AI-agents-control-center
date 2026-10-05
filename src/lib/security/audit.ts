import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/ids";
import { redact } from "@/lib/logger";
import type { RequestMeta } from "@/lib/auth/sessions";

export type AuditAction =
  | "user.signup"
  | "user.login"
  | "user.login_failed"
  | "user.logout"
  | "organization.created"
  | "organization.updated"
  | "department.created"
  | "department.updated"
  | "department.deleted"
  | "agent.created"
  | "agent.updated"
  | "agent.deleted"
  | "agent.connection_tested"
  | "agent.api_key_rotated"
  | "credential.updated"
  | "permission.changed"
  | "user.profile_updated"
  | "user.password_changed"
  | "user.sessions_revoked"
  | "admin.organization_suspended"
  | "admin.organization_reactivated"
  | "admin.user_suspended"
  | "admin.user_reactivated"
  | "admin.user_sessions_revoked"
  | "admin.user_password_reset"
  | "admin.agent_keys_revoked"
  | "admin.inquiry_handled"
  | "admin.platform_admin_granted"
  | "admin.platform_admin_revoked"
  | "admin.login_denied";

export interface AuditEntry {
  action: AuditAction;
  organizationId?: string | null;
  actorUserId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  meta?: RequestMeta;
}

type Tx = Prisma.TransactionClient;

/** Appends an immutable audit record. Pass `tx` to make it atomic with the change. */
export async function recordAudit(entry: AuditEntry, tx: Tx = db): Promise<void> {
  await tx.auditLog.create({
    data: {
      id: newId("audit"),
      action: entry.action,
      organizationId: entry.organizationId ?? null,
      actorUserId: entry.actorUserId ?? null,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      metadata: redact(entry.metadata ?? {}) as Prisma.InputJsonValue,
      ipAddress: entry.meta?.ipAddress,
      userAgent: entry.meta?.userAgent?.slice(0, 512),
    },
  });
}
