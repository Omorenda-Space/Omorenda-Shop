-- Move singing bowls to Shopify-managed inventory.
--
-- 1. Snapshot every existing NftMint's bowl attributes onto the mint row
--    (bowlSerial + mintPayload) so minting/display no longer needs the Bowl
--    table.
-- 2. Drop the Bowl table, its enum, and the bowlId columns.
--
-- IMPORTANT: run `npm run bowls:export` (scripts/export-bowls-to-shopify.ts)
-- BEFORE applying this migration if you want the current DB bowls pushed to
-- Shopify from the live table. After this migration the script can still run
-- from a JSON file (--json), and OrderItem backfill matches by SKU.

-- AlterTable: NftMint snapshot columns
ALTER TABLE "NftMint" ADD COLUMN "bowlSerial" INTEGER;
ALTER TABLE "NftMint" ADD COLUMN "mintPayload" JSONB;

-- Backfill from Bowl rows
UPDATE "NftMint" m
SET
  "bowlSerial" = b."serialNumber",
  "mintPayload" = jsonb_build_object(
    'name', b."name",
    'imageUrl', b."imageUrl",
    'weightGrams', b."weightGrams",
    'heightMm', b."heightMm",
    'widthMm', b."widthMm",
    'note', b."note",
    'frequency', b."frequency"
  )
FROM "Bowl" b
WHERE m."bowlId" = b."id";

-- CreateIndex
CREATE UNIQUE INDEX "NftMint_bowlSerial_key" ON "NftMint"("bowlSerial");

-- DropForeignKey
ALTER TABLE "NftMint" DROP CONSTRAINT "NftMint_bowlId_fkey";
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_bowlId_fkey";
ALTER TABLE "Bowl" DROP CONSTRAINT "Bowl_soldToUserId_fkey";

-- DropColumn
ALTER TABLE "NftMint" DROP COLUMN "bowlId";
ALTER TABLE "OrderItem" DROP COLUMN "bowlId";

-- DropTable
DROP TABLE "Bowl";

-- DropEnum
DROP TYPE "BowlStatus";
