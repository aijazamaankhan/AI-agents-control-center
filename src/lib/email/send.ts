import "server-only";
import { logger } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export type SendResult = { delivered: true } | { delivered: false; reason: string };

/**
 * Sends email through Resend's HTTP API (no SDK dependency). Without
 * EMAIL_PROVIDER_API_KEY nothing is sent and the caller keeps the stored record —
 * see docs/ENV.md for setup.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  if (!apiKey) {
    logger.warn("Email not sent: EMAIL_PROVIDER_API_KEY is not configured", {
      subject: message.subject,
    });
    return { delivered: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "AgentOS <onboarding@resend.dev>",
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      logger.error("Email provider rejected message", { status: res.status, detail });
      return { delivered: false, reason: `provider_${res.status}` };
    }
    return { delivered: true };
  } catch (error) {
    logger.error("Email delivery failed", { error });
    return { delivered: false, reason: "network_error" };
  }
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
