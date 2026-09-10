const MAX_METADATA_VALUE_LENGTH = 500;

type OrderItemTuple = [variantGid: string, quantity: number];

export interface OrderItemInput {
  variantGid: string;
  quantity: number;
}

export function buildItemsMetadata(items: OrderItemInput[]): Record<string, string> {
  const tuples: OrderItemTuple[] = items.map(i => [i.variantGid, i.quantity]);
  const full = JSON.stringify(tuples);

  if (full.length <= MAX_METADATA_VALUE_LENGTH) {
    return { items: full };
  }

  const result: Record<string, string> = {};
  let chunkIndex = 0;
  let current: OrderItemTuple[] = [];

  for (const tuple of tuples) {
    const candidate = [...current, tuple];
    if (JSON.stringify(candidate).length > MAX_METADATA_VALUE_LENGTH) {
      result[`items_${chunkIndex}`] = JSON.stringify(current);
      chunkIndex++;
      current = [tuple];
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) {
    result[`items_${chunkIndex}`] = JSON.stringify(current);
  }

  result.items_count = String(chunkIndex + 1);
  return result;
}

export function parseItemsMetadata(
  metadata: Record<string, string> | null | undefined,
): OrderItemInput[] {
  if (!metadata) {
    return [];
  }

  const raw = readRawItemsJson(metadata);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.reduce<OrderItemInput[]>((acc, item) => {
      const entry = parseOneItem(item);
      if (entry) {
        acc.push(entry);
      }
      return acc;
    }, []);
  } catch {
    return [];
  }
}

function readRawItemsJson(metadata: Record<string, string>): string | undefined {
  if (typeof metadata.items === "string" && metadata.items.length > 0) {
    return metadata.items;
  }

  if (typeof metadata.items_count !== "string") {
    return undefined;
  }

  const count = Number(metadata.items_count);
  if (!Number.isFinite(count) || count <= 0) {
    return undefined;
  }

  const innerParts: string[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = metadata[`items_${i}`];
    if (typeof chunk !== "string") {
      return undefined;
    }
    innerParts.push(chunk.slice(1, -1));
  }

  return `[${innerParts.join(",")}]`;
}

function parseOneItem(item: unknown): OrderItemInput | null {
  let variantGid: string | null = null;
  let quantity = 0;

  if (Array.isArray(item)) {
    variantGid = typeof item[0] === "string" ? item[0] : null;
    quantity = typeof item[1] === "number" && Number.isFinite(item[1]) ? Math.floor(item[1]) : 0;
  } else if (item && typeof item === "object") {
    const obj = item as Record<string, unknown>;
    variantGid = typeof obj.variantGid === "string" ? obj.variantGid : null;
    quantity =
      typeof obj.quantity === "number" && Number.isFinite(obj.quantity)
        ? Math.floor(obj.quantity)
        : 0;
  }

  if (!variantGid || quantity <= 0) {
    return null;
  }

  return { variantGid, quantity };
}

