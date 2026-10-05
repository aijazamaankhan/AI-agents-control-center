import { z } from "zod";
import type { CapabilityRule, ConnectionType, EndpointAuthType } from "@/generated/prisma/enums";

export const PROVIDERS = [
  "Anthropic",
  "OpenAI",
  "Google",
  "OpenAI-compatible",
  "Mistral",
  "Meta",
  "Custom",
] as const;

export const MODEL_SUGGESTIONS: Record<(typeof PROVIDERS)[number], string[]> = {
  Anthropic: ["Claude Opus", "Claude Sonnet", "Claude Haiku"],
  OpenAI: ["GPT-5", "GPT-5 mini", "GPT-4.1", "o3"],
  Google: ["Gemini Pro", "Gemini Flash"],
  "OpenAI-compatible": ["Llama 70B", "Qwen", "DeepSeek"],
  Mistral: ["Mistral Large", "Mistral Small"],
  Meta: ["Llama 70B", "Llama 8B"],
  Custom: [],
};

export const CONNECTION_TYPES: {
  value: ConnectionType;
  label: string;
  description: string;
  endpoint: "required" | "optional" | "none";
}[] = [
  {
    value: "SDK",
    label: "SDK",
    description: "Agent reports events with the AgentOS SDK.",
    endpoint: "none",
  },
  {
    value: "REST_API",
    label: "REST API",
    description: "AgentOS calls your agent's HTTP API.",
    endpoint: "required",
  },
  {
    value: "WEBHOOK",
    label: "Webhook",
    description: "Your agent receives and sends webhooks.",
    endpoint: "required",
  },
  {
    value: "MCP",
    label: "MCP",
    description: "Model Context Protocol server.",
    endpoint: "required",
  },
  {
    value: "API_INTEGRATION",
    label: "API integration",
    description: "A platform API (n8n, LangGraph Cloud…).",
    endpoint: "required",
  },
  {
    value: "CUSTOM",
    label: "Custom",
    description: "Anything else — events via the Event API.",
    endpoint: "optional",
  },
];

export const AUTH_TYPES: { value: EndpointAuthType; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "API_KEY", label: "API key header" },
  { value: "BEARER_TOKEN", label: "Bearer token" },
  { value: "BASIC", label: "Basic (username + password)" },
];

export const CAPABILITY_RULES: { value: CapabilityRule; label: string }[] = [
  { value: "ALLOWED", label: "Allowed" },
  { value: "APPROVAL_REQUIRED", label: "Needs approval" },
  { value: "DENIED", label: "Not allowed" },
];

export const CAPABILITY_PRESETS: { label: string; rule: CapabilityRule }[] = [
  { label: "Web research", rule: "ALLOWED" },
  { label: "Read CRM", rule: "ALLOWED" },
  { label: "Create leads", rule: "ALLOWED" },
  { label: "Lead qualification", rule: "ALLOWED" },
  { label: "Data enrichment", rule: "ALLOWED" },
  { label: "Send external email", rule: "APPROVAL_REQUIRED" },
  { label: "Publish content", rule: "APPROVAL_REQUIRED" },
  { label: "Modify customer records", rule: "APPROVAL_REQUIRED" },
  { label: "Issue refund", rule: "APPROVAL_REQUIRED" },
  { label: "Make payments", rule: "DENIED" },
  { label: "Delete CRM records", rule: "DENIED" },
];

export const MAX_CAPABILITIES = 50;

export function capabilityKey(label: string): string {
  return (
    label
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "capability"
  );
}

export function agentNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const capabilitySchema = z.object({
  label: z.string().trim().min(1, "Name the capability").max(80, "Use at most 80 characters"),
  rule: z.enum(["ALLOWED", "DENIED", "APPROVAL_REQUIRED"]),
});

/** Capabilities arrive as a JSON string from the form; dedupe by derived key. */
export const capabilitiesSchema = z
  .string()
  .optional()
  .transform((raw, ctx) => {
    if (!raw) return [];
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid capabilities" });
      return z.NEVER;
    }
  })
  .pipe(
    z.array(capabilitySchema).max(MAX_CAPABILITIES, `Add at most ${MAX_CAPABILITIES} capabilities`),
  )
  .transform((caps) => {
    const seen = new Set<string>();
    return caps
      .map((c) => ({ ...c, key: capabilityKey(c.label) }))
      .filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
  });

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .pipe(z.string().max(max, `Use at most ${max} characters`));

const HEADER_NAME = /^[A-Za-z0-9-]{1,64}$/;

/** Connection + authentication fields shared by create, edit and "Test connection". */
export const connectionSchema = z
  .object({
    connectionType: z.enum(["SDK", "REST_API", "WEBHOOK", "MCP", "API_INTEGRATION", "CUSTOM"], {
      error: "Choose a connection type",
    }),
    endpointUrl: optionalText(2048),
    authType: z.enum(["NONE", "API_KEY", "BEARER_TOKEN", "BASIC"]).default("NONE"),
    authHeaderName: optionalText(64),
    authUsername: optionalText(256),
    /** API key, bearer token or password. Empty on edit = keep the stored secret. */
    authSecret: z.string().max(4096, "Secret is too long").optional().default(""),
  })
  .superRefine((v, ctx) => {
    const type = CONNECTION_TYPES.find((t) => t.value === v.connectionType)!;
    if (type.endpoint === "required" && !v.endpointUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["endpointUrl"],
        message: `${type.label} agents need an endpoint URL`,
      });
    }
    if (v.endpointUrl) {
      try {
        const u = new URL(v.endpointUrl);
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      } catch {
        ctx.addIssue({
          code: "custom",
          path: ["endpointUrl"],
          message: "Enter a full http(s):// URL",
        });
      }
    }
    if (v.authType === "API_KEY" && !HEADER_NAME.test(v.authHeaderName || "X-API-Key")) {
      ctx.addIssue({
        code: "custom",
        path: ["authHeaderName"],
        message: "Use letters, digits and dashes only",
      });
    }
    if (v.authType === "BASIC" && !v.authUsername) {
      ctx.addIssue({ code: "custom", path: ["authUsername"], message: "Enter the username" });
    }
  })
  .transform((v) => ({
    ...v,
    endpointUrl: v.endpointUrl || null,
    authHeaderName: v.authType === "API_KEY" ? v.authHeaderName || "X-API-Key" : null,
  }));

export const agentSchema = z
  .object({
    name: z
      .string()
      .transform((v) => v.trim().replace(/\s+/g, " "))
      .pipe(z.string().min(2, "Enter an agent name").max(80, "Use at most 80 characters")),
    description: optionalText(500),
    departmentId: z.string().min(1, "Choose a department"),
    provider: z.enum(PROVIDERS, { error: "Choose a provider" }),
    model: z.string().trim().min(1, "Enter the model").max(80, "Use at most 80 characters"),
    capabilities: capabilitiesSchema,
  })
  .and(connectionSchema);

export type AgentInput = z.infer<typeof agentSchema>;
export type ConnectionInput = z.infer<typeof connectionSchema>;
export type CapabilityInput = z.infer<typeof capabilitiesSchema>[number];

/** Secret payload encrypted at rest — shape depends on auth type. */
export function credentialPayload(
  input: Pick<ConnectionInput, "authType" | "authUsername" | "authSecret">,
): string | null {
  if (input.authType === "NONE" || !input.authSecret) return null;
  return JSON.stringify(
    input.authType === "BASIC"
      ? { username: input.authUsername, password: input.authSecret }
      : { secret: input.authSecret },
  );
}
