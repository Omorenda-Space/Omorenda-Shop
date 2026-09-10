import crypto from "node:crypto";
import { config } from "../../config/config";

/**
 * Server-side helpers for the zkLogin / Google flow.
 *
 * Responsibilities:
 *   - verifyGoogleIdToken: validate the Google-issued ID token against
 *     Google's JWKS, check aud, iss, exp, and the user-supplied nonce.
 *   - jwtToZkLoginAddress: derive the Sui address using
 *     `@mysten/sui/zklogin#jwtToAddress`.
 *   - generateUserSalt / encryptSalt / decryptSalt: 16-byte per-user salt
 *     management (AES-256-GCM at rest).
 */

const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_ISSUER_ALT = "accounts.google.com";

export type VerifiedGoogleClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
  iss: string;
  aud: string;
  nonce: string | null;
  iat: number;
  exp: number;
};

let cachedJwks: ReturnType<typeof createRemoteJwks> | null = null;
function createRemoteJwks() {
  return (async () => {
    const { createRemoteJWKSet } = await import("jose");
    return createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  })();
}
function getJwks() {
  if (!cachedJwks) cachedJwks = createRemoteJwks();
  return cachedJwks;
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleClaims> {
  if (!config.google.oauthClientId) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID");
  }
  const { jwtVerify } = await import("jose");
  const jwks = await getJwks();
  const { payload } = await jwtVerify(idToken, jwks, {
    audience: config.google.oauthClientId,
    issuer: [GOOGLE_ISSUER, GOOGLE_ISSUER_ALT],
  });
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Google token missing sub");
  }
  if (typeof payload.email !== "string" || !payload.email) {
    throw new Error("Google token missing email");
  }
  if (payload.email_verified !== true) {
    throw new Error("Google email is not verified");
  }
  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: true,
    iss: String(payload.iss ?? GOOGLE_ISSUER),
    aud: String(payload.aud ?? config.google.oauthClientId),
    nonce: typeof payload.nonce === "string" ? payload.nonce : null,
    iat: Number(payload.iat ?? 0),
    exp: Number(payload.exp ?? 0),
  };
}

export async function jwtToZkLoginAddress(idToken: string, salt: Uint8Array): Promise<string> {
  const { jwtToAddress } = await import("@mysten/sui/zklogin");
  const saltBigInt = BigInt("0x" + Buffer.from(salt).toString("hex"));
  return jwtToAddress(idToken, saltBigInt, false);
}

export function generateUserSalt(): Uint8Array {
  return new Uint8Array(crypto.randomBytes(16));
}

// ---- Salt-at-rest (AES-256-GCM) ----

const SALT_AT_REST_VERSION = 1;

function getSaltKey(): Buffer {
  const raw = config.google.zkLoginSaltEncryptionKey;
  if (!raw) throw new Error("Missing ZKLOGIN_SALT_ENCRYPTION_KEY");
  // Accept hex (64 chars) or base64.
  if (/^[a-fA-F0-9]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("ZKLOGIN_SALT_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return buf;
}

/** Returns versioned, self-describing ciphertext: `[ver(1B)][iv(12B)][tag(16B)][ciphertext]`. */
export function encryptSalt(salt: Uint8Array): Buffer {
  const key = getSaltKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(salt)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([SALT_AT_REST_VERSION]), iv, tag, enc]);
}

export function decryptSalt(blob: Buffer): Uint8Array {
  if (blob.length < 1 + 12 + 16 + 1) throw new Error("Invalid encrypted salt blob");
  const ver = blob[0];
  if (ver !== SALT_AT_REST_VERSION) throw new Error(`Unsupported salt blob version: ${ver}`);
  const iv = blob.subarray(1, 13);
  const tag = blob.subarray(13, 29);
  const enc = blob.subarray(29);
  const key = getSaltKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(enc), decipher.final()]);
  return new Uint8Array(out);
}
