import type { NextFunction, Request, Response } from "express";
import { config } from "../config/config";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin || !config.frontendOrigins.includes(origin)) {
    res.status(403).json({ code: "UNTRUSTED_ORIGIN", message: "Request origin is not allowed" });
    return;
  }
  next();
}

export function corsOrigin(origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) {
  if (!origin || config.frontendOrigins.includes(origin)) return callback(null, true);
  callback(null, false);
}
