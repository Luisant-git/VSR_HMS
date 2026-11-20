-- Recover EB meter readings shown as 0.0 in "Room EB Billing History".
--
-- Older bills stored readings only in `prevReading` / `currReading`. The newer
-- `normalPrevReading` / `normalCurrReading` columns default to 0, and the UI
-- uses `??` (which does not fall back on 0), so it shows 0.0 for both readings.
--
-- Run on the PRODUCTION database. Steps 1-2 are read-only; step 3 writes.

-- ============================================================
-- 0. If these columns do not exist yet, uncomment and run this:
-- ============================================================
-- ALTER TABLE "EbBill"
--   ADD COLUMN IF NOT EXISTS "hasAcMeter"        boolean          NOT NULL DEFAULT false,
--   ADD COLUMN IF NOT EXISTS "acPrevReading"     double precision NOT NULL DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS "acCurrReading"     double precision NOT NULL DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS "normalPrevReading" double precision NOT NULL DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS "normalCurrReading" double precision NOT NULL DEFAULT 0;

-- ============================================================
-- 1. PREVIEW - check which bills are affected
--    Expect: normal* = 0, but currReading = 82, 97, 85, ...
-- ============================================================
SELECT "roomNo", "billingCycle",
       "prevReading"        AS "oldPrev",
       "currReading"        AS "oldCurr",
       "normalPrevReading"  AS "newPrev",
       "normalCurrReading"  AS "newCurr",
       "unitsConsumed",
       "totalAmount"
FROM "EbBill"
WHERE "unitsConsumed" > 0
  AND (
    ("normalPrevReading" = 0 AND "prevReading" > 0)
    OR ("normalCurrReading" = 0 AND "currReading" > 0)
  )
-- AND "billingCycle" = '2026-10'   -- uncomment to limit to one cycle
ORDER BY "billingCycle" DESC, "roomNo";

-- ============================================================
-- 2. BACKUP - run once before step 3
-- ============================================================
CREATE TABLE "EbBill_recovery_backup" AS TABLE "EbBill";

-- ============================================================
-- 3. RECOVER - copy legacy readings into the new columns
--    Guarded so genuine zero readings are left untouched.
-- ============================================================
UPDATE "EbBill"
SET "normalPrevReading" = CASE WHEN "normalPrevReading" = 0 AND "prevReading" > 0 THEN "prevReading" ELSE "normalPrevReading" END,
    "normalCurrReading" = CASE WHEN "normalCurrReading" = 0 AND "currReading" > 0 THEN "currReading" ELSE "normalCurrReading" END
WHERE "unitsConsumed" > 0
  AND (
    ("normalPrevReading" = 0 AND "prevReading" > 0)
    OR ("normalCurrReading" = 0 AND "currReading" > 0)
  )
-- AND "billingCycle" = '2026-10'   -- uncomment to limit to one cycle
;

-- ============================================================
-- 4. VERIFY - recomputed units must equal stored unitsConsumed
-- ============================================================
SELECT "roomNo", "billingCycle",
       "normalPrevReading" AS "prev",
       "normalCurrReading" AS "curr",
       ("normalCurrReading" - "normalPrevReading") AS "recomputedUnits",
       "unitsConsumed" AS "storedUnits"
FROM "EbBill"
WHERE "billingCycle" = '2026-10'
ORDER BY "roomNo";

-- Should return 0 rows once recovery is complete:
SELECT "roomNo", "billingCycle"
FROM "EbBill"
WHERE "unitsConsumed" > 0
  AND (
    ("normalPrevReading" = 0 AND "prevReading" > 0)
    OR ("normalCurrReading" = 0 AND "currReading" > 0)
  );

-- Rollback if needed:
-- BEGIN;
-- DELETE FROM "EbBill";
-- INSERT INTO "EbBill" SELECT * FROM "EbBill_recovery_backup";
-- COMMIT;
