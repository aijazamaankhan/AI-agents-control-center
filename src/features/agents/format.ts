export function relativeTime(date: Date | null, now = new Date()): string {
  if (!date) return "Never";
  const s = Math.round((now.getTime() - date.getTime()) / 1000);
  if (s < 60) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const CONNECTION_LABEL: Record<string, string> = {
  SDK: "SDK",
  REST_API: "REST API",
  WEBHOOK: "Webhook",
  MCP: "MCP",
  API_INTEGRATION: "API integration",
  CUSTOM: "Custom",
};
