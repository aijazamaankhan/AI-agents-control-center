import "server-only";
import { STUDIO } from "@/config/site";
import { AppError } from "@/lib/api/errors";
import type { RequestMeta } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { escapeHtml, sendEmail } from "@/lib/email/send";
import { newId } from "@/lib/ids";
import { rateLimiter } from "@/lib/security/rate-limit";
import type { DemoRequestInput, ServiceInquiryInput } from "../schemas";

export const INQUIRY_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 } as const;

export function inquiryRecipient(): string {
  return process.env.INQUIRY_TO_EMAIL || STUDIO.email;
}

type Row = [label: string, value: string];

function render(title: string, rows: Row[], message: string) {
  const filled = rows.filter(([, v]) => v);
  const text = [title, "", ...filled.map(([k, v]) => `${k}: ${v}`), "", message].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111">
<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
<table cellpadding="6" style="border-collapse:collapse">${filled
    .map(
      ([k, v]) =>
        `<tr><td style="color:#666">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`,
    )
    .join("")}</table>
${message ? `<p style="white-space:pre-wrap;border-left:3px solid #3cf08a;padding-left:12px">${escapeHtml(message)}</p>` : ""}
</div>`;
  return { text, html };
}

async function guard(meta: RequestMeta, honeypot?: string) {
  if (honeypot) return false; // silently drop bots
  const key = `inquiry:${meta.ipAddress ?? "unknown"}`;
  const res = await rateLimiter.hit(key, INQUIRY_LIMIT.limit, INQUIRY_LIMIT.windowMs);
  if (!res.ok)
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Please try again later or email us directly.",
    );
  return true;
}

/** Saves the request first, then emails it. Returns whether email delivery succeeded. */
async function persistAndSend(
  data: Omit<Parameters<typeof db.inquiry.create>[0]["data"], "id">,
  subject: string,
  rendered: { text: string; html: string },
  meta: RequestMeta,
) {
  const inquiry = await db.inquiry.create({
    data: {
      ...data,
      id: newId("inquiry"),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent?.slice(0, 512),
    },
  });
  const result = await sendEmail({
    to: inquiryRecipient(),
    subject,
    replyTo: data.email,
    ...rendered,
  });
  await db.inquiry.update({
    where: { id: inquiry.id },
    data: result.delivered ? { emailDelivered: true } : { emailError: result.reason },
  });
  return { id: inquiry.id, delivered: result.delivered };
}

const oneLine = (v: string) => v.replace(/[\r\n]+/g, " ").slice(0, 80);

export async function submitServiceInquiry(input: ServiceInquiryInput, meta: RequestMeta = {}) {
  if (!(await guard(meta, input.website))) return { id: null, delivered: false };
  const rows: Row[] = [
    ["Name", input.name],
    ["Email", input.email],
    ["Company", input.company],
    ["Phone", input.phone],
    ["Service", input.service],
    ["Budget", input.budget],
    ["Timeline", input.timeline],
  ];
  return persistAndSend(
    {
      type: "SERVICE",
      name: input.name,
      email: input.email,
      company: input.company,
      phone: input.phone,
      service: input.service,
      budget: input.budget,
      timeline: input.timeline,
      message: input.message,
    },
    `New ${STUDIO.name} enquiry: ${input.service} — ${oneLine(input.name)}`,
    render(`New ${STUDIO.name} project enquiry`, rows, input.message),
    meta,
  );
}

export async function submitDemoRequest(input: DemoRequestInput, meta: RequestMeta = {}) {
  if (!(await guard(meta, input.website))) return { id: null, delivered: false };
  const rows: Row[] = [
    ["Name", input.name],
    ["Email", input.email],
    ["Company", input.company],
    ["Phone", input.phone],
    ["Team size", input.teamSize],
  ];
  return persistAndSend(
    {
      type: "DEMO",
      name: input.name,
      email: input.email,
      company: input.company,
      phone: input.phone,
      teamSize: input.teamSize,
      message: input.message,
    },
    `AgentOS demo request — ${oneLine(input.company)} (${oneLine(input.name)})`,
    render("New AgentOS demo request", rows, input.message),
    meta,
  );
}
