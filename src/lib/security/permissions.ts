import { AppError } from "@/lib/api/errors";
import type { Role } from "@/generated/prisma/enums";

export const ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "MEMBER",
  "VIEWER",
] as const satisfies readonly Role[];

/** Source of truth: docs/SECURITY.md §3. Keep both in sync. */
const MATRIX = {
  "org:read": ["OWNER", "ADMIN", "MANAGER", "MEMBER", "VIEWER"],
  "org:update": ["OWNER", "ADMIN"],
  "org:billing": ["OWNER"],
  "org:security": ["OWNER"],
  "org:delete": ["OWNER"],
  "members:manage": ["OWNER", "ADMIN"],
  "departments:manage": ["OWNER", "ADMIN"],
  "agents:manage": ["OWNER", "ADMIN"],
  "integrations:manage": ["OWNER", "ADMIN"],
  "budgets:manage": ["OWNER"],
  "approvals:decide": ["OWNER", "ADMIN", "MANAGER"],
  "analytics:read": ["OWNER", "ADMIN", "MANAGER"],
  "audit:read": ["OWNER", "ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof MATRIX;

export function can(role: Role, permission: Permission): boolean {
  return (MATRIX[permission] as readonly Role[]).includes(role);
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new AppError("FORBIDDEN", "You do not have permission to perform this action.");
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
  VIEWER: "Viewer",
};
