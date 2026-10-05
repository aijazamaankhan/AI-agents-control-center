import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/api/errors";
import { assertPermission, can, ROLES } from "@/lib/security/permissions";

describe("permissions", () => {
  it("lets every role read the organization", () => {
    for (const role of ROLES) expect(can(role, "org:read")).toBe(true);
  });

  it("restricts organization updates to OWNER and ADMIN", () => {
    expect(ROLES.filter((r) => can(r, "org:update"))).toEqual(["OWNER", "ADMIN"]);
  });

  it("reserves billing, security and budgets for OWNER", () => {
    for (const p of ["org:billing", "org:security", "org:delete", "budgets:manage"] as const) {
      expect(ROLES.filter((r) => can(r, p))).toEqual(["OWNER"]);
    }
  });

  it("keeps VIEWER read-only", () => {
    expect(can("VIEWER", "approvals:decide")).toBe(false);
    expect(can("VIEWER", "agents:manage")).toBe(false);
  });

  it("throws FORBIDDEN when denied", () => {
    expect(() => assertPermission("MEMBER", "org:update")).toThrow(AppError);
    try {
      assertPermission("VIEWER", "members:manage");
    } catch (e) {
      expect((e as AppError).code).toBe("FORBIDDEN");
      expect((e as AppError).status).toBe(403);
    }
  });
});
