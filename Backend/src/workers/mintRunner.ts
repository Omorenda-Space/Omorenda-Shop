import type { NftMint } from "@prisma/client";
import { mintBowlOnSui } from "../services/sui/mint";
import { parseMintPayload } from "../services/shopify/bowls";

/**
 * Pure-ish: given a claimed NftMint job (already moved to status=MINTING),
 * perform the on-chain mint from the bowl attributes snapshotted on the row
 * (bowlSerial + mintPayload). Returns the result the worker should persist.
 * Throws on failure.
 *
 * Kept thin so the worker's retry/backoff logic stays one level up.
 */
export async function runBowlMint(args: {
  mint: NftMint;
}): Promise<{ suiObjectId: string; mintTxDigest: string; sponsorAddress: string }> {
  const { mint } = args;
  if (mint.productKind !== "BOWL") {
    throw new Error(`Unsupported productKind for mintRunner: ${mint.productKind}`);
  }
  if (!mint.recipientSuiAddress) {
    throw new Error("Mint job missing recipientSuiAddress");
  }
  if (mint.bowlSerial === null) {
    throw new Error("Mint job missing bowlSerial");
  }
  const payload = parseMintPayload(mint.mintPayload);
  if (!payload) {
    throw new Error("Mint job has missing or malformed mintPayload");
  }
  return mintBowlOnSui({
    serial: mint.bowlSerial,
    name: payload.name,
    imageUrl: payload.imageUrl,
    weightGrams: payload.weightGrams,
    heightMm: payload.heightMm,
    widthMm: payload.widthMm,
    note: payload.note,
    frequency: payload.frequency,
    recipient: mint.recipientSuiAddress,
  });
}
