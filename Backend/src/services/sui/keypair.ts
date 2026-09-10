import { config } from "../../config/config";

type Ed25519KeypairInstance = import("@mysten/sui/keypairs/ed25519").Ed25519Keypair;

let cached: Ed25519KeypairInstance | null = null;

/**
 * Loads the sponsor keypair from `SUI_SPONSOR_PRIVATE_KEY`.
 *
 * Expects a Bech32-encoded private key (`suiprivkey1...`), the same format
 * `sui keytool export` produces. For production, this file is the only
 * place that needs to change to swap in a KMS-backed `Signer`.
 */
export async function getSponsorKeypair(): Promise<Ed25519KeypairInstance> {
  if (cached) return cached;
  const key = config.sui.sponsorPrivateKey;
  if (!key) {
    throw new Error("Missing SUI_SPONSOR_PRIVATE_KEY");
  }
  const [{ Ed25519Keypair }, { decodeSuiPrivateKey }] = await Promise.all([
    import("@mysten/sui/keypairs/ed25519"),
    import("@mysten/sui/cryptography"),
  ]);
  const decoded = decodeSuiPrivateKey(key);
  if (decoded.scheme !== "ED25519") {
    throw new Error(`Unsupported sponsor key scheme: ${decoded.scheme}; expected ED25519`);
  }
  cached = Ed25519Keypair.fromSecretKey(decoded.secretKey);
  return cached;
}

export async function getSponsorAddress(): Promise<string> {
  const kp = await getSponsorKeypair();
  return kp.toSuiAddress();
}
