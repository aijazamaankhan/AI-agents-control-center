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
  | "permission.changed";

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
