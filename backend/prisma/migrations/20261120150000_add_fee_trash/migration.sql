ALTER TABLE "FeeTransaction"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "FeeTransaction_deletedAt_idx" ON "FeeTransaction"("deletedAt");
