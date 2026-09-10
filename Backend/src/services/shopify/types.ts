export type StoreProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  price: { amount: string; currencyCode: string };
};

export type StoreProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  availableForSale: boolean;
  shopifyUrl: string | null;
  price: {
    min: { amount: string; currencyCode: string };
    max: { amount: string; currencyCode: string };
  };
  images: Array<{ url: string; altText: string | null }>;
  variants: StoreProductVariant[];
};

