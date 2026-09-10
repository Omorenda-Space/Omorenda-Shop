import type { Request, Response } from "express";
import { prisma } from "../config/db";
import { authCookieNames, clearAuthCookies, readCookie } from "../auth/cookies";
import { verifyAccessToken } from "../auth/tokens";
import { revokeSession, rotateSession } from "../auth/sessions";

export function toAuthUser(user: { id: string; email: string; suiAddress: string | null }) {
  return { id: user.id, email: user.email, hasSuiWallet: Boolean(user.suiAddress) };
}

export async function me(req: Request, res: Response) {
  const access = readCookie(req, authCookieNames.access);
  if (!access) return void res.status(200).json({ user: null });
  try {
    const payload = verifyAccessToken(access);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    res.status(200).json({ user: user ? toAuthUser(user) : null });
  } catch {
    res.status(200).json({ user: null });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const user = await rotateSession(req, res);
    if (!user) {
      clearAuthCookies(res);
      return void res.status(401).json({ message: "Not authenticated" });
    }
    res.status(200).json({ user: toAuthUser(user) });
  } catch {
    clearAuthCookies(res);
    res.status(401).json({ message: "Not authenticated" });
  }
}

export async function logout(req: Request, res: Response) {
  await revokeSession(req, res);
  res.status(200).json({ ok: true });
}
