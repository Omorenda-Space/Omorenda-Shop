/**
 * Create isolated Shopify draft products for end-to-end bowl audio testing.
 *
 * The products are clearly marked with `[TEST]` in the title and tagged with
 * `audio-integration-test`. They reuse existing Shopify bowl images as mock
 * visuals and read verified IPFS audio URLs from the local upload manifest.
 *
 * Usage (from Backend):
 *   npm run bowls:audio:test-products -- --dry-run
 *   npm run bowls:audio:test-products
 *   npm run bowls:audio:test-products -- --delete --dry-run
 *   npm run bowls:audio:test-products -- --delete
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config/config";
import { shopifyAdminGraphql } from "../src/services/shopify/admin";
import { BOWL_METAFIELD_NAMESPACE } from "../src/services/shopify/bowls";

const TEST_TAG = "audio-integration-test";
const TEST_HANDLE_PREFIX = "audio-integration-test-bowl";
const manifestPath = path.resolve("data", "bowl-audio-ipfs", "audio-upload-manifest.json");

type AudioManifestEntry = {
  bowlNumber: number;
  cid: string;
  audioUrl: string;
};

type TestBowl = {
  serial: number;
  note: string;
  frequency: string;
  weightGrams: number;
  heightMm: number;
  widthMm: number;
};

type ShopifyProductSummary = {
  id: string;
  handle: string;
  title: string;
  tags: string[];
  featuredImage: { url: string } | null;
  imageMetafield: { value: string } | null;
  serialMetafield: { value: string } | null;
};

const testBowls: TestBowl[] = [
  { serial: 21, note: "D#3", frequency: "153.32", weightGrams: 921, heightMm: 104, widthMm: 218 },
  { serial: 22, note: "G3", frequency: "192.87", weightGrams: 934, heightMm: 106, widthMm: 221 },
  { serial: 23, note: "C#3", frequency: "137.21", weightGrams: 948, heightMm: 108, widthMm: 224 },
  { serial: 24, note: "B2", frequency: "126.95", weightGrams: 963, heightMm: 110, widthMm: 227 },
  { serial: 30, note: "A#2", frequency: "114.26", weightGrams: 980, heightMm: 112, widthMm: 230 },
];

function loadAudioManifest(): Map<number, AudioManifestEntry> {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Audio manifest not found: ${manifestPath}`);
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Audio manifest must contain an array");
  }

  const entries = new Map<number, AudioManifestEntry>();
  for (const value of parsed) {
    const entry = value as Partial<AudioManifestEntry>;
    if (
      !Number.isInteger(entry.bowlNumber) ||
      typeof entry.cid !== "string" ||
      !entry.cid ||
      typeof entry.audioUrl !== "string" ||
      !entry.audioUrl.startsWith("https://")
    ) {
      throw new Error("Audio manifest contains an invalid entry");
    }
    entries.set(entry.bowlNumber!, entry as AudioManifestEntry);
  }
  return entries;
}

async function listShopifyBowls(): Promise<ShopifyProductSummary[]> {
  const data = await shopifyAdminGraphql(
    config.shopify.shop,
    `query audioTestProductSources($search: String!) {
      products(first: 100, query: $search) {
        nodes {
          id
          handle
          title
          tags
          featuredImage { url }
          imageMetafield: metafield(namespace: "${BOWL_METAFIELD_NAMESPACE}", key: "image_url") {
            value
          }
          serialMetafield: metafield(namespace: "${BOWL_METAFIELD_NAMESPACE}", key: "serial") {
            value
          }
        }
      }
    }`,
    { search: `tag:'${config.shopify.bowlTag}'` },
  );
  return (data?.products?.nodes ?? []) as ShopifyProductSummary[];
}

function testHandle(serial: number): string {
  return `${TEST_HANDLE_PREFIX}-${String(serial).padStart(3, "0")}`;
}

function assertNoRealProductCollisions(
  products: ShopifyProductSummary[],
  targetSerials: Set<number>,
): void {
  const collisions = products.filter(product => {
    const serial = Number(product.serialMetafield?.value);
    const isOurTestProduct =
      product.tags.includes(TEST_TAG) && product.handle === testHandle(serial);
    return targetSerials.has(serial) && !isOurTestProduct;
  });
  if (collisions.length > 0) {
    throw new Error(
      `Refusing to create test data; real products already use target serials: ${collisions
        .map(product => `${product.serialMetafield?.value} (${product.title})`)
        .join(", ")}`,
    );
  }
}

function mockImageUrls(products: ShopifyProductSummary[]): string[] {
  const urls = products
    .filter(product => !product.tags.includes(TEST_TAG))
    .map(product => product.imageMetafield?.value || product.featuredImage?.url || "")
    .filter((value): value is string => Boolean(value));
  if (urls.length === 0) {
    throw new Error("No existing Shopify bowl images are available for mock test products");
  }
  return [...new Set(urls)];
}

async function upsertTestProduct(args: {
  bowl: TestBowl;
  audio: AudioManifestEntry;
  imageUrl: string;
  existing: ShopifyProductSummary | undefined;
}): Promise<{ id: string; action: "created" | "updated" }> {
  const { bowl, audio, imageUrl, existing } = args;
  const input: Record<string, unknown> = {
    ...(existing ? { id: existing.id } : {}),
    handle: testHandle(bowl.serial),
    title: `[TEST] Singing Bowl Audio ${bowl.serial}`,
    descriptionHtml:
      "<p>Temporary draft product for testing the IPFS singing bowl audio preview. Not for sale.</p>",
    status: "DRAFT",
    tags: [config.shopify.bowlTag, TEST_TAG],
    metafields: [
      {
        namespace: BOWL_METAFIELD_NAMESPACE,
        key: "serial",
        type: "number_integer",
        value: String(bowl.serial),
      },
      {
        namespace: BOWL_METAFIELD_NAMESPACE,
        key: "image_url",
        type: "url",
        value: imageUrl,
      },
      {
        namespace: BOWL_METAFIELD_NAMESPACE,
        key: "audio_url",
        type: "url",
        value: audio.audioUrl,
      },
      {
        namespace: BOWL_METAFIELD_NAMESPACE,
        key: "weight_grams",
        type: "number_integer",
        value: String(bowl.weightGrams),
      },
      {
        namespace: BOWL_METAFIELD_NAMESPACE,
        key: "height_mm",
        type: "number_integer",
        value: String(bowl.heightMm),
      },
      {
        namespace: BOWL_METAFIELD_NAMESPACE,
        key: "width_mm",
        type: "number_integer",
        value: String(bowl.widthMm),
      },
      {
        namespace: BOWL_METAFIELD_NAMESPACE,
        key: "note",
        type: "single_line_text_field",
        value: bowl.note,
      },
      {
        namespace: BOWL_METAFIELD_NAMESPACE,
        key: "frequency",
        type: "single_line_text_field",
        value: bowl.frequency,
      },
      {
        namespace: BOWL_METAFIELD_NAMESPACE,
        key: "audio_cid",
        type: "single_line_text_field",
        value: audio.cid,
      },
    ],
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants: [
      {
        optionValues: [{ optionName: "Title", name: "Default Title" }],
        sku: `TEST-AUDIO-BOWL-${String(bowl.serial).padStart(3, "0")}`,
        price: "1.00",
        inventoryPolicy: "DENY",
        inventoryItem: { tracked: false },
      },
    ],
  };

  const data = await shopifyAdminGraphql(
    config.shopify.shop,
    `mutation upsertAudioTestProduct($input: ProductSetInput!) {
      productSet(input: $input) {
        product { id handle title status }
        userErrors { field message }
      }
    }`,
    { input },
  );
  const errors: Array<{ message: string }> = data?.productSet?.userErrors ?? [];
  if (errors.length > 0) {
    throw new Error(
      `Shopify rejected test bowl ${bowl.serial}: ${errors.map(error => error.message).join(", ")}`,
    );
  }
  const id = data?.productSet?.product?.id;
  if (!id) throw new Error(`Shopify returned no product for test bowl ${bowl.serial}`);
  return { id: String(id), action: existing ? "updated" : "created" };
}

async function deleteTestProduct(product: ShopifyProductSummary): Promise<void> {
  const isSafeTestProduct =
    product.tags.includes(TEST_TAG) &&
    product.handle.startsWith(`${TEST_HANDLE_PREFIX}-`) &&
    product.title.startsWith("[TEST]");
  if (!isSafeTestProduct) {
    throw new Error(`Refusing to delete product that is not a recognized audio test bowl: ${product.title}`);
  }

  const data = await shopifyAdminGraphql(
    config.shopify.shop,
    `mutation deleteAudioTestProduct($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        deletedProductId
        userErrors { field message }
      }
    }`,
    { input: { id: product.id } },
  );
  const errors: Array<{ message: string }> = data?.productDelete?.userErrors ?? [];
  if (errors.length > 0) {
    throw new Error(
      `Shopify rejected deletion of ${product.title}: ${errors.map(error => error.message).join(", ")}`,
    );
  }
  if (data?.productDelete?.deletedProductId !== product.id) {
    throw new Error(`Shopify did not confirm deletion of ${product.title}`);
  }
}

async function main(): Promise<void> {
  if (!config.shopify.shop) throw new Error("Missing SHOPIFY_SHOP");
  if (!config.shopify.adminAccessToken) throw new Error("Missing SHOPIFY_ADMIN_ACCESS_TOKEN");

  const dryRun = process.argv.includes("--dry-run");
  const deleteMode = process.argv.includes("--delete");
  const products = await listShopifyBowls();

  if (deleteMode) {
    const testProducts = products.filter(product => product.tags.includes(TEST_TAG));
    if (testProducts.length === 0) {
      console.log("No Shopify audio test bowls found.");
      return;
    }

    for (const product of testProducts) {
      if (dryRun) {
        console.log(`[dry-run] delete ${product.title}: ${product.id}`);
        continue;
      }
      await deleteTestProduct(product);
      console.log(`deleted ${product.title}: ${product.id}`);
    }
    return;
  }

  const audioEntries = loadAudioManifest();
  const missingAudio = testBowls.filter(bowl => !audioEntries.has(bowl.serial));
  if (missingAudio.length > 0) {
    throw new Error(`Missing uploaded audio for bowls: ${missingAudio.map(bowl => bowl.serial).join(", ")}`);
  }

  const targetSerials = new Set(testBowls.map(bowl => bowl.serial));
  assertNoRealProductCollisions(products, targetSerials);
  const images = mockImageUrls(products);
  const existingByHandle = new Map(products.map(product => [product.handle, product]));

  console.log(`Validated ${testBowls.length} isolated Shopify test products.`);
  for (const [index, bowl] of testBowls.entries()) {
    const audio = audioEntries.get(bowl.serial)!;
    const imageUrl = images[index % images.length];
    const existing = existingByHandle.get(testHandle(bowl.serial));
    if (dryRun) {
      console.log(
        `[dry-run] ${existing ? "update" : "create"} test bowl ${bowl.serial}: ${audio.audioUrl}`,
      );
      continue;
    }

    const result = await upsertTestProduct({ bowl, audio, imageUrl, existing });
    console.log(
      `${result.action} test bowl ${bowl.serial}: ${result.id} -> ${audio.audioUrl}`,
    );
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
