import type { Request, Response, NextFunction } from "express";
import { readCookie, authCookieNames } from "./cookies";
import { verifyAccessToken } from "./tokens";

export type AuthedRequest = Request & { user?: { id: string; email: string } };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = readCookie(req, authCookieNames.access);
  if (!token) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ message: "Not authenticated" });
  }
}

