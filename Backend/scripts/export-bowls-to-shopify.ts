/**
 * Idempotent export of singing bowls into Shopify — one product per bowl,
 * single variant, inventory qty 1 (0 if sold), tagged `singing-bowl`, with
 * the NFT attributes stored as `omorenda.*` metafields.
 *
 * Usage:
 *   npx tsx scripts/export-bowls-to-shopify.ts            # reads the Bowl table (run BEFORE the drop-Bowl migration)
 *   npx tsx scripts/export-bowls-to-shopify.ts --json ./data/bowls.json
 *
 * Behavior mirrors the old DB import:
 *   - existing product with qty 0 (sold) → skipped entirely
 *   - existing product with stock → title/description/price/metafields updated, qty untouched
 *   - missing product → created (qty 1, or 0 when the source row is SOLD)
 *
 * Also backfills OrderItem.shopifyVariantGid for historical bowl orders by
 * matching on SKU (BOWL-NNN), so it can run before or after the migration.
 *
 * NOTE: bowls should NOT be published to the Online Store sales channel —
 * they are sold only through shop.omorenda.space. Products are created
 * unpublished; leave them that way.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/config/db";
import { config } from "../src/config/config";
import { shopifyAdminGraphql } from "../src/services/shopify/admin";
import { BOWL_METAFIELD_NAMESPACE, MAX_SERIAL, MIN_SERIAL } from "../src/services/shopify/bowls";
import { logger } from "../src/utils/logger";

type SourceBowl = {
  serialNumber: number;
  name: string;
  imageUrl: string;
  audioUrl: string | null;
  description: string | null;
  weightGrams: number;
  heightMm: number;
  widthMm: number;
  note: string;
  frequency: string;
  price: string;
  currency: string;
  sold: boolean;
};

function skuFor(serial: number) {
  return `BOWL-${String(serial).padStart(3, "0")}`;
}

function handleFor(serial: number) {
  return `singing-bowl-${String(serial).padStart(3, "0")}`;
}

async function readFromDb(): Promise<SourceBowl[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT "serialNumber", "name", "imageUrl", "description", "weightGrams",
            "heightMm", "widthMm", "note", "frequency",
            "price"::text AS "price", "currency", "status"::text AS "status"
     FROM "Bowl" ORDER BY "serialNumber"`,
  )) as Array<Record<string, unknown>>;
  return rows.map(r => ({
    serialNumber: Number(r.serialNumber),
    name: String(r.name),
    imageUrl: String(r.imageUrl),
    audioUrl: null,
    description: r.description === null ? null : String(r.description),
    weightGrams: Number(r.weightGrams),
    heightMm: Number(r.heightMm),
    widthMm: Number(r.widthMm),
    note: String(r.note),
    frequency: String(r.frequency),
    price: String(r.price),
    currency: String(r.currency ?? "USD"),
    sold: String(r.status) === "SOLD",
  }));
}

function readFromJson(filePath: string): SourceBowl[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected a JSON array at ${filePath}`);
  }
  return parsed.map((row, idx) => {
    const r = row as Record<string, unknown>;
    const serialNumber = r.serialNumber;
    if (
      typeof serialNumber !== "number" ||
      !Number.isInteger(serialNumber) ||
      serialNumber < MIN_SERIAL ||
      serialNumber > MAX_SERIAL
    ) {
      throw new Error(`Row ${idx}: serialNumber must be an integer between ${MIN_SERIAL} and ${MAX_SERIAL}`);
    }
    for (const field of ["name", "imageUrl", "note"]) {
      if (typeof r[field] !== "string" || !r[field]) {
        throw new Error(`Row ${idx}: ${field} is required`);
      }
    }
    for (const field of ["weightGrams", "heightMm", "widthMm"]) {
      const v = r[field];
      if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
        throw new Error(`Row ${idx}: ${field} must be a positive integer`);
      }
    }
    const freq = typeof r.frequency === "number" ? String(r.frequency) : r.frequency;
    if (typeof freq !== "string" || !/^[0-9]+(\.[0-9]+)?$/.test(freq)) {
      throw new Error(`Row ${idx}: frequency must be a non-negative number (e.g., 432.5)`);
    }
    if (r.price === undefined || r.price === null) {
      throw new Error(`Row ${idx}: price is required`);
    }
    return {
      serialNumber,
      name: r.name as string,
      imageUrl: r.imageUrl as string,
      audioUrl: typeof r.audioUrl === "string" && r.audioUrl.trim() ? r.audioUrl.trim() : null,
      description: typeof r.description === "string" ? r.description : null,
      weightGrams: r.weightGrams as number,
      heightMm: r.heightMm as number,
      widthMm: r.widthMm as number,
      note: r.note as string,
      frequency: freq,
      price: String(r.price),
      currency: typeof r.currency === "string" && r.currency ? r.currency : "USD",
      sold: false,
    };
  });
}

async function resolveLocationId(): Promise<string> {
  if (config.shopify.locationId) return config.shopify.locationId;
  const data = await shopifyAdminGraphql(
    config.shopify.shop,
    `query { locations(first: 1) { edges { node { id } } } }`,
  );
  const id = data?.locations?.edges?.[0]?.node?.id;
  if (!id) throw new Error("No Shopify location found; set SHOPIFY_LOCATION_ID");
  return String(id);
}

type ExistingProduct = {
  productGid: string;
  variantGid: string;
  inventoryQuantity: number;
} | null;

async function findExistingByHandle(handle: string): Promise<ExistingProduct> {
  const data = await shopifyAdminGraphql(
    config.shopify.shop,
    `query byHandle($handle: String!) {
      productByHandle(handle: $handle) {
        id
        variants(first: 1) { edges { node { id inventoryQuantity } } }
      }
    }`,
    { handle },
  );
  const product = data?.productByHandle;
  if (!product) return null;
  const variant = product.variants?.edges?.[0]?.node;
  return {
    productGid: String(product.id),
    variantGid: variant ? String(variant.id) : "",
    inventoryQuantity: Number(variant?.inventoryQuantity ?? 0),
  };
}

function metafieldsFor(bowl: SourceBowl) {
  const metafields = [
    { namespace: BOWL_METAFIELD_NAMESPACE, key: "serial", type: "number_integer", value: String(bowl.serialNumber) },
    // Canonical (IPFS) image URL — used for display and minted into the NFT,
    // independent of Shopify's async media processing.
    { namespace: BOWL_METAFIELD_NAMESPACE, key: "image_url", type: "url", value: bowl.imageUrl },
    { namespace: BOWL_METAFIELD_NAMESPACE, key: "weight_grams", type: "number_integer", value: String(bowl.weightGrams) },
    { namespace: BOWL_METAFIELD_NAMESPACE, key: "height_mm", type: "number_integer", value: String(bowl.heightMm) },
    { namespace: BOWL_METAFIELD_NAMESPACE, key: "width_mm", type: "number_integer", value: String(bowl.widthMm) },
    { namespace: BOWL_METAFIELD_NAMESPACE, key: "note", type: "single_line_text_field", value: bowl.note },
    { namespace: BOWL_METAFIELD_NAMESPACE, key: "frequency", type: "single_line_text_field", value: bowl.frequency },
  ];
  if (bowl.audioUrl) {
    metafields.push({
      namespace: BOWL_METAFIELD_NAMESPACE,
      key: "audio_url",
      type: "url",
      value: bowl.audioUrl,
    });
  }
  return metafields;
}

async function upsertProduct(
  bowl: SourceBowl,
  existing: ExistingProduct,
  locationId: string,
): Promise<{ productGid: string; variantGid: string }> {
  const productSetInput: Record<string, unknown> = {
    handle: handleFor(bowl.serialNumber),
    title: bowl.name,
    descriptionHtml: bowl.description ?? "",
    tags: [config.shopify.bowlTag],
    status: "ACTIVE",
    metafields: metafieldsFor(bowl),
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants: [
      {
        optionValues: [{ optionName: "Title", name: "Default Title" }],
        sku: skuFor(bowl.serialNumber),
        price: bowl.price,
        inventoryPolicy: "DENY",
        inventoryItem: { tracked: true },
        // Only set quantity on create; updates leave live stock alone.
        ...(existing
          ? {}
          : {
              inventoryQuantities: [
                { locationId, name: "available", quantity: bowl.sold ? 0 : 1 },
              ],
            }),
      },
    ],
    // Only attach the image on create so re-runs don't stack duplicate files.
    ...(existing ? {} : { files: [{ originalSource: bowl.imageUrl, contentType: "IMAGE" }] }),
  };
  if (existing) {
    productSetInput.id = existing.productGid;
  }

  const data = await shopifyAdminGraphql(
    config.shopify.shop,
    `mutation productSet($input: ProductSetInput!) {
      productSet(input: $input) {
        product {
          id
          variants(first: 1) { edges { node { id } } }
        }
        userErrors { field message }
      }
    }`,
    { input: productSetInput },
  );

  const userErrors = data?.productSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(
      `productSet #${bowl.serialNumber}: ${userErrors.map((e: { message: string }) => e.message).join(", ")}`,
    );
  }
  const product = data?.productSet?.product;
  const variantGid = product?.variants?.edges?.[0]?.node?.id;
  if (!product?.id || !variantGid) {
    throw new Error(`productSet #${bowl.serialNumber}: no product/variant returned`);
  }
  return { productGid: String(product.id), variantGid: String(variantGid) };
}

async function backfillOrderItems(serial: number, variantGid: string): Promise<number> {
  const updated = (await prisma.$executeRawUnsafe(
    `UPDATE "OrderItem" SET "shopifyVariantGid" = $1
     WHERE "sku" = $2 AND ("shopifyVariantGid" IS NULL OR "shopifyVariantGid" = '')`,
    variantGid,
    skuFor(serial),
  )) as number;
  return updated;
}

async function main() {
  if (!config.shopify.shop) throw new Error("Missing SHOPIFY_SHOP");
  if (!config.shopify.adminAccessToken) throw new Error("Missing SHOPIFY_ADMIN_ACCESS_TOKEN");

  const jsonFlag = process.argv.indexOf("--json");
  let bowls: SourceBowl[];
  if (jsonFlag !== -1) {
    const filePath = path.resolve(process.argv[jsonFlag + 1] ?? "");
    if (!filePath || !fs.existsSync(filePath)) {
      console.error("Usage: tsx scripts/export-bowls-to-shopify.ts [--json <path-to-bowls.json>]");
      process.exit(1);
    }
    bowls = readFromJson(filePath);
  } else {
    try {
      bowls = await readFromDb();
    } catch (err) {
      console.error(
        "Could not read the Bowl table (already migrated away?). " +
          "Re-run with --json <path-to-bowls.json>.\n" +
          (err instanceof Error ? err.message : String(err)),
      );
      process.exit(1);
    }
  }

  logger.info({ count: bowls.length }, "[BOWLS→SHOPIFY] exporting");
  const locationId = await resolveLocationId();

  let created = 0;
  let updated = 0;
  let skippedSold = 0;
  let orderItemsBackfilled = 0;

  for (const bowl of bowls) {
    const existing = await findExistingByHandle(handleFor(bowl.serialNumber));

    if (existing && existing.inventoryQuantity <= 0) {
      skippedSold++;
      if (existing.variantGid) {
        orderItemsBackfilled += await backfillOrderItems(bowl.serialNumber, existing.variantGid);
      }
      continue;
    }

    const result = await upsertProduct(bowl, existing, locationId);
    orderItemsBackfilled += await backfillOrderItems(bowl.serialNumber, result.variantGid);

    if (existing) {
      updated++;
    } else {
      created++;
    }
    logger.info(
      { serial: bowl.serialNumber, productGid: result.productGid, variantGid: result.variantGid },
      existing ? "[BOWLS→SHOPIFY] updated" : "[BOWLS→SHOPIFY] created",
    );
  }

  logger.info(
    { created, updated, skippedSold, orderItemsBackfilled },
    "[BOWLS→SHOPIFY] export complete",
  );
  await prisma.$disconnect();
}

main().catch(async err => {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    "[BOWLS→SHOPIFY] export failed",
  );
  await prisma.$disconnect();
  process.exit(1);
});
