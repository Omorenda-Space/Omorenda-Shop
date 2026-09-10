import Stripe from "stripe";
import { config } from "../../config/config";

let stripeClient: Stripe | null = null;

export class StripeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigurationError";
  }
}

export function getStripeClient(): Stripe {
  const apiKey = config.stripe.secretKey;
  if (!apiKey) {
    throw new StripeConfigurationError("Missing STRIPE_SECRET_KEY");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(apiKey);
  }

  return stripeClient;
}

export function isStripeCredentialError(error: unknown): boolean {
  if (error instanceof StripeConfigurationError) return true;
  if (error instanceof Stripe.errors.StripeAuthenticationError) return true;
  if (!error || typeof error !== "object") return false;

  const candidate = error as { type?: unknown; code?: unknown };
  return (
    candidate.type === "StripeAuthenticationError" ||
    candidate.code === "api_key_expired" ||
    candidate.code === "invalid_api_key"
  );
}

