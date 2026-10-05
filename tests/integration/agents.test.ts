import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentSchema } from "@/features/agents/schemas";
import {
  agentStatusCounts,
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  loadAgentSecret,
  rotateAgentApiKey,
  setAgentCapabilities,
  updateAgent,
} from "@/features/agents/server/agent-service";
import { testConnection } from "@/features/agents/server/connection-test";
import {
  createDepartment,
  deleteDepartment,
} from "@/features/departments/server/department-service";
import { db } from "@/lib/db/client";
import { hasPrefix } from "@/lib/ids";
import { hashApiKey } from "@/lib/security/crypto";
import { createTenant } from "../support/factories";

async function tenantWithDepartment(name = "Acme") {
  const t = await createTenant(name);
  const dep = await createDepartment(t.ctx, { name: "Sales", description: "" });
  return { ...t, dep };
}

const input = (departmentId: string, extra: Record<string, unknown> = {}) =>
  agentSchema.parse({
    name: "Lead Research Agent",
    departmentId,
    provider: "Anthropic",
    model: "Claude Sonnet",
    connectionType: "REST_API",
    endpointUrl: "https://agents.example.com/lead",
    authType: "BEARER_TOKEN",
    authSecret: "tok_super_secret_9876",
    capabilities: JSON.stringify([
      { label: "Web research", rule: "ALLOWED" },
      { label: "Send external email", rule: "APPROVAL_REQUIRED" },
    ]),
    ...extra,
  });

