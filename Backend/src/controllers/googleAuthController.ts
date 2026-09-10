import type { Request, Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../config/db";
import { createSession } from "../auth/sessions";
import { toAuthUser } from "./authController";
import {
  decryptSalt,
  encryptSalt,
  generateUserSalt,
  jwtToZkLoginAddress,
  verifyGoogleIdToken,
} from "../services/sui/zklogin";
import { logger } from "../utils/logger";

/**
 * POST /api/auth/google/zklogin
 * Body: { idToken: string, ephemeralPubKey?: string, maxEpoch?: number,
 *         randomness?: string, expectedNonce?: string }
 *
 * Verifies the Google ID token, derives the zkLogin Sui address via
 * `@mysten/sui/zklogin#jwtToAddress`, upserts the user (linking by email if
 * an account already exists), and issues JWT cookies so the rest of the app
 * sees a normal session.
 */
export async function googleZkLogin(req: Request, res: Response) {
  const body = (req.body ?? {}) as {
    idToken?: string;
    expectedNonce?: string;
  };

  const idToken = typeof body.idToken === "string" ? body.idToken : null;
  if (!idToken) {
    res.status(400).json({ message: "Missing idToken" });
    return;
  }

  let claims;
  try {
    claims = await verifyGoogleIdToken(idToken);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[GOOGLE_ZKLOGIN] verification failed",
    );
    res.status(401).json({ message: "Invalid Google ID token" });
    return;
  }

  if (!body.expectedNonce || !claims.nonce || body.expectedNonce !== claims.nonce) {
    res.status(401).json({ message: "Nonce mismatch" });
    return;
  }

  // Find by googleSub first, then by email.
  let user = await prisma.user.findUnique({ where: { googleSub: claims.sub } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email: claims.email } });
  }

  let saltBytes: Uint8Array;
  if (!user) {
    saltBytes = generateUserSalt();
    user = await prisma.user.create({
      data: {
        email: claims.email,
        googleEmail: claims.email,
        googleSub: claims.sub,
        // Unusable placeholder password — Google sign-in is the auth path.
        passwordHash: `google:${crypto.randomBytes(16).toString("hex")}`,
        zkLoginSalt: Buffer.from(encryptSalt(saltBytes)),
      },
    });
  } else {
    // Existing user — make sure we link googleSub + load/create salt.
    if (user.zkLoginSalt) {
      try {
        saltBytes = decryptSalt(Buffer.from(user.zkLoginSalt));
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err), userId: user.id },
          "[GOOGLE_ZKLOGIN] could not decrypt existing salt; rotating",
        );
        saltBytes = generateUserSalt();
      }
    } else {
      saltBytes = generateUserSalt();
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleSub: user.googleSub ?? claims.sub,
        googleEmail: claims.email,
        zkLoginSalt: Buffer.from(encryptSalt(saltBytes)),
      },
    });
  }

  // Derive and persist the Sui address.
  let suiAddress = user.suiAddress;
  try {
    const derived = await jwtToZkLoginAddress(idToken, saltBytes);
    if (derived !== suiAddress) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { suiAddress: derived },
      });
      suiAddress = derived;
    }
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), userId: user.id },
      "[GOOGLE_ZKLOGIN] failed to derive Sui address",
    );
    res.status(500).json({ message: "Failed to derive Sui address" });
    return;
  }

  await createSession(res, user);

  res.status(200).json({
    user: toAuthUser(user),
    suiAddress,
  });
}
