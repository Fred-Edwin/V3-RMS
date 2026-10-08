import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { locationRepository } from '../../../../repositories/location-repository';
import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { requireHubActor } from '../../_shared/central-store-access';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { stockRepository } from '../../stock/_shared/stock-repository';
import { addDays, dayStartInstant, nairobiDay } from '../../stock/_shared/nairobi-time';
import type { LogWasteInput, WasteItems } from '../_shared/waste-contract';
import { wasteView } from '../_shared/waste-view';
import type { WasteLogRow } from '../_shared/waste-row';
import { logRepository } from './log-repository';
import type { LogOutcome } from './log.types';

type Actor = NonNullable<Request['user']>;

/** "Most logged" looks back this many days (W1 `often`, at most OFTEN_LIMIT items). */
const OFTEN_DAYS = 60;
const OFTEN_LIMIT = 6;

const isBatchRace = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && String(error.meta?.target ?? '').includes('idempotency_key');

const centralStoreOf = async (siteId: string): Promise<{ id: string }> => {
  const location = await locationRepository.findCentralStore();
  if (!location || location.siteId !== siteId) throw new NotFoundError('No Central Store is configured');
  return location;
};

/** True when any of these items now holds less than zero (allowed and flagged, never blocked). */
const anyNegative = async (siteId: string, locationId: string, itemIds: string[], client: Prisma.TransactionClient | typeof prisma): Promise<boolean> => {
  for (const itemId of new Set(itemIds)) {
    if ((await stockRepository.onHandForItem(siteId, locationId, itemId, client)).isNegative()) return true;
  }
  return false;
};

export const logService = {
  /** W1: the picker. `often` is this caller's most logged items of the last 60 days; `items` are live items matching the search. */
  listItems: async (actor: Actor, query: { search?: string; limit: number }, now: Date = new Date()): Promise<WasteItems> => {
    const siteId = await requireHubActor(actor);
    const location = await centralStoreOf(siteId);
    const since = dayStartInstant(addDays(nairobiDay(now), -OFTEN_DAYS));
    const oftenIds = await logRepository.oftenItemIds(siteId, actor.id, since, OFTEN_LIMIT);
    const [often, items] = await Promise.all([
      logRepository.liveItemsByIds(siteId, location.id, oftenIds).then((rows) => rows.slice(0, OFTEN_LIMIT)),
      logRepository.searchLiveItems(siteId, location.id, query.search, query.limit),
    ]);
    return wasteView.items(actor, { often, items });
  },

  /**
   * W2: log one or several items as one batch. One `WasteLog` and one WASTE ledger row per entry, all in one transaction, so
   * the batch lands whole or not at all. A repeated key returns the same entries (`replayed`); the unique index decides a race.
   */
  log: async (actor: Actor, input: LogWasteInput, now: Date = new Date()): Promise<LogOutcome> => {
    const siteId = await requireHubActor(actor);
    const location = await centralStoreOf(siteId);

    const replay = async (): Promise<LogOutcome | null> => {
      const existing = await logRepository.findBatch(siteId, actor.id, input.idempotencyKey);
      if (!existing) return null;
      const wentNegative = await anyNegative(siteId, location.id, existing.logs.map((log) => log.inventoryItemId), prisma);
      return { result: wasteView.logResult(actor, existing.logs, { wentNegative, replayed: true }, now), replayed: true };
    };
    const already = await replay();
    if (already) return already;

    const items = new Map((await logRepository.findItems(siteId, input.entries.map((entry) => entry.inventoryItemId))).map((item) => [item.id, item]));
    for (const entry of input.entries) {
      const item = items.get(entry.inventoryItemId);
      if (!item) throw new NotFoundError('Inventory item not found');
      if (item.deletedAt) throw new ConflictError('This item is retired', 'ITEM_RETIRED');
    }
    const note = input.note && input.note.length > 0 ? input.note : null;

    try {
      const { logs, wentNegative } = await prisma.$transaction(async (tx) => {
        const batch = await logRepository.createBatch(tx, siteId, actor.id, input.idempotencyKey);
        const created: WasteLogRow[] = [];
        for (const entry of input.entries) {
          const item = items.get(entry.inventoryItemId)!;
          const quantity = new Prisma.Decimal(entry.quantity);
          const log = await logRepository.createLog(tx, {
            siteId,
            locationId: location.id,
            batchId: batch.id,
            inventoryItemId: item.id,
            quantity,
            reason: entry.reason,
            note,
            unitCost: item.currentCost,
            loggedById: actor.id,
          });
          // The door stores WASTE negative, so the quantity goes in as entered and on-hand stays a plain sum.
          await postStockMovement(tx, {
            type: 'WASTE',
            locationId: location.id,
            inventoryItemId: item.id,
            quantity,
            unitCost: item.currentCost,
            reason: entry.reason,
            userId: actor.id,
            links: { wasteLogId: log.id },
          });
          created.push(log);
        }
        return { logs: created, wentNegative: await anyNegative(siteId, location.id, created.map((log) => log.inventoryItemId), tx) };
      });
      return { result: wasteView.logResult(actor, logs, { wentNegative, replayed: false }, now), replayed: false };
    } catch (error) {
      if (isBatchRace(error)) {
        const raced = await replay();
        if (raced) return raced;
      }
      throw error;
    }
  },
};
