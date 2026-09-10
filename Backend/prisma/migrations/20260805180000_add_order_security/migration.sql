CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');
CREATE TYPE "ProviderOperationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "Order"
  ADD COLUMN "userId" UUID,
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "shopifyStatus" "ProviderOperationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "refundStatus" "ProviderOperationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "lastError" TEXT;

UPDATE "Order" o SET "userId" = u."id" FROM "User" u WHERE o."email" = u."email";
UPDATE "Order" SET
  "paymentStatus" = CASE WHEN "status" = 'PENDING' THEN 'PENDING'::"PaymentStatus" WHEN "status" = 'REFUNDED' THEN 'REFUNDED'::"PaymentStatus" ELSE 'PAID'::"PaymentStatus" END,
  "shopifyStatus" = CASE WHEN "status" = 'SHOPIFY_CREATED' THEN 'SUCCEEDED'::"ProviderOperationStatus" WHEN "status" = 'SHOPIFY_FAILED' THEN 'FAILED'::"ProviderOperationStatus" ELSE 'NOT_STARTED'::"ProviderOperationStatus" END,
  "refundStatus" = CASE WHEN "status" = 'REFUNDED' THEN 'SUCCEEDED'::"ProviderOperationStatus" ELSE 'NOT_STARTED'::"ProviderOperationStatus" END;

ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt" DESC);

CREATE TABLE "AuthSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WebhookEvent" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'PROCESSING',
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebhookEvent_provider_externalId_key" ON "WebhookEvent"("provider", "externalId");
CREATE INDEX "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status", "createdAt" DESC);
