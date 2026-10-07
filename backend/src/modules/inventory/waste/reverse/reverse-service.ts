import type { Request } from 'express';
import { prisma } from '../../../../config/database';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { requireHubActor } from '../../_shared/central-store-access';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { WASTE_REVERSAL_TEXT, type ReverseWasteInput, type WasteEntry } from '../_shared/waste-contract';
import { reverseCheck, type ReverseCheck } from '../_shared/waste-rules';
import { wasteView } from '../_shared/waste-view';
import { reverseRepository } from './reverse-repository';

type Actor = NonNullable<Request['user']>;

const refuse = (check: Exclude<ReverseCheck, 'OK'>): never => {
  if (check === 'ALREADY_REVERSED') throw new ConflictError('This entry was already reversed', 'ALREADY_REVERSED');
  if (check === 'REVERSAL_WINDOW_PASSED') throw new ForbiddenError('Entries can only be reversed on the day they were logged. Ask the Store Manager', 'REVERSAL_WINDOW_PASSED');
  throw new ForbiddenError('You can only reverse entries you logged yourself', 'NOT_YOUR_ENTRY');
};

export const reverseService = {
  /**
   * W4: reverse one entry. No PIN. The original log and its WASTE ledger row stay; one reversing row of the same type
   * goes through the door with the same quantity (the door flips the sign, so the stock goes back up) and the log is
   * stamped. All in one transaction, with the entry locked, so a repeat or a race is `ALREADY_REVERSED`.
   */
  reverse: async (actor: Actor, id: string, input: ReverseWasteInput, now: Date = new Date()): Promise<WasteEntry> => {
    const siteId = await requireHubActor(actor);

    const seen = await reverseRepository.findLog(siteId, id);
    if (!seen) throw new NotFoundError('Waste entry not found');
    const early = reverseCheck(actor, seen, now);
    if (early !== 'OK') refuse(early);

    const updated = await prisma.$transaction(async (tx) => {
      await reverseRepository.lockLog(tx, siteId, id);
      const log = await reverseRepository.findLog(siteId, id, tx);
      if (!log) throw new NotFoundError('Waste entry not found');
      const check = reverseCheck(actor, log, now);
      if (check !== 'OK') refuse(check);

      const original = await reverseRepository.findWasteLedgerRow(tx, siteId, log.id);
      if (!original) throw new NotFoundError('This entry has no stock movement to reverse');

      await postStockMovement(tx, {
        type: 'WASTE',
        locationId: original.locationId,
        inventoryItemId: original.inventoryItemId,
        quantity: original.quantity.abs(),
        unitCost: original.unitCost,
        reason: `Reversed: ${WASTE_REVERSAL_TEXT[input.reason]}`,
        userId: actor.id,
        links: { wasteLogId: log.id },
        reversesTransactionId: original.id,
      });

      return reverseRepository.stampReversal(tx, siteId, log.id, {
        reversedAt: now,
        reversedById: actor.id,
        reversalReason: input.reason,
        reversalNote: input.note && input.note.length > 0 ? input.note : null,
      });
    });

    return wasteView.entry(actor, updated, now);
  },
};
