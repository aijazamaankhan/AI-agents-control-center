-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'WORKING', 'IDLE', 'WAITING', 'FAILED', 'OFFLINE', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('SDK', 'REST_API', 'WEBHOOK', 'MCP', 'API_INTEGRATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EndpointAuthType" AS ENUM ('NONE', 'API_KEY', 'BEARER_TOKEN', 'BASIC');

-- CreateEnum
CREATE TYPE "CapabilityRule" AS ENUM ('ALLOWED', 'DENIED', 'APPROVAL_REQUIRED');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "connection_type" "ConnectionType" NOT NULL,
    "endpoint_url" TEXT,
    "auth_type" "EndpointAuthType" NOT NULL DEFAULT 'NONE',
    "auth_header_name" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'OFFLINE',
    "last_heartbeat_at" TIMESTAMPTZ(3),
    "last_active_at" TIMESTAMPTZ(3),
    "connection_verified_at" TIMESTAMPTZ(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_credentials" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "hint" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agent_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_api_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "agent_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_capabilities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rule" "CapabilityRule" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_organization_id_department_id_idx" ON "agents"("organization_id", "department_id");

-- CreateIndex
CREATE INDEX "agents_organization_id_status_idx" ON "agents"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agents_organization_id_name_key_key" ON "agents"("organization_id", "name_key");

-- CreateIndex
CREATE UNIQUE INDEX "agent_credentials_agent_id_key" ON "agent_credentials"("agent_id");

-- CreateIndex
CREATE INDEX "agent_credentials_organization_id_idx" ON "agent_credentials"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_api_keys_key_hash_key" ON "agent_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "agent_api_keys_organization_id_agent_id_idx" ON "agent_api_keys"("organization_id", "agent_id");

-- CreateIndex
CREATE INDEX "agent_capabilities_organization_id_idx" ON "agent_capabilities"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_capabilities_agent_id_key_key" ON "agent_capabilities"("agent_id", "key");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_credentials" ADD CONSTRAINT "agent_credentials_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_capabilities" ADD CONSTRAINT "agent_capabilities_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
