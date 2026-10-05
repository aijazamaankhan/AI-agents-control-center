import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as postEvent } from "@/app/api/agent-events/route";
import { agentSchema } from "@/features/agents/schemas";
import { createAgent } from "@/features/agents/server/agent-service";
import { signUp } from "@/features/auth/server/auth-service";
import { createDepartment } from "@/features/departments/server/department-service";
import { addPriceSchema } from "@/features/usage/schemas";
import { addPrice } from "@/features/usage/server/pricing-service";
import { getUsageReport, usageToday } from "@/features/usage/server/usage-service";
import { resolveSessionToken, type ResolvedSession } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { createTenant, uniqueEmail } from "../support/factories";

// The price list is platform-wide, so every test uses its own model name.
const uniqueModel = () => `Test Model ${randomBytes(4).toString("hex")}`;

async function makeAdmin(isPlatformAdmin = true): Promise<ResolvedSession> {
  const { userId, token } = await signUp({
    name: "Velorex Admin",
    email: uniqueEmail("admin"),
    password: "admin-password-1",
  });
  if (isPlatformAdmin) await db.user.update({ where: { id: userId }, data: { isPlatformAdmin } });
  return (await resolveSessionToken(token))!;
}

async function setup(name = "Acme") {
  const t = await createTenant(name);
  const dep = await createDepartment(t.ctx, { name: "Sales", description: "" });
  const { id, apiKey } = await createAgent(
    t.ctx,
    agentSchema.parse({
      name: "Lead Research Agent",
      departmentId: dep.id,
      provider: "Anthropic",
      model: "Claude Sonnet",
      connectionType: "SDK",
    }),
  );
  return { ...t, dep, agentId: id, apiKey, tz: t.org.timezone };
}

function llmCall(
  apiKey: string,
  model: string,
  tokens: [number, number, number],
  key = randomUUID(),
) {
  return postEvent(
    new Request("http://localhost/api/agent-events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "llm.call",
        provider: "Anthropic",
        model,
        input_tokens: tokens[0],
        output_tokens: tokens[1],
        cached_tokens: tokens[2],
      }),
    }),
  );
}

const price = (model: string, input: string, output: string, cached = "0", from?: string) =>
  addPriceSchema.parse({
    provider: "anthropic",
    model: model.toLowerCase().replace(/ /g, "_"),
    inputPerMtok: input,
    outputPerMtok: output,
    cachedPerMtok: cached,
    effectiveFrom: from,
  });

describe("usage & cost", () => {
  it("prices LLM calls exactly, aggregates per day and never double-counts a retried event", async () => {
    const admin = await makeAdmin();
    const model = uniqueModel();
    await addPrice(admin, price(model, "3", "15", "0.3", "2020-01-01T00:00:00Z"));
    const { ctx, apiKey, tz } = await setup();

    const key = randomUUID();
    expect((await llmCall(apiKey, model, [10_000, 2_000, 1_000], key)).status).toBe(201);
    expect((await llmCall(apiKey, model, [10_000, 2_000, 1_000], key)).status).toBe(200); // retry
    expect((await llmCall(apiKey, model, [1, 1, 0])).status).toBe(201);

    const records = await db.costRecord.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { occurredAt: "asc" },
    });
    expect(records).toHaveLength(2);
    // 10000×3 + 2000×15 + 1000×0.3 = 60300 µ$ → $0.0603
    expect(records[0]!.costUsd.toFixed(12)).toBe("0.060300000000");
    expect(records[0]!.pricingVersion).toBe(1);
    expect(records[1]!.costUsd.toFixed(12)).toBe("0.000018000000");

    const today = await usageToday(ctx, tz);
    expect(today.llmCalls).toBe(2);
    expect(today.unpricedCalls).toBe(0);
    expect(today.tokens).toBe(13_002);
    expect(today.cost).toBeCloseTo(0.060318, 9);
  });

  it("keeps unpriced calls at $0, then prices only them when a price is added (history stays put)", async () => {
    const admin = await makeAdmin();
    const model = uniqueModel();
    const { ctx, apiKey, tz } = await setup();

    await llmCall(apiKey, model, [1_000_000, 0, 0]);
    let today = await usageToday(ctx, tz);
    expect(today).toMatchObject({ llmCalls: 1, unpricedCalls: 1, cost: 0 });

    const v1 = await addPrice(admin, price(model, "2", "8", "0", "2020-01-01T00:00:00Z"));
    expect(v1.repriced).toBe(1);
    today = await usageToday(ctx, tz);
    expect(today).toMatchObject({ unpricedCalls: 0, cost: 2 });

    // A new version applies to new calls only; already-priced history keeps v1.
    const v2 = await addPrice(admin, price(model, "4", "8"));
    expect(v2.price.version).toBe(2);
    expect(v2.repriced).toBe(0);
    await llmCall(apiKey, model, [1_000_000, 0, 0]);
    const versions = (
      await db.costRecord.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { occurredAt: "asc" },
      })
    ).map((r) => [r.pricingVersion, r.costUsd.toNumber()]);
    expect(versions).toEqual([
      [1, 2],
      [2, 4],
    ]);
    expect((await usageToday(ctx, tz)).cost).toBe(6);
  });

  it("reports by department, agent and model, scoped to the organization", async () => {
    const admin = await makeAdmin();
    const model = uniqueModel();
    await addPrice(admin, price(model, "1", "1", "0", "2020-01-01T00:00:00Z"));
    const a = await setup("Tenant A");
    const b = await setup("Tenant B");
    await llmCall(a.apiKey, model, [500_000, 500_000, 0]);
    await llmCall(b.apiKey, model, [9_000_000, 0, 0]);

    const report = await getUsageReport(a.ctx, a.tz, "7d");
    expect(report.series).toHaveLength(7);
    expect(report.totals.cost).toBe(1);
    expect(report.departments).toEqual([expect.objectContaining({ label: "Sales", cost: 1 })]);
    expect(report.agents).toEqual([
      expect.objectContaining({ id: a.agentId, label: "Lead Research Agent", cost: 1 }),
    ]);
    expect(report.models).toEqual([expect.objectContaining({ label: model, llmCalls: 1 })]);
    expect(report.series.at(-1)!.cost).toBe(1);
  });

  it("only platform admins can add prices", async () => {
    const notAdmin = await makeAdmin(false);
    await expect(addPrice(notAdmin, price(uniqueModel(), "1", "1"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
