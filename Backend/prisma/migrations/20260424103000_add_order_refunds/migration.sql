-- Add refund tracking fields and status

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "stripeRefundId" TEXT,
ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_stripeRefundId_key" ON "Order"("stripeRefundId");

