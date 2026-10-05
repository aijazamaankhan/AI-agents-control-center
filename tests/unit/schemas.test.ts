import { describe, expect, it } from "vitest";
import { loginSchema, safeRedirectPath, signupSchema } from "@/features/auth/schemas";
import { organizationSchema, slugify } from "@/features/organizations/schemas";

describe("auth schemas", () => {
  it("normalizes email and enforces password length", () => {
    const ok = signupSchema.safeParse({
      name: " Ada ",
      email: " ADA@Example.COM ",
      password: "0123456789",
    });
    expect(ok.success && ok.data).toEqual({
      name: "Ada",
      email: "ada@example.com",
      password: "0123456789",
    });
    expect(
      signupSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "short" }).success,
    ).toBe(false);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  it("only allows same-site relative redirects", () => {
    expect(safeRedirectPath("/settings")).toBe("/settings");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
  });
});

describe("organization schema", () => {
  const valid = {
    name: "Acme Corporation",
    industry: "Software & Technology",
    companySize: "51-200",
    country: "IN",
    timezone: "Asia/Kolkata",
  };

  it("accepts a valid company", () => {
    expect(organizationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unknown industry, country and timezone", () => {
    expect(organizationSchema.safeParse({ ...valid, industry: "Piracy" }).success).toBe(false);
    expect(organizationSchema.safeParse({ ...valid, country: "XX" }).success).toBe(false);
    expect(organizationSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(
      false,
    );
  });

  it("strips unknown fields such as a client-supplied organization id", () => {
    const parsed = organizationSchema.parse({
      ...valid,
      id: "org_evil",
      organizationId: "org_evil",
    });
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("organizationId");
  });

  it("slugifies names", () => {
    expect(slugify("Acme Corporation, Inc.")).toBe("acme-corporation-inc");
    expect(slugify("Café Ünïcode")).toBe("cafe-unicode");
    expect(slugify("!!!")).toBe("org");
  });
});

import { changePasswordSchema } from "@/features/account/schemas";

describe("change password schema", () => {
  const ok = {
    currentPassword: "old-password-1",
    newPassword: "new-password-1",
    confirmPassword: "new-password-1",
  };
  it("accepts a valid change", () => {
    expect(changePasswordSchema.safeParse(ok).success).toBe(true);
  });
  it("requires matching confirmation, a different and long-enough password", () => {
    expect(
      changePasswordSchema.safeParse({ ...ok, confirmPassword: "nope-nope-nope" }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        ...ok,
        newPassword: "old-password-1",
        confirmPassword: "old-password-1",
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({ ...ok, newPassword: "short", confirmPassword: "short" })
        .success,
    ).toBe(false);
  });
});
