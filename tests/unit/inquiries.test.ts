import { describe, expect, it } from "vitest";
import { demoRequestSchema, serviceInquirySchema } from "@/features/inquiries/schemas";
import { escapeHtml } from "@/lib/email/send";

const valid = {
  name: "Priya Sharma",
  email: "Priya@Example.com",
  service: "Web application development",
  message: "We need a customer portal with login and dashboards.",
};

describe("inquiry schemas", () => {
  it("accepts a valid service enquiry and normalizes email", () => {
    const parsed = serviceInquirySchema.parse(valid);
    expect(parsed.email).toBe("priya@example.com");
    expect(parsed.budget).toBe("");
  });

  it("requires a service and a meaningful message", () => {
    expect(serviceInquirySchema.safeParse({ ...valid, service: "Hacking" }).success).toBe(false);
    expect(serviceInquirySchema.safeParse({ ...valid, message: "hi" }).success).toBe(false);
  });

  it("rejects unknown budget/timeline values and bad phones", () => {
    expect(serviceInquirySchema.safeParse({ ...valid, budget: "$1" }).success).toBe(false);
    expect(serviceInquirySchema.safeParse({ ...valid, phone: "call me maybe" }).success).toBe(
      false,
    );
    expect(serviceInquirySchema.safeParse({ ...valid, phone: "+91 98765 43210" }).success).toBe(
      true,
    );
  });

  it("requires a company for demo requests", () => {
    expect(demoRequestSchema.safeParse({ name: "A B", email: "a@b.co" }).success).toBe(false);
    expect(
      demoRequestSchema.safeParse({ name: "A B", email: "a@b.co", company: "Acme" }).success,
    ).toBe(true);
  });
});

describe("escapeHtml", () => {
  it("neutralizes markup in user input", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;",
    );
  });
});
