import type { Request, Response } from "express";
import { fetchShopifyStoreProducts } from "../services/shopify/storefront";

export async function listProducts(req: Request, res: Response) {
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(250, Number(limitRaw))) : 12;
  const cursor = typeof req.query.cursor === "string" && req.query.cursor ? req.query.cursor : undefined;

  const result = await fetchShopifyStoreProducts(limit, cursor);
  res.status(200).json(result);
}

