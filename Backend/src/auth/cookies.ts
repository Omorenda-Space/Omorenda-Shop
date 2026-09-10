import type { Response, Request } from "express";
import { config } from "../config/config";
import { parse } from "cookie";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

function cookieBaseOptions() {
  return {
    httpOnly: true,
    sameSite: config.auth.cookieSameSite,
    secure: config.env === "production" || config.auth.cookieSameSite === "none",
    path: "/",
    priority: "high" as const,
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieBaseOptions(),
    maxAge: config.auth.accessTokenMaxAgeSec * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieBaseOptions(),
    maxAge: config.auth.refreshTokenMaxAgeSec * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.cookie(ACCESS_COOKIE, "", { ...cookieBaseOptions(), maxAge: 0 });
  res.cookie(REFRESH_COOKIE, "", { ...cookieBaseOptions(), maxAge: 0 });
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  const parsed = parse(header);
  const value = parsed[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export const authCookieNames = {
  access: ACCESS_COOKIE,
  refresh: REFRESH_COOKIE,
};

