import type { Response } from "express";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { getStripeClient, isStripeCredentialError } from "../services/stripe/client";
import { buildItemsMetadata } from "../utils/stripeMetadata";
import { centsToDecimalString, fetchVariantPricing, normalizeOrderItems, priceOrderItems } from "../services/pricing";
import { config } from "../config/config";
import type { AuthedRequest } from "../auth/middleware";
import { logger } from "../utils/logger";
import { prisma } from "../config/db";
import { z } from "zod";
import { parseOrRespond, trustedRedirectUrl } from "../utils/validation";

const checkoutSchema = z.object({
  items: z.array(z.object({ variantGid: z.string().trim().min(1).max(250), quantity: z.number().int().min(1).max(20) })).min(1).max(25),
  successUrl: z.string().url().max(1000).optional(),
  cancelUrl: z.string().url().max(1000).optional(),
});

export async function createCheckoutSession(req: AuthedRequest, res: Response) {
  const body = parseOrRespond(checkoutSchema, req.body ?? {}, res);
  if (!body) return;
  const { items, successUrl, cancelUrl } = body;

  const email = req.user?.email ?? null;
  if (!email) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const { error, items: normalizedItems } = normalizeOrderItems(items);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  const variantGids = normalizedItems.map(i => i.variantGid);
  const { variants, missing } = await fetchVariantPricing(variantGids);
  if (missing.length > 0) {
    res.status(409).json({ message: "Product price unavailable", missing });
    return;
  }

  const currency = "USD";
  const priced = priceOrderItems({ items: normalizedItems, variants, currency });
  if (priced.totals.totalCents <= 0) {
    res.status(400).json({ message: "Order total must be greater than zero" });
    return;
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priced.items.map(item => ({
    price_data: {
      currency: currency.toLowerCase(),
      product_data: { name: item.title ?? item.variantGid },
      unit_amount: item.discountedUnitAmountCents,
    },
    quantity: item.quantity,
  }));

  let session: Stripe.Checkout.Session;
  try {
    const stripe = getStripeClient();
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      shipping_address_collection: {
        allowed_countries: ["US", "CA"],
      },
      phone_number_collection: { enabled: true },
      line_items: lineItems,
      success_url: trustedRedirectUrl(successUrl, `${config.frontendUrl}/orders/success?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: trustedRedirectUrl(cancelUrl, `${config.frontendUrl}/orders/cancel`),
      metadata: {
        email,
        userId: req.user!.id,
        flow: "product_purchase",
        ...buildItemsMetadata(normalizedItems),
      },
    });
  } catch (error) {
    const credentialError = isStripeCredentialError(error);
    logger.error(
      {
        err: error instanceof Error ? error.message : String(error),
        stripeErrorType:
          error && typeof error === "object" && "type" in error ? String(error.type) : undefined,
      },
      credentialError
        ? "[CHECKOUT] Stripe credentials are missing, invalid, or revoked"
        : "[CHECKOUT] Stripe session creation failed",
    );
    res.status(credentialError ? 503 : 502).json({
      code: credentialError ? "PAYMENT_PROVIDER_AUTH_ERROR" : "PAYMENT_PROVIDER_ERROR",
      message: credentialError
        ? "Payment is temporarily unavailable. The store administrator has been notified."
        : "Unable to start payment. Please try again.",
    });
    return;
  }

  try {
    await prisma.order.create({
      data: {
        email,
        userId: req.user!.id,
        stripeSessionId: session.id,
        status: "PENDING",
        paymentStatus: "PENDING",
        shopifyStatus: "NOT_STARTED",
        currency,
        subtotal: new Prisma.Decimal(centsToDecimalString(priced.totals.subtotalCents, currency)),
        discountAmount: new Prisma.Decimal(
          centsToDecimalString(priced.totals.discountAmountCents, currency),
        ),
        total: new Prisma.Decimal(centsToDecimalString(priced.totals.totalCents, currency)),
        items: {
          create: priced.items.map(item => ({
            shopifyVariantGid: item.variantGid,
            title: item.title,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(
              centsToDecimalString(item.discountedUnitAmountCents, currency),
            ),
            discountApplied: new Prisma.Decimal(
              centsToDecimalString(item.discountAppliedCents, currency),
            ),
            lineTotal: new Prisma.Decimal(centsToDecimalString(item.lineTotalCents, currency)),
          })),
        },
      },
    });
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error), stripeSessionId: session.id },
      "[CHECKOUT] failed to save pending order; expiring Stripe session",
    );
    try {
      await getStripeClient().checkout.sessions.expire(session.id);
    } catch (expireError) {
      logger.error(
        {
          err: expireError instanceof Error ? expireError.message : String(expireError),
          stripeSessionId: session.id,
        },
        "[CHECKOUT] failed to expire orphaned Stripe session",
      );
    }
    res.status(500).json({
      code: "ORDER_INITIALIZATION_FAILED",
      message: "Unable to prepare your order. Please try again.",
    });
    return;
  }

  res.status(200).json({
    sessionId: session.id,
    url: session.url,
    totals: {
      subtotal: Number(centsToDecimalString(priced.totals.subtotalCents, currency)),
      discountAmount: Number(centsToDecimalString(priced.totals.discountAmountCents, currency)),
      total: Number(centsToDecimalString(priced.totals.totalCents, currency)),
      currency,
    },
  });
}

