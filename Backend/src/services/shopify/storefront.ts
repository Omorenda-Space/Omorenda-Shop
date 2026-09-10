import { config } from "../../config/config";
import { logger } from "../../utils/logger";
import type { StoreProduct } from "./types";

type ShopifyProductsResponse = {
  data?: {
    products: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          handle: string;
          description: string;
          descriptionHtml: string;
          availableForSale: boolean;
          onlineStoreUrl: string | null;
          priceRange: {
            minVariantPrice: { amount: string; currencyCode: string };
            maxVariantPrice: { amount: string; currencyCode: string };
          };
          images: { edges: Array<{ node: { url: string; altText: string | null } }> };
          variants: {
            edges: Array<{
              node: {
                id: string;
                title: string;
                availableForSale: boolean;
                quantityAvailable: number | null;
                price: { amount: string; currencyCode: string };
              };
            }>;
          };
        };
        cursor: string;
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
  errors?: Array<{ message: string }>;
};

const SHOPIFY_REQUEST_TIMEOUT_MS = 10_000;

const STORE_PRODUCT_FIELDS = `
  id
  title
  handle
  description
  descriptionHtml
  availableForSale
  onlineStoreUrl
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  images(first: 5) {
    edges { node { url altText } }
  }
  variants(first: 100) {
    edges {
      node {
        id
        title
        availableForSale
        quantityAvailable
        price { amount currencyCode }
      }
    }
  }
`;

export async function fetchShopifyStoreProducts(
  limit: number = 12,
  cursor?: string,
): Promise<{ products: StoreProduct[]; hasNextPage: boolean; endCursor: string | null }> {
  const empty = { products: [], hasNextPage: false, endCursor: null };

  if (!config.shopify.shop || !config.shopify.storefrontPrivateToken) {
    logger.warn("[SHOPIFY] missing shop/storefront token; skipping product fetch");
    return empty;
  }

  const query = `
    query($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          node { ${STORE_PRODUCT_FIELDS} }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const variables: { first: number; after?: string } = { first: limit };
  if (cursor) variables.after = cursor;

  const endpoint = `https://${config.shopify.shop}/api/${config.shopify.apiVersion}/graphql.json`;
  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(SHOPIFY_REQUEST_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      // Storefront API expects X-Shopify-Storefront-Access-Token for custom apps.
      // Keep the private-token header as a fallback for older setups.
      "X-Shopify-Storefront-Access-Token": config.shopify.storefrontPrivateToken,
      "Shopify-Storefront-Private-Token": config.shopify.storefrontPrivateToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    logger.error(`[SHOPIFY] Storefront returned ${response.status}: ${response.statusText}`);
    return empty;
  }

  const json = (await response.json()) as ShopifyProductsResponse;
  if (json.errors?.length) {
    logger.warn({ errors: json.errors }, "[SHOPIFY] Storefront GraphQL returned errors");
  }

  const edges = json.data?.products?.edges ?? [];
  const pageInfo = json.data?.products?.pageInfo ?? { hasNextPage: false, endCursor: null };

  const products: StoreProduct[] = edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    handle: node.handle,
    description: node.description,
    descriptionHtml: node.descriptionHtml,
    availableForSale: node.availableForSale,
    shopifyUrl: node.onlineStoreUrl,
    price: {
      min: node.priceRange.minVariantPrice,
      max: node.priceRange.maxVariantPrice,
    },
    images: node.images.edges.map(e => ({ url: e.node.url, altText: e.node.altText })),
    variants: node.variants.edges.map(e => ({
      id: e.node.id,
      title: e.node.title,
      availableForSale: e.node.availableForSale,
      quantityAvailable: typeof e.node.quantityAvailable === "number" ? e.node.quantityAvailable : null,
      price: e.node.price,
    })),
  }));

  return {
    products,
    hasNextPage: pageInfo.hasNextPage,
    endCursor: pageInfo.endCursor,
  };
}

