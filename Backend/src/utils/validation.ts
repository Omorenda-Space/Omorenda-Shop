import type { Response } from "express";
import type { ZodType } from "zod";
import { config } from "../config/config";

export function parseOrRespond<T>(schema: ZodType<T>, value: unknown, res: Response): T | null {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  res.status(400).json({
    code: "VALIDATION_ERROR",
    message: "The request contains invalid data",
    issues: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })),
  });
  return null;
}

export function trustedRedirectUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (!config.frontendOrigins.includes(url.origin)) throw new Error("untrusted origin");
    return value;
  } catch {
    return fallback;
  }
}

export function errorMessage(error: unknown, max = 1000) {
  return (error instanceof Error ? error.message : String(error)).slice(0, max);
}
