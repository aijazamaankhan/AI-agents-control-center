import "server-only";
import { AppError } from "@/lib/api/errors";
import type { OrgContext, RequestMeta } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/security/audit";
import { decryptSecret, encryptSecret, generateApiKey, secretHint } from "@/lib/security/crypto";
import { assertPermission } from "@/lib/security/permissions";
import { Prisma } from "@/generated/prisma/client";
import type { AgentStatus } from "@/generated/prisma/enums";
import { sweepStaleAgents } from "@/features/events/server/ingest";
import { agentNameKey, credentialPayload, type AgentInput, type CapabilityInput } from "../schemas";

const DUPLICATE = "An agent with this name already exists.";
type Tx = Prisma.TransactionClient;

export const agentListSelect = {
  id: true,
  name: true,
  description: true,
  provider: true,
  model: true,
  connectionType: true,
  status: true,
  lastActiveAt: true,
  lastHeartbeatAt: true,
  connectionVerifiedAt: true,
  createdAt: true,
  department: { select: { id: true, name: true } },
} as const;

export type AgentListItem = Prisma.AgentGetPayload<{ select: typeof agentListSelect }>;

/** Detail view. Credential ciphertext is never selected — only the display hint. */
export const agentDetailSelect = {
  ...agentListSelect,
  endpointUrl: true,
  authType: true,
  authHeaderName: true,
  updatedAt: true,
  credential: { select: { hint: true, updatedAt: true } },
  capabilities: { select: { key: true, label: true, rule: true }, orderBy: { createdAt: "asc" } },
  apiKeys: {
    where: { revokedAt: null },
    select: { prefix: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  },
} as const;

export type AgentDetail = Prisma.AgentGetPayload<{ select: typeof agentDetailSelect }>;

export interface AgentFilters {
  departmentId?: string;
  status?: AgentStatus;
  q?: string;
}

const credentialContext = (organizationId: string, agentId: string) =>
  `agent-credential:${organizationId}:${agentId}`;

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function assertDepartment(ctx: OrgContext, departmentId: string, tx: Tx = db) {
  const dep = await tx.department.findFirst({
    where: { id: departmentId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!dep)
    throw new AppError("VALIDATION_ERROR", "Choose a department", {
      fieldErrors: { departmentId: ["Choose a department"] },
    });
}

export async function listAgents(
  ctx: OrgContext,
  filters: AgentFilters = {},
): Promise<AgentListItem[]> {
  await sweepStaleAgents(ctx.organizationId);
  return db.agent.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: agentListSelect,
  });
}

export async function getAgent(ctx: OrgContext, id: string): Promise<AgentDetail> {
  await sweepStaleAgents(ctx.organizationId);
  const agent = await db.agent.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: agentDetailSelect,
  });
  if (!agent) throw new AppError("RESOURCE_NOT_FOUND", "Agent not found");
  return agent;
}

export async function agentStatusCounts(ctx: OrgContext) {
  await sweepStaleAgents(ctx.organizationId);
  const rows = await db.agent.groupBy({
    by: ["status"],
    where: { organizationId: ctx.organizationId },
    _count: { _all: true },
  });
  const counts: Record<AgentStatus, number> = {
    ONLINE: 0,
    WORKING: 0,
    IDLE: 0,
    WAITING: 0,
    FAILED: 0,
    OFFLINE: 0,
    DISCONNECTED: 0,
  };
  for (const r of rows) counts[r.status] = r._count._all;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { total, ...counts };
}

export async function agentCountsByDepartment(ctx: OrgContext): Promise<Record<string, number>> {
  const rows = await db.agent.groupBy({
    by: ["departmentId"],
    where: { organizationId: ctx.organizationId },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.departmentId, r._count._all]));
}

async function writeCapabilities(
  tx: Tx,
  ctx: OrgContext,
  agentId: string,
  caps: CapabilityInput[],
) {
  await tx.agentCapability.deleteMany({ where: { agentId, organizationId: ctx.organizationId } });
  if (caps.length) {
    await tx.agentCapability.createMany({
      data: caps.map((c) => ({
        id: newId("capability"),
        organizationId: ctx.organizationId,
        agentId,
        key: c.key,
        label: c.label,
        rule: c.rule,
      })),
    });
  }
}

