import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  submitDemoRequest,
  submitServiceInquiry,
} from "@/features/inquiries/server/inquiry-service";
import { serviceInquirySchema } from "@/features/inquiries/schemas";
import { db } from "@/lib/db/client";

const ip = () => `10.0.${randomBytes(1)[0]}.${randomBytes(1)[0]}-${randomBytes(4).toString("hex")}`;

const input = serviceInquirySchema.parse({
  name: "Priya <b>Sharma</b>",
  email: "priya@example.com",
  service: "AI agents & automation",
  budget: "$5,000 – $15,000",
  message: "Please build agents for our support team <script>alert(1)</script>.",
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EMAIL_PROVIDER_API_KEY;
});

describe("inquiries", () => {
  it("stores the request even when email is not configured", async () => {
    const res = await submitServiceInquiry(input, { ipAddress: ip() });
    const row = await db.inquiry.findUniqueOrThrow({ where: { id: res.id! } });
    expect(row).toMatchObject({
      type: "SERVICE",
      email: "priya@example.com",
      emailDelivered: false,
      emailError: "not_configured",
    });
  });

  it("emails velorexdesign@gmail.com with reply-to and escaped HTML", async () => {
    process.env.EMAIL_PROVIDER_API_KEY = "re_test";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitServiceInquiry(input, { ipAddress: ip() });
    expect(res.delivered).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["velorexdesign@gmail.com"]);
    expect(body.reply_to).toBe("priya@example.com");
    expect(body.subject).toContain("AI agents & automation");
    expect(body.html).not.toContain("<script>");
    expect(body.html).toContain("&lt;script&gt;");
    expect((await db.inquiry.findUniqueOrThrow({ where: { id: res.id! } })).emailDelivered).toBe(
      true,
    );
  });

  it("records provider failures without losing the request", async () => {
    process.env.EMAIL_PROVIDER_API_KEY = "re_test";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 403 })));
    const res = await submitDemoRequest(
      {
        name: "Sam Lee",
        email: "sam@acme.io",
        company: "Acme",
        phone: "",
        teamSize: "11 – 50",
        message: "",
      },
      { ipAddress: ip() },
    );
    expect(res.delivered).toBe(false);
    expect(await db.inquiry.findUniqueOrThrow({ where: { id: res.id! } })).toMatchObject({
      type: "DEMO",
      emailError: "provider_403",
    });
  });

  it("silently drops honeypot submissions", async () => {
    const before = await db.inquiry.count();
    const res = await submitServiceInquiry(
      { ...input, website: "http://spam.example" },
      { ipAddress: ip() },
    );
    expect(res.id).toBeNull();
    expect(await db.inquiry.count()).toBe(before);
  });

  it("rate limits per IP", async () => {
    const addr = ip();
    for (let i = 0; i < 5; i++) await submitServiceInquiry(input, { ipAddress: addr });
    await expect(submitServiceInquiry(input, { ipAddress: addr })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
