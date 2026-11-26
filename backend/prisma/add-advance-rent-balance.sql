-- Add advanceRentBalance column to Student for advance rent prepayments.
-- This standalone script is not a Prisma migration and does not update _prisma_migrations.
BEGIN;

ALTER TABLE "public"."Student"
  ADD COLUMN IF NOT EXISTS "advanceRentBalance" DOUBLE PRECISION DEFAULT 0.0;

COMMIT;
