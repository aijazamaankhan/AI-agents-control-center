import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  agentSchema,
  capabilitiesSchema,
  capabilityKey,
  connectionSchema,
  credentialPayload,
} from "@/features/agents/schemas";
import { authHeaders, interpretStatus } from "@/features/agents/server/connection-test";
import { runtimeStatus } from "@/features/dashboard/server/dashboard-service";
import { AppError } from "@/lib/api/errors";
import {
  decryptSecret,
  encryptSecret,
  generateApiKey,
  hashApiKey,
  secretHint,
} from "@/lib/security/crypto";
import { assertPublicHttpUrl, isBlockedIp } from "@/lib/security/outbound";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("credential encryption", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("round-trips and never contains the plaintext", () => {
    const enc = encryptSecret('{"secret":"sk-live-123456"}', "org_a:agt_a");
    expect(enc.ciphertext).not.toContain("sk-live");
    expect(decryptSecret(enc, "org_a:agt_a")).toBe('{"secret":"sk-live-123456"}');
  });

  it("uses a fresh IV every time", () => {
    expect(encryptSecret("x", "c").iv).not.toBe(encryptSecret("x", "c").iv);
  });

  it("refuses to decrypt under another tenant/agent context (AAD) or when tampered", () => {
    const enc = encryptSecret("secret", "org_a:agt_a");
    expect(() => decryptSecret(enc, "org_b:agt_a")).toThrow();
    const tampered = { ...enc, ciphertext: Buffer.from("garbage!").toString("base64") };
    expect(() => decryptSecret(tampered, "org_a:agt_a")).toThrow();
  });

  it("fails with a clear configuration error when the key is missing or wrong length", () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("x", "c")).toThrow(AppError);
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret("x", "c")).toThrow(/ENCRYPTION_KEY/);
  });

  it("shows at most the last 4 characters", () => {
    expect(secretHint("sk-live-abcdef1234")).toBe("••••1234");
    expect(secretHint("short")).toBe("••••");
  });
});

describe("API keys", () => {
  it("are prefixed, high-entropy and hashed deterministically", () => {
    const k = generateApiKey();
    expect(k.key).toMatch(/^aos_live_[A-Za-z0-9_-]{43}$/);
    expect(k.prefix).toBe(k.key.slice(0, 15));
    expect(k.hash).toBe(hashApiKey(k.key));
    expect(k.hash).not.toContain(k.key);
    expect(generateApiKey().key).not.toBe(k.key);
  });
});

describe("SSRF guard", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.5.4",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"])("allows public %s", (ip) =>
    expect(isBlockedIp(ip)).toBe(false),
  );

  it("rejects private literal hosts, credentials in URLs and non-http schemes", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1:8080/")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(assertPublicHttpUrl("http://[::1]/")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(assertPublicHttpUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      /private or local/,
    );
    await expect(assertPublicHttpUrl("https://user:pass@example.com")).rejects.toThrow(
      /credentials/,
    );
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toThrow(/http/);
  });

  it("allows private endpoints only when explicitly enabled", async () => {
    process.env.ALLOW_PRIVATE_AGENT_ENDPOINTS = "true";
    await expect(assertPublicHttpUrl("http://127.0.0.1:8080/")).resolves.toBeInstanceOf(URL);
    delete process.env.ALLOW_PRIVATE_AGENT_ENDPOINTS;
  });
});

