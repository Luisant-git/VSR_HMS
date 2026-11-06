ALTER TABLE "FeeTransaction"
  ADD COLUMN "razorpayOrderId" TEXT,
  ADD COLUMN "razorpayPaymentId" TEXT,
  ADD COLUMN "paymentStatus" TEXT,
  ADD COLUMN "paymentMethod" TEXT;

CREATE INDEX "FeeTransaction_razorpayOrderId_idx"
  ON "FeeTransaction"("razorpayOrderId");
CREATE INDEX "FeeTransaction_razorpayPaymentId_idx"
  ON "FeeTransaction"("razorpayPaymentId");

CREATE TABLE "RazorpayOrder" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "orderId" TEXT,
  "paymentId" TEXT,
  "paymentMethod" TEXT,
  "amountPaise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'CREATING',
  "paymentStatus" TEXT,
  "feeItems" JSONB NOT NULL,
  "outstandingAmountPaise" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RazorpayOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RazorpayOrder_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RazorpayOrder_clientRequestId_key"
  ON "RazorpayOrder"("clientRequestId");
CREATE UNIQUE INDEX "RazorpayOrder_orderId_key"
  ON "RazorpayOrder"("orderId");
CREATE UNIQUE INDEX "RazorpayOrder_paymentId_key"
  ON "RazorpayOrder"("paymentId");
CREATE INDEX "RazorpayOrder_studentId_status_idx"
  ON "RazorpayOrder"("studentId", "status");
