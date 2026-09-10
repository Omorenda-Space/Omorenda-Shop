import { Router } from "express";
import { logout, me, refresh } from "../controllers/authController";
import { googleZkLogin } from "../controllers/googleAuthController";
import { rateLimit } from "express-rate-limit";

export const authRoutes = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

authRoutes.use(authLimiter);

authRoutes.post("/refresh-token", refresh);
authRoutes.post("/logout", logout);
authRoutes.get("/me", me);
authRoutes.post("/google/zklogin", googleZkLogin);

