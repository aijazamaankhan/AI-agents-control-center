import "server-only";
import { newId } from "@/lib/ids";
import type { Prisma } from "@/generated/prisma/client";
import { computeCost, parseUsdToMicros, priceKeyOf, type PriceMicros } from "../pricing";

type Tx = Prisma.TransactionClient;

export interface LlmUsage {
  eventId: string;
  organizationId: string;
  agentId: string;
  departmentId: string;
  taskId: string | null;
  provider: string;
  model: string;
  occurredAt: Date;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export function priceMicros(price: {
  inputPerMtok: Prisma.Decimal;
  outputPerMtok: Prisma.Decimal;
  cachedPerMtok: Prisma.Decimal;
}): PriceMicros {
  const m = (d: Prisma.Decimal) => parseUsdToMicros(d.toFixed(6)) ?? 0n;
  return {
    input: m(price.inputPerMtok),
    output: m(price.outputPerMtok),
    cached: m(price.cachedPerMtok),
  };
}

/** The price in force for a model at a moment: latest effective_from ≤ at, highest version. */
export function findPrice(tx: Tx, priceKey: string, at: Date) {
  return tx.modelPrice.findFirst({
    where: { priceKey, effectiveFrom: { lte: at } },
    orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
  });
}

/**
 * Prices one LLM call and adds it to the daily aggregates. Runs inside the event's ingest
 * transaction, so a duplicate event (rejected before this point) can never be counted twice.
 */
export async function recordLlmUsage(tx: Tx, u: LlmUsage): Promise<void> {
  const priceKey = priceKeyOf(u.provider, u.model);
  const price = await findPrice(tx, priceKey, u.occurredAt);
  const cost = price ? computeCost(u, priceMicros(price)) : "0";

  const [row] = await tx.$queryRaw<{ day: Date }[]>`
    SELECT (${u.occurredAt}::timestamptz AT TIME ZONE "timezone")::date AS day
    FROM "organizations" WHERE "id" = ${u.organizationId}`;
  const day = row?.day ?? u.occurredAt;

  await tx.costRecord.create({
    data: {
      id: newId("cost"),
      organizationId: u.organizationId,
      eventId: u.eventId,
      agentId: u.agentId,
      departmentId: u.departmentId,
      taskId: u.taskId,
      priceKey,
      provider: u.provider,
      model: u.model,
      day,
      occurredAt: u.occurredAt,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      cachedTokens: u.cachedTokens,
      costUsd: cost,
      priceId: price?.id ?? null,
      pricingVersion: price?.version ?? null,
    },
  });

  // Concurrency-safe increment of the day's aggregate row.
  await tx.$executeRaw`
    INSERT INTO "usage_daily" ("organization_id", "day", "agent_id", "department_id", "price_key",
      "provider", "model", "llm_calls", "unpriced_calls", "input_tokens", "output_tokens",
      "cached_tokens", "cost_usd")
    VALUES (${u.organizationId}, ${day}::date, ${u.agentId}, ${u.departmentId}, ${priceKey},
      ${u.provider}, ${u.model}, 1, ${price ? 0 : 1}, ${u.inputTokens}, ${u.outputTokens},
      ${u.cachedTokens}, ${cost}::numeric)
    ON CONFLICT ("organization_id", "day", "agent_id", "department_id", "price_key") DO UPDATE SET
      "llm_calls" = "usage_daily"."llm_calls" + 1,
      "unpriced_calls" = "usage_daily"."unpriced_calls" + EXCLUDED."unpriced_calls",
      "input_tokens" = "usage_daily"."input_tokens" + EXCLUDED."input_tokens",
      "output_tokens" = "usage_daily"."output_tokens" + EXCLUDED."output_tokens",
      "cached_tokens" = "usage_daily"."cached_tokens" + EXCLUDED."cached_tokens",
      "cost_usd" = "usage_daily"."cost_usd" + EXCLUDED."cost_usd"`;
}
