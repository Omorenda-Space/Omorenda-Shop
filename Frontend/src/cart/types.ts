export type CartItem = {
  productId: string; // Shopify product GID
  productHandle: string;
  title: string;
  imageUrl: string | null;
  currency: string;
  unitAmount: number; // from storefront, used for UI display only (server re-prices)
  variantGid: string;
  variantTitle: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  quantity: number;
};