async function issueApiKey(tx: Tx, ctx: OrgContext, agentId: string) {
  const key = generateApiKey();
  await tx.agentApiKey.updateMany({
    where: { agentId, organizationId: ctx.organizationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await tx.agentApiKey.create({
    data: {
      id: newId("apiKey"),
      organizationId: ctx.organizationId,
      agentId,
      prefix: key.prefix,
      keyHash: key.hash,
    },
  });
  return key.key;
}

async function upsertCredential(
  tx: Tx,
  ctx: OrgContext,
  agentId: string,
  payload: string,
  hintSource: string,
) {
  const enc = encryptSecret(payload, credentialContext(ctx.organizationId, agentId));
  await tx.agentCredential.upsert({
    where: { agentId },
    create: {
      id: newId("credential"),
      organizationId: ctx.organizationId,
      agentId,
      hint: secretHint(hintSource),
      ...enc,
    },
    update: { hint: secretHint(hintSource), ...enc },
  });
}

/** Registers an agent. Returns the agent id and its ingestion API key (shown once, stored hashed). */
export async function createAgent(ctx: OrgContext, input: AgentInput, meta: RequestMeta = {}) {
  assertPermission(ctx.role, "agents:manage");
  const payload = credentialPayload(input);
  if (input.authType !== "NONE" && !payload) {
    throw new AppError("VALIDATION_ERROR", "Enter the secret for the selected authentication", {
      fieldErrors: { authSecret: ["Enter the secret for the selected authentication"] },
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      await assertDepartment(ctx, input.departmentId, tx);
      const agent = await tx.agent.create({
        data: {
          id: newId("agent"),
          organizationId: ctx.organizationId,
          departmentId: input.departmentId,
          name: input.name,
          nameKey: agentNameKey(input.name),
          description: input.description,
          provider: input.provider,
          model: input.model,
          connectionType: input.connectionType,
          endpointUrl: input.endpointUrl,
          authType: input.authType,
          authHeaderName: input.authHeaderName,
          createdById: ctx.user.id,
        },
        select: { id: true, name: true },
      });
      if (payload) await upsertCredential(tx, ctx, agent.id, payload, input.authSecret);
      await writeCapabilities(tx, ctx, agent.id, input.capabilities);
      const apiKey = await issueApiKey(tx, ctx, agent.id);
      await recordAudit(
        {
          action: "agent.created",
          organizationId: ctx.organizationId,
          actorUserId: ctx.user.id,
          resourceType: "agent",
          resourceId: agent.id,
          metadata: {
            name: agent.name,
            departmentId: input.departmentId,
            connectionType: input.connectionType,
            credentialStored: Boolean(payload),
            capabilities: input.capabilities.length,
          },
          meta,
        },
        tx,
      );
      return { id: agent.id, apiKey };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("CONFLICT", DUPLICATE);
    throw err;
  }
}

/** Updates profile + connection. An empty secret keeps the stored credential; auth "None" removes it. */
export async function updateAgent(
  ctx: OrgContext,
  id: string,
  input: AgentInput,
  meta: RequestMeta = {},
) {
  assertPermission(ctx.role, "agents:manage");
  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.agent.findFirst({
        where: { id, organizationId: ctx.organizationId },
        include: { credential: true },
      });
      if (!before) throw new AppError("RESOURCE_NOT_FOUND", "Agent not found");
      await assertDepartment(ctx, input.departmentId, tx);

      let payload = credentialPayload(input);
      // Basic auth: allow changing the username while keeping the stored password.
      if (
        !payload &&
        input.authType === "BASIC" &&
        before.authType === "BASIC" &&
        before.credential
      ) {
        const stored = JSON.parse(
          decryptSecret(before.credential, credentialContext(ctx.organizationId, id)),
        );
        payload = JSON.stringify({ username: input.authUsername, password: stored.password });
      }
      const authChanged = input.authType !== before.authType;
      if (input.authType !== "NONE" && !payload && (authChanged || !before.credential)) {
        throw new AppError("VALIDATION_ERROR", "Enter the secret for the selected authentication", {
          fieldErrors: { authSecret: ["Enter the secret for the selected authentication"] },
        });
      }

      const fields = {
        name: input.name,
        nameKey: agentNameKey(input.name),
        description: input.description,
        departmentId: input.departmentId,
        provider: input.provider,
        model: input.model,
        connectionType: input.connectionType,
        endpointUrl: input.endpointUrl,
        authType: input.authType,
        authHeaderName: input.authHeaderName,
      };
      const changed = (Object.keys(fields) as (keyof typeof fields)[]).filter(
        (k) => k !== "nameKey" && before[k] !== fields[k],
      );
      const connectionChanged = changed.some((k) =>
        ["connectionType", "endpointUrl", "authType", "authHeaderName"].includes(k),
      );

      await tx.agent.update({
        where: { id },
        data: {
          ...fields,
          ...(connectionChanged || payload ? { connectionVerifiedAt: null } : {}),
        },
      });

      let credentialChange: "replaced" | "removed" | null = null;
      if (input.authType === "NONE" && before.credential) {
        await tx.agentCredential.delete({ where: { agentId: id } });
        credentialChange = "removed";
      } else if (payload) {
        await upsertCredential(tx, ctx, id, payload, input.authSecret || input.authUsername);
        credentialChange = "replaced";
      }

      const audit = {
        organizationId: ctx.organizationId,
        actorUserId: ctx.user.id,
        resourceType: "agent",
        resourceId: id,
        meta,
      };
      if (changed.length)
        await recordAudit({ ...audit, action: "agent.updated", metadata: { changed } }, tx);
      if (credentialChange)
        await recordAudit(
          { ...audit, action: "credential.updated", metadata: { change: credentialChange } },
          tx,
        );
      return { id };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("CONFLICT", DUPLICATE);
    throw err;
  }
}

export async function setAgentCapabilities(
  ctx: OrgContext,
  id: string,
  caps: CapabilityInput[],
  meta: RequestMeta = {},
) {
  assertPermission(ctx.role, "agents:manage");
  await db.$transaction(async (tx) => {
    const agent = await tx.agent.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true, capabilities: { select: { key: true, rule: true } } },
    });
    if (!agent) throw new AppError("RESOURCE_NOT_FOUND", "Agent not found");
    const before = Object.fromEntries(agent.capabilities.map((c) => [c.key, c.rule]));
    const after = Object.fromEntries(caps.map((c) => [c.key, c.rule]));
    await writeCapabilities(tx, ctx, id, caps);
    await recordAudit(
      {
        action: "permission.changed",
        organizationId: ctx.organizationId,
        actorUserId: ctx.user.id,
        resourceType: "agent",
        resourceId: id,
        metadata: {
          added: Object.keys(after).filter((k) => !(k in before)),
          removed: Object.keys(before).filter((k) => !(k in after)),
          changed: Object.keys(after).filter((k) => k in before && before[k] !== after[k]),
        },
        meta,
      },
      tx,
    );
  });
}

export async function rotateAgentApiKey(
  ctx: OrgContext,
  id: string,
  meta: RequestMeta = {},
): Promise<string> {
  assertPermission(ctx.role, "agents:manage");
  return db.$transaction(async (tx) => {
    const agent = await tx.agent.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!agent) throw new AppError("RESOURCE_NOT_FOUND", "Agent not found");
    const key = await issueApiKey(tx, ctx, id);
    await recordAudit(
      {
        action: "agent.api_key_rotated",
        organizationId: ctx.organizationId,
        actorUserId: ctx.user.id,
        resourceType: "agent",
        resourceId: id,
        meta,
      },
      tx,
    );
    return key;
  });
}

