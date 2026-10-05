-- CreateTable
CREATE TABLE "model_prices" (
    "id" TEXT NOT NULL,
    "price_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "input_per_mtok" DECIMAL(12,6) NOT NULL,
    "output_per_mtok" DECIMAL(12,6) NOT NULL,
    "cached_per_mtok" DECIMAL(12,6) NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "task_id" TEXT,
    "price_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cached_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(24,12) NOT NULL DEFAULT 0,
    "price_id" TEXT,
    "pricing_version" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_daily" (
    "organization_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "agent_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "price_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "llm_calls" INTEGER NOT NULL DEFAULT 0,
    "unpriced_calls" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" BIGINT NOT NULL DEFAULT 0,
    "output_tokens" BIGINT NOT NULL DEFAULT 0,
    "cached_tokens" BIGINT NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(24,12) NOT NULL DEFAULT 0,

    CONSTRAINT "usage_daily_pkey" PRIMARY KEY ("organization_id","day","agent_id","department_id","price_key")
);

-- CreateIndex
CREATE INDEX "model_prices_price_key_effective_from_idx" ON "model_prices"("price_key", "effective_from" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "model_prices_price_key_version_key" ON "model_prices"("price_key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "cost_records_event_id_key" ON "cost_records"("event_id");

-- CreateIndex
CREATE INDEX "cost_records_organization_id_day_idx" ON "cost_records"("organization_id", "day");

-- CreateIndex
CREATE INDEX "cost_records_price_key_pricing_version_idx" ON "cost_records"("price_key", "pricing_version");

-- CreateIndex
CREATE INDEX "usage_daily_organization_id_day_idx" ON "usage_daily"("organization_id", "day");

-- Backfill: one cost record per existing LLM call (unpriced until a matching price is added),
-- then the daily aggregates. Keys use the same normalisation as src/features/usage/pricing.ts.
INSERT INTO "cost_records" (
  "id", "organization_id", "event_id", "agent_id", "department_id", "task_id", "price_key",
  "provider", "model", "day", "occurred_at", "input_tokens", "output_tokens", "cached_tokens"
)
SELECT
  'cst_' || substr(e."id", strpos(e."id", '_') + 1),
  e."organization_id", e."id", e."agent_id", e."department_id", e."task_id",
  regexp_replace(lower(btrim(coalesce(nullif(btrim(e."provider"), ''), 'unknown'))), '[[:space:]_]+', '-', 'g')
    || '/' ||
  regexp_replace(lower(btrim(coalesce(nullif(btrim(e."model"), ''), 'unknown'))), '[[:space:]_]+', '-', 'g'),
  coalesce(e."provider", 'unknown'), coalesce(e."model", 'unknown'),
  (e."occurred_at" AT TIME ZONE o."timezone")::date,
  e."occurred_at", e."input_tokens", e."output_tokens", e."cached_tokens"
FROM "execution_events" e
JOIN "organizations" o ON o."id" = e."organization_id"
WHERE e."type" = 'LLM_CALL';

INSERT INTO "usage_daily" (
  "organization_id", "day", "agent_id", "department_id", "price_key", "provider", "model",
  "llm_calls", "unpriced_calls", "input_tokens", "output_tokens", "cached_tokens", "cost_usd"
)
SELECT
  "organization_id", "day", "agent_id", "department_id", "price_key", min("provider"), min("model"),
  count(*), count(*), sum("input_tokens"), sum("output_tokens"), sum("cached_tokens"), 0
FROM "cost_records"
GROUP BY "organization_id", "day", "agent_id", "department_id", "price_key";