describe("agent schemas", () => {
  const base = {
    name: "  Lead   Research Agent ",
    departmentId: "dep_x",
    provider: "Anthropic",
    model: "Claude Sonnet",
    connectionType: "SDK",
  };

  it("normalizes names and defaults auth for SDK agents", () => {
    const parsed = agentSchema.parse(base);
    expect(parsed.name).toBe("Lead Research Agent");
    expect(parsed.endpointUrl).toBeNull();
    expect(parsed.authType).toBe("NONE");
    expect(parsed.capabilities).toEqual([]);
  });

  it("requires an endpoint for REST, webhook, MCP and API agents", () => {
    for (const connectionType of ["REST_API", "WEBHOOK", "MCP", "API_INTEGRATION"]) {
      expect(agentSchema.safeParse({ ...base, connectionType }).success).toBe(false);
    }
    expect(agentSchema.safeParse({ ...base, connectionType: "CUSTOM" }).success).toBe(true);
    expect(
      agentSchema.safeParse({ ...base, connectionType: "WEBHOOK", endpointUrl: "ftp://x.example" })
        .success,
    ).toBe(false);
  });

  it("validates auth fields", () => {
    const rest = { connectionType: "REST_API", endpointUrl: "https://agents.example.com" };
    expect(connectionSchema.parse({ ...rest, authType: "API_KEY" }).authHeaderName).toBe(
      "X-API-Key",
    );
    expect(
      connectionSchema.safeParse({ ...rest, authType: "API_KEY", authHeaderName: "Bad Header!" })
        .success,
    ).toBe(false);
    expect(connectionSchema.safeParse({ ...rest, authType: "BASIC" }).success).toBe(false);
    expect(
      connectionSchema.parse({ ...rest, authType: "NONE", authHeaderName: "X" }).authHeaderName,
    ).toBeNull();
  });

  it("parses, keys and dedupes capabilities from JSON", () => {
    const caps = capabilitiesSchema.parse(
      JSON.stringify([
        { label: "Send external email", rule: "APPROVAL_REQUIRED" },
        { label: "send  EXTERNAL email", rule: "ALLOWED" },
        { label: "Make payments", rule: "DENIED" },
      ]),
    );
    expect(caps).toEqual([
      { label: "Send external email", rule: "APPROVAL_REQUIRED", key: "send_external_email" },
      { label: "Make payments", rule: "DENIED", key: "make_payments" },
    ]);
    expect(capabilitiesSchema.safeParse("{not json").success).toBe(false);
    expect(
      capabilitiesSchema.safeParse(JSON.stringify([{ label: "x", rule: "MAYBE" }])).success,
    ).toBe(false);
    expect(capabilityKey("Café — Ops!")).toBe("cafe_ops");
  });

  it("builds credential payloads per auth type", () => {
    expect(credentialPayload({ authType: "NONE", authUsername: "", authSecret: "x" })).toBeNull();
    expect(
      credentialPayload({ authType: "BEARER_TOKEN", authUsername: "", authSecret: "" }),
    ).toBeNull();
    expect(
      JSON.parse(credentialPayload({ authType: "BASIC", authUsername: "u", authSecret: "p" })!),
    ).toEqual({
      username: "u",
      password: "p",
    });
  });
});

describe("connection test helpers", () => {
  it("interprets HTTP statuses", () => {
    expect(interpretStatus(200).ok).toBe(true);
    expect(interpretStatus(405).ok).toBe(true); // POST-only webhook
    expect(interpretStatus(401)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/credentials/),
    });
    expect(interpretStatus(404).ok).toBe(false);
    expect(interpretStatus(503).ok).toBe(false);
  });

  it("builds auth headers without leaking when no secret", () => {
    expect(
      authHeaders(
        { authType: "API_KEY", authHeaderName: "X-Key", authUsername: "" },
        { secret: "k" },
      ),
    ).toEqual({ "X-Key": "k" });
    expect(
      authHeaders(
        { authType: "BEARER_TOKEN", authHeaderName: null, authUsername: "" },
        { secret: "t" },
      ),
    ).toEqual({
      Authorization: "Bearer t",
    });
    expect(
      authHeaders({ authType: "BASIC", authHeaderName: null, authUsername: "u" }, { secret: "p" })
        .Authorization,
    ).toBe(`Basic ${Buffer.from("u:p").toString("base64")}`);
    expect(
      authHeaders({ authType: "BEARER_TOKEN", authHeaderName: null, authUsername: "" }, null),
    ).toEqual({});
  });

  it("maps stored statuses onto map states", () => {
    expect(runtimeStatus("ONLINE")).toBe("IDLE");
    expect(runtimeStatus("DISCONNECTED")).toBe("OFFLINE");
    expect(runtimeStatus("WORKING")).toBe("WORKING");
  });
});
