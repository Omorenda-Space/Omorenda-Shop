export type StoreProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  availableForSale: boolean;
  shopifyUrl: string | null;
  price: {
    min: { amount: string; currencyCode: string };
  };
  images: Array<{ url: string; altText: string | null }>;
  variants: Array<{
    id: string;
    title: string;
    availableForSale: boolean;
    quantityAvailable?: number | null;
    price?: { amount: string; currencyCode: string };
  }>;
};

export type ProductsResponse = {
  products: StoreProduct[];
  hasNextPage: boolean;
  endCursor: string | null;
};

export async function fetchProducts(limit = 24, cursor?: string): Promise<ProductsResponse> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001/api";
  const url = new URL(`${API_BASE_URL}/products`);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  return (await res.json()) as ProductsResponse;
}

export function getFirstAvailableVariant(product: StoreProduct) {
  return product.variants.find((v) => v.availableForSale) ?? null;
}