export async function deleteAgent(ctx: OrgContext, id: string, meta: RequestMeta = {}) {
  assertPermission(ctx.role, "agents:manage");
  await db.$transaction(async (tx) => {
    const agent = await tx.agent.findFirst({ where: { id, organizationId: ctx.organizationId } });
    if (!agent) throw new AppError("RESOURCE_NOT_FOUND", "Agent not found");
    await tx.agent.delete({ where: { id } });
    await recordAudit(
      {
        action: "agent.deleted",
        organizationId: ctx.organizationId,
        actorUserId: ctx.user.id,
        resourceType: "agent",
        resourceId: id,
        metadata: { name: agent.name },
        meta,
      },
      tx,
    );
  });
}

/** Decrypted credential for server-side use only (connection tests). Never send to clients. */
export async function loadAgentSecret(
  ctx: OrgContext,
  id: string,
): Promise<{ secret?: string; username?: string } | null> {
  const cred = await db.agentCredential.findFirst({
    where: { agentId: id, organizationId: ctx.organizationId },
  });
  if (!cred) return null;
  const parsed = JSON.parse(decryptSecret(cred, credentialContext(ctx.organizationId, id)));
  return parsed.password !== undefined
    ? { username: parsed.username, secret: parsed.password }
    : { secret: parsed.secret };
}

export async function markConnectionVerified(
  ctx: OrgContext,
  id: string,
  ok: boolean,
  meta: RequestMeta = {},
) {
  await db.agent.updateMany({
    where: { id, organizationId: ctx.organizationId },
    data: { connectionVerifiedAt: ok ? new Date() : null },
  });
  await recordAudit({
    action: "agent.connection_tested",
    organizationId: ctx.organizationId,
    actorUserId: ctx.user.id,
    resourceType: "agent",
    resourceId: id,
    metadata: { ok },
    meta,
  });
}
