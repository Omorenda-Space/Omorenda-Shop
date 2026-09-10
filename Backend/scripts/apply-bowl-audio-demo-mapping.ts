/**
 * Apply the reviewed demo-only bowl/audio mapping to existing Shopify products.
 *
 * The physical dimensions were selected from Bowl_Dimensions_Updated.xlsx.
 * The recording number is used as the unique storefront serial. Existing
 * Shopify titles, images, prices, inventory, descriptions, and variants are
 * preserved.
 *
 * Usage (from Backend):
 *   npm run bowls:audio:apply-demo
 *   npm run bowls:audio:apply-demo -- --apply
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config/config";
import { shopifyAdminGraphql } from "../src/services/shopify/admin";
import { BOWL_METAFIELD_NAMESPACE } from "../src/services/shopify/bowls";

const manifestPath = path.resolve("data", "bowl-audio-ipfs", "audio-upload-manifest.json");

type DemoMapping = {
  recording: number;
  productId: string;
  expectedTitle: string;
  expectedHandle: string;
  source: string;
  weightGrams: number;
  heightMm: number;
  widthMm: number;
  note: string;
  frequency: string;
};

type AudioManifestEntry = {
  bowlNumber: number;
  cid: string;
  audioUrl: string;
};

type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  tags: string[];
  featuredImage: { url: string } | null;
  metafields: {
    nodes: Array<{ key: string; type: string; value: string }>;
  };
};

const demoMappings: DemoMapping[] = [
  {
    recording: 1,
    productId: "gid://shopify/Product/7754248847473",
    expectedTitle: "Healing Resonance #001",
    expectedHandle: "singing-bowl-001",
    source: "Plane Bowl row 3",
    weightGrams: 1800,
    heightMm: 100,
    widthMm: 230,
    note: "C3",
    frequency: "128",
  },
  {
    recording: 2,
    productId: "gid://shopify/Product/7754248913009",
    expectedTitle: "Healing Resonance #002",
    expectedHandle: "singing-bowl-002",
    source: "Plane Bowl row 4",
    weightGrams: 1700,
    heightMm: 100,
    widthMm: 230,
    note: "B2",
    frequency: "121",
  },
  {
    recording: 3,
    productId: "gid://shopify/Product/7754248945777",
    expectedTitle: "Healing Resonance #003",
    expectedHandle: "singing-bowl-003",
    source: "Plane Bowl row 5",
    weightGrams: 1690,
    heightMm: 110,
    widthMm: 240,
    note: "B2",
    frequency: "121",
  },
  {
    recording: 21,
    productId: "gid://shopify/Product/7778621259889",
    expectedTitle: "Singing Bowls C3",
    expectedHandle: "singing-bowl-c3",
    source: "Plane Bowl row 23",
    weightGrams: 1450,
    heightMm: 110,
    widthMm: 230,
    note: "C3",
    frequency: "128",
  },
  {
    recording: 22,
    productId: "gid://shopify/Product/7779100295281",
    expectedTitle: "Singing Bowls G3",
    expectedHandle: "singing-bowl-g3",
    source: "Plane Bowl row 42",
    weightGrams: 1390,
    heightMm: 100,
    widthMm: 210,
    note: "G3",
    frequency: "192",
  },
  {
    recording: 23,
    productId: "gid://shopify/Product/7779133653105",
    expectedTitle: "Singing Bowls C#3",
    expectedHandle: "singing-bowl-c-3",
    source: "Plane Bowl row 11",
    weightGrams: 1570,
    heightMm: 100,
    widthMm: 230,
    note: "C#3",
    frequency: "136",
  },
  {
    recording: 24,
    productId: "gid://shopify/Product/7779058385009",
    expectedTitle: "Singing Bowls A#2",
    expectedHandle: "singing-bolw-a-2",
    source: "Plane Bowl row 26",
    weightGrams: 1630,
    heightMm: 110,
    widthMm: 230,
    note: "A#2",
    frequency: "114",
  },
  {
    recording: 30,
    productId: "gid://shopify/Product/7779043967089",
    expectedTitle: "Singing Bowls B2",
    expectedHandle: "singing-bowl",
    source: "Plane Bowl row 32",
    weightGrams: 1910,
    heightMm: 110,
    widthMm: 240,
    note: "B2",
    frequency: "121",
  },
  {
    recording: 31,
    productId: "gid://shopify/Product/7779142008945",
    expectedTitle: "Singing Bowls F#3",
    expectedHandle: "singing-bowl-f-3",
    source: "Plane Bowl row 36",
    weightGrams: 1250,
    heightMm: 90,
    widthMm: 220,
    note: "F#3",
    frequency: "181",
  },
  {
    recording: 34,
    productId: "gid://shopify/Product/7779085320305",
    expectedTitle: "Singing Bowls D#3",
    expectedHandle: "singing-bowl-d-3",
    source: "Plane Bowl row 38",
    weightGrams: 1170,
    heightMm: 90,
    widthMm: 210,
    note: "D#3",
    frequency: "152",
  },
  {
    recording: 35,
    productId: "gid://shopify/Product/7779179593841",
    expectedTitle: "Singing Bowls C#5",
    expectedHandle: "singing-bowl-c-5",
    source: "Plane Bowl row 44",
    weightGrams: 1550,
    heightMm: 100,
    widthMm: 230,
    note: "C#5",
    frequency: "544",
  },
  {
    recording: 43,
    productId: "gid://shopify/Product/7779245588593",
    expectedTitle: "Singing Bowls C5",
    expectedHandle: "singing-bowl-c5",
    source: "Plane Bowl row 35",
    weightGrams: 1330,
    heightMm: 120,
    widthMm: 200,
    note: "C5",
    frequency: "513",
  },
  {
    recording: 49,
    productId: "gid://shopify/Product/7779150856305",
    expectedTitle: "Singing Bowls E3",
    expectedHandle: "singing-bowl-e3",
    source: "Art Bowl row 9",
    weightGrams: 1240,
    heightMm: 100,
    widthMm: 190,
    note: "E3",
    frequency: "161",
  },
  {
    recording: 55,
    productId: "gid://shopify/Product/7779088334961",
    expectedTitle: "Singing Bowls A2",
    expectedHandle: "singing-bowl-a2",
    source: "Plane Bowl row 20",
    weightGrams: 1440,
    heightMm: 95,
    widthMm: 240,
    note: "A2",
    frequency: "108",
  },
  {
    recording: 58,
    productId: "gid://shopify/Product/7779336847473",
    expectedTitle: "Singing Bowls E#4",
    expectedHandle: "singing-bowl-e4-1",
    source: "Plane Bowl row 27",
    weightGrams: 1750,
    heightMm: 100,
    widthMm: 230,
    note: "E#4",
    frequency: "342",
  },
];

function loadAudioManifest(): Map<number, AudioManifestEntry> {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Audio manifest not found: ${manifestPath}`);
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("Audio manifest must contain an array");
  }

  const result = new Map<number, AudioManifestEntry>();
  for (const raw of parsed) {
    const entry = raw as Partial<AudioManifestEntry>;
    if (
      !Number.isInteger(entry.bowlNumber) ||
      typeof entry.cid !== "string" ||
      !entry.cid ||
      typeof entry.audioUrl !== "string" ||
      !entry.audioUrl.startsWith("https://")
    ) {
      throw new Error("Audio manifest contains an invalid entry");
    }
    result.set(entry.bowlNumber!, entry as AudioManifestEntry);
  }
  return result;
}

async function fetchProducts(ids: string[]): Promise<ShopifyProduct[]> {
  const data = await shopifyAdminGraphql(
    config.shopify.shop,
    `query demoBowlProducts($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          handle
          tags
          featuredImage { url }
          metafields(first: 30, namespace: "${BOWL_METAFIELD_NAMESPACE}") {
            nodes { key type value }
          }
        }
      }
    }`,
    { ids },
  );
  return (data?.nodes ?? []).filter(Boolean) as ShopifyProduct[];
}

async function assertNoSerialCollisions(): Promise<void> {
  const data = await shopifyAdminGraphql(
    config.shopify.shop,
    `query existingDemoSerials($search: String!) {
      products(first: 100, query: $search) {
        nodes {
          id
          title
          serial: metafield(namespace: "${BOWL_METAFIELD_NAMESPACE}", key: "serial") {
            value
          }
        }
      }
    }`,
    { search: `tag:'${config.shopify.bowlTag}'` },
  );
  const targetBySerial = new Map(demoMappings.map(mapping => [mapping.recording, mapping.productId]));
  const collisions = (data?.products?.nodes ?? []).filter(
    (product: { id: string; serial: { value: string } | null }) => {
      const serial = Number(product.serial?.value);
      const intendedProduct = targetBySerial.get(serial);
      return intendedProduct && intendedProduct !== product.id;
    },
  );
  if (collisions.length > 0) {
    throw new Error(
      `Refusing to apply mapping because serials already belong to other products: ${collisions
        .map((product: { title: string; serial: { value: string } }) =>
          `${product.serial.value} (${product.title})`,
        )
        .join(", ")}`,
    );
  }
}

function validateTargets(products: ShopifyProduct[], audioByRecording: Map<number, AudioManifestEntry>) {
  const productById = new Map(products.map(product => [product.id, product]));
  const uniqueProductIds = new Set(demoMappings.map(mapping => mapping.productId));
  const uniqueRecordings = new Set(demoMappings.map(mapping => mapping.recording));
  if (uniqueProductIds.size !== demoMappings.length || uniqueRecordings.size !== demoMappings.length) {
    throw new Error("Demo mapping contains duplicate product IDs or recording numbers");
  }

  for (const mapping of demoMappings) {
    const product = productById.get(mapping.productId);
    if (!product) throw new Error(`Shopify product not found: ${mapping.productId}`);
    if (product.title !== mapping.expectedTitle || product.handle !== mapping.expectedHandle) {
      throw new Error(
        `Product identity changed for recording ${mapping.recording}: expected ` +
          `${mapping.expectedTitle} (${mapping.expectedHandle}), found ` +
          `${product.title} (${product.handle})`,
      );
    }
    if (!product.featuredImage?.url?.startsWith("https://")) {
      throw new Error(`Product ${product.title} has no usable featured image`);
    }
    if (!audioByRecording.has(mapping.recording)) {
      throw new Error(`No uploaded IPFS audio found for recording ${mapping.recording}`);
    }
  }
}

function metafieldsFor(
  mapping: DemoMapping,
  product: ShopifyProduct,
  audio: AudioManifestEntry,
) {
  const existingImageUrl = product.metafields.nodes.find(field => field.key === "image_url")?.value;
  return [
    {
      namespace: BOWL_METAFIELD_NAMESPACE,
      key: "serial",
      type: "number_integer",
      value: String(mapping.recording),
    },
    {
      namespace: BOWL_METAFIELD_NAMESPACE,
      key: "image_url",
      type: "url",
      value: existingImageUrl || product.featuredImage!.url,
    },
    {
      namespace: BOWL_METAFIELD_NAMESPACE,
      key: "audio_url",
      type: "url",
      value: audio.audioUrl,
    },
    {
      namespace: BOWL_METAFIELD_NAMESPACE,
      key: "audio_cid",
      type: "single_line_text_field",
      value: audio.cid,
    },
    {
      namespace: BOWL_METAFIELD_NAMESPACE,
      key: "weight_grams",
      type: "number_integer",
      value: String(mapping.weightGrams),
    },
    {
      namespace: BOWL_METAFIELD_NAMESPACE,
      key: "height_mm",
      type: "number_integer",
      value: String(mapping.heightMm),
    },
    {
      namespace: BOWL_METAFIELD_NAMESPACE,
      key: "width_mm",
      type: "number_integer",
      value: String(mapping.widthMm),
    },
    {
      namespace: BOWL_METAFIELD_NAMESPACE,
      key: "note",
      type: "single_line_text_field",
      value: mapping.note,
    },
    {
      namespace: BOWL_METAFIELD_NAMESPACE,
      key: "frequency",
      type: "single_line_text_field",
      value: mapping.frequency,
    },
  ];
}

async function updateProduct(
  mapping: DemoMapping,
  product: ShopifyProduct,
  audio: AudioManifestEntry,
): Promise<void> {
  const data = await shopifyAdminGraphql(
    config.shopify.shop,
    `mutation applyDemoBowlMetadata($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id title tags }
        userErrors { field message }
      }
    }`,
    {
      input: {
        id: product.id,
        tags: [...new Set([...product.tags, config.shopify.bowlTag])],
        metafields: metafieldsFor(mapping, product, audio),
      },
    },
  );
  const errors: Array<{ message: string }> = data?.productUpdate?.userErrors ?? [];
  if (errors.length > 0) {
    throw new Error(
      `Shopify rejected ${product.title}: ${errors.map(error => error.message).join(", ")}`,
    );
  }
  if (data?.productUpdate?.product?.id !== product.id) {
    throw new Error(`Shopify did not confirm update of ${product.title}`);
  }
}

function verifyAppliedMetadata(
  products: ShopifyProduct[],
  audioByRecording: Map<number, AudioManifestEntry>,
): void {
  const productById = new Map(products.map(product => [product.id, product]));
  for (const mapping of demoMappings) {
    const product = productById.get(mapping.productId);
    if (!product) throw new Error(`Updated product disappeared: ${mapping.expectedTitle}`);
    if (!product.tags.includes(config.shopify.bowlTag)) {
      throw new Error(`Required tag is missing after update: ${product.title}`);
    }
    const actual = new Map(product.metafields.nodes.map(field => [field.key, field.value]));
    const expected = metafieldsFor(mapping, product, audioByRecording.get(mapping.recording)!);
    for (const field of expected) {
      if (actual.get(field.key) !== field.value) {
        throw new Error(
          `Verification failed for ${product.title} metafield ${field.key}: ` +
            `expected ${field.value}, received ${actual.get(field.key) ?? "<missing>"}`,
        );
      }
    }
  }
}

async function main(): Promise<void> {
  if (!config.shopify.shop) throw new Error("Missing SHOPIFY_SHOP");
  if (!config.shopify.adminAccessToken) throw new Error("Missing SHOPIFY_ADMIN_ACCESS_TOKEN");

  const apply = process.argv.includes("--apply");
  const audioByRecording = loadAudioManifest();
  const products = await fetchProducts(demoMappings.map(mapping => mapping.productId));
  validateTargets(products, audioByRecording);
  await assertNoSerialCollisions();

  const productById = new Map(products.map(product => [product.id, product]));
  for (const mapping of demoMappings) {
    const product = productById.get(mapping.productId)!;
    const audio = audioByRecording.get(mapping.recording)!;
    if (!apply) {
      console.log(
        `[dry-run] recording ${mapping.recording} -> ${product.title}; ` +
          `${mapping.weightGrams}g ${mapping.heightMm}x${mapping.widthMm}mm; ${mapping.source}`,
      );
      continue;
    }
    await updateProduct(mapping, product, audio);
    console.log(`updated recording ${mapping.recording} -> ${product.title}`);
  }

  if (!apply) {
    console.log(`Validated ${demoMappings.length} demo mappings. Re-run with --apply to update Shopify.`);
    return;
  }

  const updatedProducts = await fetchProducts(demoMappings.map(mapping => mapping.productId));
  verifyAppliedMetadata(updatedProducts, audioByRecording);
  console.log(`Verified ${demoMappings.length} Shopify demo bowl products.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
