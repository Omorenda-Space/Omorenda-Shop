import { Router } from "express";
import express from "express";
import { handleStripeWebhook } from "../controllers/stripeWebhookController";

export const webhookRoutes = Router();

// Stripe requires raw request body for signature verification.
webhookRoutes.post("/stripe", express.raw({ type: "application/json", limit: "256kb" }), handleStripeWebhook);

