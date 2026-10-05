-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ApprovalDecisionSource" AS ENUM ('HUMAN', 'POLICY', 'SYSTEM');

-- AlterEnum
ALTER TYPE "ExecutionEventType" ADD VALUE 'APPROVAL_DECIDED';

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "task_id" TEXT,
    "event_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "risk" "ApprovalRisk" NOT NULL DEFAULT 'MEDIUM',
    "capability_key" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decision_source" "ApprovalDecisionSource",
    "decided_by_id" TEXT,
    "decision_note" TEXT NOT NULL DEFAULT '',
    "requested_at" TIMESTAMPTZ(3) NOT NULL,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approvals_event_id_key" ON "approvals"("event_id");

-- CreateIndex
CREATE INDEX "approvals_organization_id_status_requested_at_idx" ON "approvals"("organization_id", "status", "requested_at" DESC);

-- CreateIndex
CREATE INDEX "approvals_organization_id_agent_id_status_idx" ON "approvals"("organization_id", "agent_id", "status");

-- CreateIndex
CREATE INDEX "approvals_task_id_idx" ON "approvals"("task_id");

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
