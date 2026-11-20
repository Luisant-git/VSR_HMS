-- Add the columns required by the Fee Trash feature to an existing production database.
-- This standalone script is not a Prisma migration and does not update _prisma_migrations.
BEGIN;

ALTER TABLE "public"."FeeTransaction"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

CREATE INDEX IF NOT EXISTS "FeeTransaction_deletedAt_idx"
  ON "public"."FeeTransaction" ("deletedAt");

COMMIT;
