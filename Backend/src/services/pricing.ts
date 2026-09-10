import { Prisma } from "@prisma/client";
import { fetchVariantPricingFromShopify } from "./shopify/admin";
import { formatMinorUnits, toMinorUnits } from "../utils/currency";
import { config } from "../config/config";

export type OrderItemInput = {
  variantGid: string;
  quantity: number;
};

export type PricedOrderItem = {
  variantGid: string;
  quantity: number;
  title: string | null;
  sku: string | null;
  unitAmountCents: number;
  discountedUnitAmountCents: number;
  lineTotalCents: number;
  discountAppliedCents: number;
};

export function normalizeOrderItems(items: Array<Partial<OrderItemInput>> | undefined | null) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Provide at least one item", items: [] as OrderItemInput[] };
  }
  if (items.length > 25) {
    return { error: "An order can contain at most 25 distinct items", items: [] as OrderItemInput[] };
  }

  const itemMap = new Map<string, number>();
  for (const raw of items) {
    if (!raw || typeof raw.variantGid !== "string") {
      return { error: "Each item needs a variantGid", items: [] };
    }
    const quantity =
      typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
        ? Math.floor(raw.quantity)
        : 0;
    if (quantity <= 0 || quantity > 20) {
      return { error: "Each item quantity must be between 1 and 20", items: [] };
    }
    const variantGid = raw.variantGid.trim();
    if (!variantGid) {
      return { error: "Each item needs a variantGid", items: [] };
    }
    itemMap.set(variantGid, (itemMap.get(variantGid) ?? 0) + quantity);
    if ((itemMap.get(variantGid) ?? 0) > 20) {
      return { error: "Combined item quantity cannot exceed 20", items: [] };
    }
  }

  const normalized = Array.from(itemMap.entries()).map(([variantGid, quantity]) => ({
    variantGid,
    quantity,
  }));

  return { error: null as string | null, items: normalized };
}

export async function fetchVariantPricing(variantGids: string[]) {
  if (variantGids.length === 0) {
    return { variants: [], missing: [] as string[] };
  }

  if (!config.shopify.shop) {
    throw new Error("Missing SHOPIFY_SHOP");
  }

  return fetchVariantPricingFromShopify(config.shopify.shop, variantGids);
}

export function priceOrderItems(args: {
  items: OrderItemInput[];
  variants: Array<{
    shopifyVariantGid: string;
    title: string | null;
    sku: string | null;
    price: Prisma.Decimal | number | string;
  }>;
  discountPercent?: number;
  currency?: string;
}) {
  const currency = args.currency ?? "USD";
  const variantMap = new Map(args.variants.map(v => [v.shopifyVariantGid, v]));

  const discountRate = Math.max(0, Math.min(args.discountPercent ?? 0, 100));

  let subtotalCents = 0;
  let discountAmountCents = 0;
  const pricedItems: PricedOrderItem[] = [];

  for (const item of args.items) {
    const variant = variantMap.get(item.variantGid);
    if (!variant) {
      continue;
    }

    const unitAmountCents = toCents(variant.price, currency);
    const discountedUnitAmountCents = Math.max(
      0,
      Math.round(unitAmountCents * (1 - discountRate / 100)),
    );

    const lineSubtotal = unitAmountCents * item.quantity;
    const lineTotal = discountedUnitAmountCents * item.quantity;
    const lineDiscount = lineSubtotal - lineTotal;

    subtotalCents += lineSubtotal;
    discountAmountCents += lineDiscount;

    pricedItems.push({
      variantGid: item.variantGid,
      quantity: item.quantity,
      title: variant.title,
      sku: variant.sku,
      unitAmountCents,
      discountedUnitAmountCents,
      lineTotalCents: lineTotal,
      discountAppliedCents: lineDiscount,
    });
  }

  const totalCents = subtotalCents - discountAmountCents;

  return {
    items: pricedItems,
    totals: {
      subtotalCents,
      discountAmountCents,
      totalCents,
    },
  };
}

export function toCents(value: Prisma.Decimal | number | string, currency = "USD") {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return toMinorUnits(numeric, currency);
}

export function centsToDecimalString(cents: number, currency = "USD") {
  return formatMinorUnits(cents, currency);
}

function toNumber(value: Prisma.Decimal | number | string) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  if (typeof (value as any)?.toNumber === "function") {
    return (value as any).toNumber();
  }
  return Number((value as any).toString());
}

