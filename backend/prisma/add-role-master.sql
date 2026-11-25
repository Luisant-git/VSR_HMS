-- Create the Role table for Role Master on an existing production database
-- without dropping extra backup tables such as EbBill_recovery_backup_*.
-- This standalone script is not a Prisma migration and does not update _prisma_migrations.
BEGIN;

CREATE TABLE IF NOT EXISTS "public"."Role" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key"
  ON "public"."Role" ("name");

INSERT INTO "public"."Role" ("id", "name", "label", "description", "isActive", "isSystem", "createdAt", "updatedAt")
VALUES
  ('00000000-0000-4000-8000-000000000001', 'ADMIN', 'Admin', 'Hostel Administrator', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000002', 'WARDEN', 'Warden', 'Hostel Warden', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000003', 'SUPER_ADMIN', 'Super Admin', 'Super Administrator', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000004', 'DEVELOPER', 'Developer', 'System Developer', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000005', 'CANTEEN_MANAGER', 'Canteen Manager', 'Canteen & Mess Manager', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

COMMIT;
