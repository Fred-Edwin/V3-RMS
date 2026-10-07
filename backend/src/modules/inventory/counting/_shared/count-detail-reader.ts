import type { Request } from 'express';
import type { CountDetail } from './counting-contract';
import { capsOf } from './count-state';
import { countRecordRepository, type CountRecord } from './count-record-repository';
import { countSettingsRepository } from './count-settings-repository';
import { settingsInForce } from './count-settings';
import { readStories } from './count-story-reader';
import { buildCountDetail, type LiveFigures } from './count-view';

type Actor = NonNullable<Request['user']>;

/**
 * The live figures behind an OPEN count: the ledger on-hand right now and the settings in force now. Only the counter who is not
 * blind to stock figures (the Manager counting her own) ever gets them; nobody else reads an open count's numbers.
 */
export const readLiveFigures = async (siteId: string, count: CountRecord): Promise<LiveFigures> => {
  const [expected, row] = await Promise.all([
    countRecordRepository.onHandAsOf(siteId, count.locationId, count.lines.map((l) => l.inventoryItemId), null),
    countSettingsRepository.find(siteId),
  ]);
  return { expected, settings: settingsInForce(row) };
};

/**
 * Loads everything one count's detail needs and hands it to the one view builder: when each item was last counted, "what the
 * records show" for a signed count's outside-range lines, and the live figures for the counter's own OPEN count. A caller who is
 * blind to stock figures costs none of the figure queries.
 */
export const readCountDetail = async (actor: Actor, siteId: string, count: CountRecord, now: Date = new Date()): Promise<CountDetail> => {
  const caps = capsOf(actor);
  const itemIds = count.lines.map((l) => l.inventoryItemId);
  const lastCounted = await countRecordRepository.lastCountedBefore(siteId, itemIds, count.signedAt ?? now, count.id);

  const live = count.status === 'OPEN' && count.counterId === actor.id && !caps.blind ? await readLiveFigures(siteId, count) : null;
  const stories = count.status !== 'OPEN' && !caps.blind ? await readStories({ siteId, locationId: count.locationId, count, lastCounted }) : new Map();

  return buildCountDetail({ count, actor, now, lastCounted, stories, live });
};
