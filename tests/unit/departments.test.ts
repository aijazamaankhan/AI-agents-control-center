import { describe, expect, it } from "vitest";
import {
  departmentNameKey,
  departmentSchema,
  departmentUpdateSchema,
  onboardingDepartmentsSchema,
} from "@/features/departments/schemas";
import { AppError } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/security/origin";

describe("department schemas", () => {
  it("normalizes whitespace and defaults description", () => {
    expect(departmentSchema.parse({ name: "  Customer   Support " })).toEqual({
      name: "Customer Support",
      description: "",
    });
  });

  it("rejects empty and over-long names", () => {
    expect(departmentSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(departmentSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
  });

  it("requires at least one field on update", () => {
    expect(departmentUpdateSchema.safeParse({}).success).toBe(false);
    expect(departmentUpdateSchema.safeParse({ name: "Ops" }).success).toBe(true);
  });

  it("dedupes onboarding names case-insensitively and drops blanks", () => {
    expect(
      onboardingDepartmentsSchema.parse(["Sales", " sales ", "", "HR", "hr", "Inventory"]),
    ).toEqual(["Sales", "HR", "Inventory"]);
  });

  it("builds a case-insensitive key", () => {
    expect(departmentNameKey("  Customer  SUPPORT ")).toBe("customer support");
  });
});

describe("assertSameOrigin", () => {
  const req = (origin?: string) =>
    new Request("http://localhost:3000/api/v1/departments", {
      method: "POST",
      headers: origin ? { origin } : {},
    });

  it("allows same-origin requests", () => {
    expect(() => assertSameOrigin(req("http://localhost:3000"))).not.toThrow();
  });

  it("blocks missing and foreign origins", () => {
    expect(() => assertSameOrigin(req())).toThrow(AppError);
    expect(() => assertSameOrigin(req("https://evil.example"))).toThrow(/Cross-site/);
  });
});

describe("department update schema", () => {
  it("leaves an omitted description untouched", () => {
    expect(departmentUpdateSchema.parse({ name: "Ops" })).toEqual({ name: "Ops" });
  });
});
