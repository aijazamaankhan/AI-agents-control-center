-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExecutionEventType" AS ENUM ('TASK_STARTED', 'TASK_COMPLETED', 'TASK_FAILED', 'TASK_CANCELLED', 'LLM_CALL', 'TOOL_CALL', 'APPROVAL_REQUESTED', 'LOG');

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "TaskStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "duration_ms" INTEGER,
    "input_tokens" BIGINT NOT NULL DEFAULT 0,
    "output_tokens" BIGINT NOT NULL DEFAULT 0,
    "cached_tokens" BIGINT NOT NULL DEFAULT 0,
    "llm_calls" INTEGER NOT NULL DEFAULT 0,
    "tool_calls" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "task_id" TEXT,
    "execution_id" TEXT,
    "type" "ExecutionEventType" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT,
    "model" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "tool_name" TEXT,
    "success" BOOLEAN,
    "summary" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "execution_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_organization_id_started_at_idx" ON "tasks"("organization_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "tasks_organization_id_agent_id_started_at_idx" ON "tasks"("organization_id", "agent_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "tasks_organization_id_status_idx" ON "tasks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "executions_organization_id_task_id_idx" ON "executions"("organization_id", "task_id");

-- CreateIndex
CREATE INDEX "execution_events_organization_id_received_at_idx" ON "execution_events"("organization_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "execution_events_organization_id_agent_id_occurred_at_idx" ON "execution_events"("organization_id", "agent_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "execution_events_task_id_occurred_at_idx" ON "execution_events"("task_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "execution_events_organization_id_idempotency_key_key" ON "execution_events"("organization_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
