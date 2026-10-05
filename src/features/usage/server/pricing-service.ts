import "server-only";
import { AppError } from "@/lib/api/errors";
import type { RequestMeta, ResolvedSession } from "@/lib/auth/sessions";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/security/audit";
import { priceKeyOf } from "../pricing";
import type { AddPriceInput } from "../schemas";

function assertAdmin(admin: ResolvedSession) {
  if (!admin.user.isPlatformAdmin) throw new AppError("FORBIDDEN", "Platform administrators only.");
}

/** Every price version, newest first per model. Platform-wide (not tenant data). */
export async function listPrices(admin: ResolvedSession) {
  assertAdmin(admin);
  return db.modelPrice.findMany({
    orderBy: [{ priceKey: "asc" }, { version: "desc" }],
  });
}

/** Models agents have used that have no price yet (across all customers; counts only). */
export async function unpricedModels(admin: ResolvedSession) {
  assertAdmin(admin);
  const rows = await db.usageDaily.groupBy({
    by: ["priceKey", "provider", "model"],
    where: { unpricedCalls: { gt: 0 } },
    _sum: { unpricedCalls: true },
    orderBy: { priceKey: "asc" },
  });
  const seen = new Map<
    string,
    { priceKey: string; provider: string; model: string; calls: number }
  >();
  for (const r of rows) {
    const prev = seen.get(r.priceKey);
    const calls = (prev?.calls ?? 0) + (r._sum.unpricedCalls ?? 0);
    seen.set(r.priceKey, { priceKey: r.priceKey, provider: r.provider, model: r.model, calls });
  }
  return [...seen.values()];
}

/**
 * Adds a new price version for a model. Already-priced history is never changed; LLM calls that
 * had no price and fall inside this version's window are priced now (and stamped with it).
 */
export async function addPrice(
  admin: ResolvedSession,
  input: AddPriceInput,
  meta: RequestMeta = {},
) {
  assertAdmin(admin);
  const priceKey = priceKeyOf(input.provider, input.model);
  const effectiveFrom = input.effectiveFrom ?? new Date();

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`price:${priceKey}`}))`;
    const latest = await tx.modelPrice.findFirst({
      where: { priceKey },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    const price = await tx.modelPrice.create({
      data: {
        id: newId("price"),
        priceKey,
        provider: input.provider,
        model: input.model,
        version,
        inputPerMtok: input.inputPerMtok,
        outputPerMtok: input.outputPerMtok,
        cachedPerMtok: input.cachedPerMtok,
        effectiveFrom,
        note: input.note,
        createdById: admin.user.id,
      },
    });

    // This version applies until the next later-effective price of the same model.
    const next = await tx.modelPrice.findFirst({
      where: { priceKey, effectiveFrom: { gt: effectiveFrom } },
      orderBy: { effectiveFrom: "asc" },
      select: { effectiveFrom: true },
    });
    const until = next?.effectiveFrom ?? new Date("9999-12-31T00:00:00Z");

    const repriced = await tx.$executeRaw`
      UPDATE "cost_records" SET
        "cost_usd" = ("input_tokens"::numeric * ${price.inputPerMtok}::numeric
                    + "output_tokens"::numeric * ${price.outputPerMtok}::numeric
                    + "cached_tokens"::numeric * ${price.cachedPerMtok}::numeric) / 1000000,
        "price_id" = ${price.id},
        "pricing_version" = ${version}
      WHERE "price_key" = ${priceKey} AND "pricing_version" IS NULL
        AND "occurred_at" >= ${effectiveFrom} AND "occurred_at" < ${until}`;

    if (repriced > 0) {
      await tx.$executeRaw`
        UPDATE "usage_daily" u SET "cost_usd" = s."cost", "unpriced_calls" = s."unpriced"
        FROM (
          SELECT "organization_id", "day", "agent_id", "department_id", "price_key",
                 sum("cost_usd") AS "cost",
                 (count(*) FILTER (WHERE "pricing_version" IS NULL))::int AS "unpriced"
          FROM "cost_records" WHERE "price_key" = ${priceKey}
          GROUP BY "organization_id", "day", "agent_id", "department_id", "price_key"
        ) s
        WHERE u."organization_id" = s."organization_id" AND u."day" = s."day"
          AND u."agent_id" = s."agent_id" AND u."department_id" = s."department_id"
          AND u."price_key" = s."price_key"`;
    }

    await recordAudit(
      {
        action: "admin.price_added",
        actorUserId: admin.user.id,
        resourceType: "model_price",
        resourceId: price.id,
        metadata: { priceKey, version, repriced },
        meta,
      },
      tx,
    );
    return { price, repriced };
  });
}
