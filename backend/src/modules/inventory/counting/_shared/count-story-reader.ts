import { prisma } from '../../../../config/database';
import type { Prisma } from '@prisma/client';
import type { CountRecord } from './count-record-repository';
import { STORY_WINDOW_DAYS, storyFor, type Story } from './count-story';
import { countStoryRepository } from './count-story-repository';

type Client = typeof prisma | Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "What the records show" for every outside-range line of a SIGNED count, keyed by line id. Each line is judged on the ledger and
 * documents between the item's previous counted time (or 7 days back when never counted) and the counter's sign time, so the same
 * story is read today and next month. An OPEN count has no stories.
 */
export const readStories = async (args: {
  siteId: string;
  locationId: string;
  count: CountRecord;
  /** When each item was last counted before this count. */
  lastCounted: ReadonlyMap<string, Date>;
  client?: Client;
}): Promise<Map<string, Story>> => {
  const { siteId, locationId, count, lastCounted } = args;
  const signedAt = count.signedAt;
  const stories = new Map<string, Story>();
  if (!signedAt) return stories;

  const outside = count.lines.filter((line) => line.result === 'EXCEEDS');
  await Promise.all(
    outside.map(async (line) => {
      const lastCountedAt = lastCounted.get(line.inventoryItemId) ?? null;
      const window = {
        siteId,
        locationId,
        itemId: line.inventoryItemId,
        from: lastCountedAt ?? new Date(signedAt.getTime() - STORY_WINDOW_DAYS * DAY_MS),
        to: signedAt,
      };
      const [dispatches, prepRuns, deliveries, isPrepRecipeInput, usedInPrepLastWeek] = await Promise.all([
        countStoryRepository.dispatches(window, args.client),
        countStoryRepository.prepRuns(window, args.client),
        countStoryRepository.deliveries(window, args.client),
        countStoryRepository.isPrepRecipeInput(siteId, line.inventoryItemId, args.client),
        countStoryRepository.usedInPrepLastWeek({ siteId, locationId, itemId: line.inventoryItemId, to: signedAt }, args.client),
      ]);
      stories.set(
        line.id,
        storyFor({
          itemName: line.inventoryItem.name,
          unit: line.inventoryItem.usageUnit,
          signedAt,
          lastCountedAt,
          dispatches,
          prepRuns,
          deliveries,
          isPrepRecipeInput,
          usedInPrepLastWeek,
        }),
      );
    }),
  );
  return stories;
};
