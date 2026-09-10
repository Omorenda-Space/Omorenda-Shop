import jwt, { type JwtPayload } from "jsonwebtoken";
import { config } from "../config/config";

type BasePayload = { sub: string; email: string };
export type AccessPayload = BasePayload & { type: "access" };
export type RefreshPayload = BasePayload & { type: "refresh"; sid: string };

const commonSignOptions = {
  algorithm: "HS256" as const,
  issuer: config.auth.issuer,
  audience: config.auth.audience,
};

export function signAccessToken(payload: BasePayload): string {
  requireSecret(config.auth.accessTokenSecret, "AUTH_ACCESS_TOKEN_SECRET");
  return jwt.sign({ ...payload, type: "access" }, config.auth.accessTokenSecret, {
    ...commonSignOptions,
    expiresIn: config.auth.accessTokenMaxAgeSec,
  });
}

export function signRefreshToken(payload: BasePayload & { sid: string }): string {
  requireSecret(config.auth.refreshTokenSecret, "AUTH_REFRESH_TOKEN_SECRET");
  return jwt.sign({ ...payload, type: "refresh" }, config.auth.refreshTokenSecret, {
    ...commonSignOptions,
    expiresIn: config.auth.refreshTokenMaxAgeSec,
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return verifyTypedToken(token, config.auth.accessTokenSecret, "access") as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const payload = verifyTypedToken(token, config.auth.refreshTokenSecret, "refresh");
  if (typeof payload.sid !== "string" || !payload.sid) throw new Error("Refresh token missing sid");
  return payload as RefreshPayload;
}

function verifyTypedToken(token: string, secret: string, expectedType: "access" | "refresh"): JwtPayload & { sub: string; email: string; type: "access" | "refresh"; sid?: unknown } {
  requireSecret(secret, expectedType === "access" ? "AUTH_ACCESS_TOKEN_SECRET" : "AUTH_REFRESH_TOKEN_SECRET");
  const decoded = jwt.verify(token, secret, {
    algorithms: ["HS256"],
    issuer: config.auth.issuer,
    audience: config.auth.audience,
  }) as JwtPayload;
  if (decoded.type !== expectedType || typeof decoded.sub !== "string" || typeof decoded.email !== "string") {
    throw new Error(`Invalid ${expectedType} token`);
  }
  return { ...decoded, sub: decoded.sub, email: decoded.email, type: expectedType };
}

function requireSecret(value: string, name: string) {
  if (!value) throw new Error(`Missing ${name}`);
}
