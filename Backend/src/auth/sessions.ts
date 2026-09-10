import crypto from "node:crypto";
import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import { prisma } from "../config/db";
import { config } from "../config/config";
import { authCookieNames, clearAuthCookies, readCookie, setAuthCookies } from "./cookies";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./tokens";

type SessionUser = Pick<User, "id" | "email">;

export async function createSession(res: Response, user: SessionUser) {
  const sid = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email, sid });
  await prisma.authSession.create({
    data: {
      id: sid,
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + config.auth.refreshTokenMaxAgeSec * 1000),
    },
  });
  setAuthCookies(res, signAccessToken({ sub: user.id, email: user.email }), refreshToken);
}

export async function rotateSession(req: Request, res: Response) {
  const token = readCookie(req, authCookieNames.refresh);
  if (!token) return null;
  const payload = verifyRefreshToken(token);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;

  const nextRefresh = signRefreshToken({ sub: user.id, email: user.email, sid: payload.sid });
  const rotated = await prisma.authSession.updateMany({
    where: {
      id: payload.sid,
      userId: user.id,
      refreshTokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      refreshTokenHash: hashToken(nextRefresh),
      expiresAt: new Date(Date.now() + config.auth.refreshTokenMaxAgeSec * 1000),
    },
  });
  if (rotated.count !== 1) return null;
  setAuthCookies(res, signAccessToken({ sub: user.id, email: user.email }), nextRefresh);
  return user;
}

export async function revokeSession(req: Request, res: Response) {
  const token = readCookie(req, authCookieNames.refresh);
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await prisma.authSession.updateMany({
        where: { id: payload.sid, refreshTokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Clearing invalid cookies is still a successful logout.
    }
  }
  clearAuthCookies(res);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