describe("agents", () => {
  it("registers an agent with encrypted credential, hashed API key, capabilities and audit", async () => {
    const { ctx, dep } = await tenantWithDepartment();
    const { id, apiKey } = await createAgent(ctx, input(dep.id));
    expect(hasPrefix(id, "agent")).toBe(true);
    expect(apiKey).toMatch(/^aos_live_/);

    const cred = await db.agentCredential.findUniqueOrThrow({ where: { agentId: id } });
    expect(cred.ciphertext).not.toContain("tok_super_secret");
    expect(cred.hint).toBe("••••9876");
    expect(await loadAgentSecret(ctx, id)).toEqual({ secret: "tok_super_secret_9876" });

    const key = await db.agentApiKey.findFirstOrThrow({ where: { agentId: id } });
    expect(key.keyHash).toBe(hashApiKey(apiKey));
    expect(JSON.stringify(key)).not.toContain(apiKey);

    const agent = await getAgent(ctx, id);
    expect(agent).toMatchObject({
      status: "OFFLINE",
      department: { id: dep.id },
      credential: { hint: "••••9876" },
    });
    expect(JSON.stringify(agent)).not.toMatch(/ciphertext|tok_super_secret/);
    expect(agent.capabilities.map((c) => [c.key, c.rule])).toEqual([
      ["web_research", "ALLOWED"],
      ["send_external_email", "APPROVAL_REQUIRED"],
    ]);

    const audit = await db.auditLog.findFirstOrThrow({
      where: { resourceId: id, action: "agent.created" },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain("tok_super_secret");
    expect(await agentStatusCounts(ctx)).toMatchObject({ total: 1, OFFLINE: 1 });
  });

  it("enforces unique names per org and requires a secret for authenticated endpoints", async () => {
    const { ctx, dep } = await tenantWithDepartment();
    await createAgent(ctx, input(dep.id));
    await expect(
      createAgent(ctx, input(dep.id, { name: "lead research AGENT" })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      createAgent(ctx, input(dep.id, { name: "Other", authSecret: "" })),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("keeps the stored secret on edit when left blank, replaces or removes it otherwise", async () => {
    const { ctx, dep } = await tenantWithDepartment();
    const { id } = await createAgent(ctx, input(dep.id));

    await updateAgent(ctx, id, input(dep.id, { model: "Claude Opus", authSecret: "" }));
    expect(await loadAgentSecret(ctx, id)).toEqual({ secret: "tok_super_secret_9876" });

    await updateAgent(ctx, id, input(dep.id, { authSecret: "tok_rotated_1111" }));
    expect(await loadAgentSecret(ctx, id)).toEqual({ secret: "tok_rotated_1111" });

    await updateAgent(
      ctx,
      id,
      input(dep.id, { authType: "BASIC", authUsername: "bot", authSecret: "pw-1" }),
    );
    await updateAgent(
      ctx,
      id,
      input(dep.id, { authType: "BASIC", authUsername: "bot2", authSecret: "" }),
    );
    expect(await loadAgentSecret(ctx, id)).toEqual({ username: "bot2", secret: "pw-1" });

    await updateAgent(ctx, id, input(dep.id, { authType: "NONE", authSecret: "" }));
    expect(await db.agentCredential.findUnique({ where: { agentId: id } })).toBeNull();

    const actions = (await db.auditLog.findMany({ where: { resourceId: id } })).map(
      (a) => a.action,
    );
    expect(actions).toEqual(expect.arrayContaining(["agent.updated", "credential.updated"]));
  });

  it("rotates API keys, revoking the previous one", async () => {
    const { ctx, dep } = await tenantWithDepartment();
    const { id, apiKey } = await createAgent(ctx, input(dep.id));
    const next = await rotateAgentApiKey(ctx, id);
    expect(next).not.toBe(apiKey);
    const keys = await db.agentApiKey.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "asc" },
    });
    expect(keys).toHaveLength(2);
    expect(keys[0]!.revokedAt).not.toBeNull();
    expect(keys[1]!.revokedAt).toBeNull();
    expect(keys[1]!.keyHash).toBe(hashApiKey(next));
  });

  it("audits permission changes as a diff", async () => {
    const { ctx, dep } = await tenantWithDepartment();
    const { id } = await createAgent(ctx, input(dep.id));
    await setAgentCapabilities(ctx, id, [
      { label: "Web research", rule: "DENIED", key: "web_research" },
      { label: "Make payments", rule: "DENIED", key: "make_payments" },
    ]);
    const audit = await db.auditLog.findFirstOrThrow({
      where: { resourceId: id, action: "permission.changed" },
    });
    expect(audit.metadata).toEqual({
      added: ["make_payments"],
      removed: ["send_external_email"],
      changed: ["web_research"],
    });
  });

  it("blocks deleting a department that still has agents", async () => {
    const { ctx, dep } = await tenantWithDepartment();
    const { id } = await createAgent(ctx, input(dep.id));
    await expect(deleteDepartment(ctx, dep.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await deleteAgent(ctx, id);
    await expect(deleteDepartment(ctx, dep.id)).resolves.toBeUndefined();
    expect(await db.agentApiKey.count({ where: { agentId: id } })).toBe(0); // cascaded
  });

  it("only lets OWNER and ADMIN manage agents; everyone can read", async () => {
    const { ctx, dep } = await tenantWithDepartment();
    const { id } = await createAgent({ ...ctx, role: "ADMIN" }, input(dep.id));
    for (const role of ["MANAGER", "MEMBER", "VIEWER"] as const) {
      const as = { ...ctx, role };
      await expect(createAgent(as, input(dep.id, { name: `X ${role}` }))).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(updateAgent(as, id, input(dep.id))).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(rotateAgentApiKey(as, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(deleteAgent(as, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await getAgent(as, id)).name).toBe("Lead Research Agent");
    }
  });

  it("isolates tenants: foreign agents are 404 and foreign departments can't be used", async () => {
    const a = await tenantWithDepartment("Company A");
    const b = await tenantWithDepartment("Company B");
    const { id } = await createAgent(b.ctx, input(b.dep.id));

    expect(await listAgents(a.ctx)).toEqual([]);
    await expect(getAgent(a.ctx, id)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    await expect(updateAgent(a.ctx, id, input(a.dep.id))).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
    await expect(rotateAgentApiKey(a.ctx, id)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
    await expect(deleteAgent(a.ctx, id)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(await loadAgentSecret(a.ctx, id)).toBeNull();
    // A's agent can't be attached to B's department.
    await expect(createAgent(a.ctx, input(b.dep.id))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("test connection", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/secure") {
        res.writeHead(req.headers.authorization === "Bearer good-token" ? 200 : 401).end();
      } else if (req.url === "/webhook") {
        res.writeHead(405).end();
      } else res.writeHead(404).end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.close();
    delete process.env.ALLOW_PRIVATE_AGENT_ENDPOINTS;
  });

  const conn = (endpointUrl: string | null, authType: "NONE" | "BEARER_TOKEN" = "NONE") => ({
    connectionType: "REST_API" as const,
    endpointUrl,
    authType,
    authHeaderName: null,
    authUsername: "",
  });

  it("blocks private endpoints by default (SSRF)", async () => {
    const { ctx } = await createTenant();
    await expect(testConnection(ctx, conn(`${base}/secure`), null)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("reports success, auth failure and POST-only webhooks when private endpoints are allowed", async () => {
    process.env.ALLOW_PRIVATE_AGENT_ENDPOINTS = "true";
    const { ctx } = await createTenant();
    expect(
      await testConnection(ctx, conn(`${base}/secure`, "BEARER_TOKEN"), { secret: "good-token" }),
    ).toMatchObject({
      ok: true,
      status: 200,
    });
    expect(
      await testConnection(ctx, conn(`${base}/secure`, "BEARER_TOKEN"), { secret: "bad" }),
    ).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(await testConnection(ctx, conn(`${base}/webhook`), null)).toMatchObject({
      ok: true,
      status: 405,
    });
    expect((await testConnection(ctx, conn(null), null)).ok).toBe(true); // SDK: nothing to call
  });

  it("is forbidden for read-only roles", async () => {
    const { ctx } = await createTenant();
    await expect(
      testConnection({ ...ctx, role: "VIEWER" }, conn("https://example.com"), null),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
