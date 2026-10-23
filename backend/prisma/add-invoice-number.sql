ALTER TABLE "FeeTransaction" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
CREATE INDEX IF NOT EXISTS "FeeTransaction_invoiceNumber_idx" ON "FeeTransaction"("invoiceNumber");
CREATE TABLE IF NOT EXISTS "InvoiceCounter" (
  "period" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("period")
);
