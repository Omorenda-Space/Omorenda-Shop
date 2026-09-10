import { logger } from "../utils/logger";

/**
 * Thin enqueue surface for the mint pipeline.
 *
 * Today this is a no-op: the NftMint row was just inserted in the same
 * transaction that wrote the Order. The mintWorker polls that table directly,
 * so there's nothing to push.
 *
 * It exists as a swap point: when we move off Postgres polling (e.g. to
 * BullMQ + Redis), only this file changes; callers stay the same.
 */
export async function enqueueBowlMint(args: { orderItemId: string }) {
  logger.debug({ orderItemId: args.orderItemId }, "[QUEUE] mint enqueued (db-row already present)");
}
