-- Add billingCycle to College (default PREPAID for existing colleges)
ALTER TABLE "College" ADD COLUMN "billingCycle" text NOT NULL DEFAULT 'PREPAID';

-- Add billingMonth to FeeTransaction (nullable for backward compatibility)
ALTER TABLE "FeeTransaction" ADD COLUMN "billingMonth" text;

-- Add index for duplicate prevention on studentId + billingMonth + transactionType
CREATE INDEX "FeeTransaction_studentId_billingMonth_transactionType_idx" ON "FeeTransaction"("studentId", "billingMonth", "transactionType");