-- CreateEnum
CREATE TYPE "BowlStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('BOWL', 'SHOPIFY');

-- CreateEnum
CREATE TYPE "MintStatus" AS ENUM ('PENDING', 'MINTING', 'MINTED', 'FAILED');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "bowlId" UUID,
ALTER COLUMN "shopifyVariantGid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleEmail" TEXT,
ADD COLUMN     "googleSub" TEXT,
ADD COLUMN     "suiAddress" TEXT,
ADD COLUMN     "zkLoginSalt" BYTEA;

-- CreateTable
CREATE TABLE "Bowl" (
    "id" UUID NOT NULL,
    "serialNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "description" TEXT,
    "weightGrams" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "BowlStatus" NOT NULL DEFAULT 'AVAILABLE',
    "soldToUserId" UUID,
    "reservedUntil" TIMESTAMP(3),
    "reservedStripeSessionId" TEXT,
    "nftObjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bowl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NftMint" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "productKind" "ProductKind" NOT NULL,
    "bowlId" UUID,
    "shopifyVariantGid" TEXT,
    "recipientSuiAddress" TEXT NOT NULL,
    "sponsoredByAddress" TEXT,
    "status" "MintStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "suiObjectId" TEXT,
    "mintTxDigest" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NftMint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bowl_serialNumber_key" ON "Bowl"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Bowl_nftObjectId_key" ON "Bowl"("nftObjectId");

-- CreateIndex
CREATE INDEX "Bowl_status_idx" ON "Bowl"("status");

-- CreateIndex
CREATE INDEX "Bowl_soldToUserId_idx" ON "Bowl"("soldToUserId");

-- CreateIndex
CREATE INDEX "Bowl_reservedUntil_idx" ON "Bowl"("reservedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "NftMint_orderItemId_key" ON "NftMint"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "NftMint_suiObjectId_key" ON "NftMint"("suiObjectId");

-- CreateIndex
CREATE INDEX "NftMint_status_scheduledAt_idx" ON "NftMint"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NftMint_orderId_idx" ON "NftMint"("orderId");

-- CreateIndex
CREATE INDEX "NftMint_userId_idx" ON "NftMint"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_bowlId_key" ON "OrderItem"("bowlId");

-- CreateIndex
CREATE INDEX "OrderItem_bowlId_idx" ON "OrderItem"("bowlId");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_suiAddress_key" ON "User"("suiAddress");

-- CreateIndex
CREATE INDEX "User_suiAddress_idx" ON "User"("suiAddress");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_bowlId_fkey" FOREIGN KEY ("bowlId") REFERENCES "Bowl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bowl" ADD CONSTRAINT "Bowl_soldToUserId_fkey" FOREIGN KEY ("soldToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftMint" ADD CONSTRAINT "NftMint_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftMint" ADD CONSTRAINT "NftMint_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftMint" ADD CONSTRAINT "NftMint_bowlId_fkey" FOREIGN KEY ("bowlId") REFERENCES "Bowl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftMint" ADD CONSTRAINT "NftMint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

