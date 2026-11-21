-- ---------------------------------------------------------------------------
-- Mark the fee payment for INV-2026-021 (Ragul / SEASIND26006) as UNPAID.
-- Run against the production PostgreSQL database.
--
--   psql "$DATABASE_URL" -f backend/scripts/mark-fee-unpaid-INV-2026-021.sql
--
-- The first SELECT is only a preview. The UPDATE changes every non-deleted
-- COMPLETED row that shares this invoice number for this student, so a payment
-- covering several fee lines is reverted as one receipt.
-- ---------------------------------------------------------------------------

BEGIN;

-- 1. Preview exactly what will be changed (should list the ₹5,300 CASH row).
SELECT
  ft."id",
  s."manualRegsiName" AS "regNo",
  ft."transactionType",
  ft."amount",
  ft."status",
  ft."invoiceNumber",
  ft."billingMonth",
  ft."paidDate",
  ft."paymentMode",
  ft."description"
FROM "FeeTransaction" ft
JOIN "Student" s ON s."id" = ft."studentId"
WHERE ft."invoiceNumber" = 'INV-2026-021'
  AND s."manualRegsiName" = 'SEASIND26006'
  AND ft."deletedAt" IS NULL
  AND ft."status" = 'COMPLETED';

-- 2. Revert the payment.
UPDATE "FeeTransaction" ft
SET
  -- Restore the pre-discount gross amount when it is recorded in the
  -- description, so the pending invoice asks for the original amount again.
  "amount" = COALESCE(
    NULLIF(
      substring(ft."description" from 'Original Amount: ([0-9.]+)')::numeric,
      0
    ),
    ft."amount"
  ),
  "status"          = 'PENDING',
  "paidDate"        = NULL,
  "paymentMode"     = NULL,
  "razorpayOrderId" = NULL,
  "razorpayPaymentId" = NULL,
  "paymentStatus"   = NULL,
  "paymentMethod"   = NULL,

  -- Remove payment-only metadata so the receipt / payment group cannot be
  -- reconstructed from the description any more.
  "description" = regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            ft."description",
            '\s*\|\s*Original Amount:\s*[^|]*', '', 'g'
          ),
          '\s*\|\s*Discount:\s*[^|]*', '', 'g'
        ),
        '\s*\|\s*Pending Balance:\s*[^|]*', '', 'g'
      ),
      '\s*\|\s*\[PAY:[^\]]*\]', '', 'g'
    ),
    '\s*\|\s*(Ref|Notes):\s*[^|]*', '', 'g'
  ),

  "updatedAt" = NOW()
FROM "Student" s
WHERE ft."studentId" = s."id"
  AND ft."invoiceNumber" = 'INV-2026-021'
  AND s."manualRegsiName" = 'SEASIND26006'
  AND ft."deletedAt" IS NULL
  AND ft."status" = 'COMPLETED';

-- 3. Verify: status should now be PENDING, amount 5300, no payment date/mode.
SELECT
  ft."id",
  ft."transactionType",
  ft."amount",
  ft."status",
  ft."invoiceNumber",
  ft."paidDate",
  ft."paymentMode",
  ft."description"
FROM "FeeTransaction" ft
JOIN "Student" s ON s."id" = ft."studentId"
WHERE ft."invoiceNumber" = 'INV-2026-021'
  AND s."manualRegsiName" = 'SEASIND26006'
  AND ft."deletedAt" IS NULL;

COMMIT;

-- If the preview looked wrong, replace COMMIT; with ROLLBACK; instead.
