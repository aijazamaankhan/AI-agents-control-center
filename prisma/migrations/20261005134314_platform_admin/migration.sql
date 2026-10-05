-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN     "handled_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "suspended_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspended_at" TIMESTAMPTZ(3);
