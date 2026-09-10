import { Router } from "express";
import { listBowls, getBowlBySerial } from "../controllers/bowlsController";
import { createBowlCheckoutSession } from "../controllers/bowlCheckoutController";
import { listMyNfts } from "../controllers/nftController";
import { requireAuth } from "../auth/middleware";
import { rateLimit } from "express-rate-limit";

export const bowlRoutes = Router();
const bowlCheckoutLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });

bowlRoutes.get("/bowls", listBowls);
bowlRoutes.get("/bowls/:serial", getBowlBySerial);
bowlRoutes.post("/bowls/checkout/session", bowlCheckoutLimiter, requireAuth, createBowlCheckoutSession);
bowlRoutes.get("/users/me/nfts", requireAuth, listMyNfts);
