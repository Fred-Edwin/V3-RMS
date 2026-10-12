import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { blindnessOf } from '../../_shared/blind-rule';
import { clockText } from '../../stock/_shared/nairobi-time';
import { toPerson } from '../../stock/_shared/person';
import {
  WASTE_REASON_TEXT,
  WASTE_REVERSAL_TEXT,
  type BranchWasteEntry,
  type BranchWasteItems,
  type LogBranchWasteResult,
} from '../_shared/waste-contract';
import { entryValue, kes } from '../_shared/waste-view';
import { branchReverseCheck } from './branch-rules';
import type { BranchWasteLogRow } from './branch-row';
import type { ReverseMode } from './branch.types';

type Actor = NonNullable<Request['user']>;

/** A catalog item as the picker reads it: a head or member sees the name and the unit, never a cost or a stock figure. */
export type BranchItemRow = { id: string; name: string; usageUnit: string };

/** "2 items logged at 14:20. You can reverse your own entries today." */
export const bannerFor = (batch: { at: Date; count: number }): string =>
  `${batch.count} ${batch.count === 1 ? 'item' : 'items'} logged at ${clockText(batch.at)}. You can reverse your own entries today.`;

/**
 * The only place that decides which keys a branch waste response carries (there is no role-name check anywhere):
 *  - money (`valueKes`, `totalValueKes`, the figures) follows `catalog.see_costs`;
 *  - stock figures (`wentNegative`, the ledger rows) follow `restock.read`;
 *  - the picker carries neither (only a head or member reaches it, and they hold neither).
 * `mode` is how the caller may reverse, which decides `can.reverse` on every row; a read-only list passes `NONE`.
 */
export const branchWasteView = {
  entry: (actor: Actor, log: BranchWasteLogRow, mode: ReverseMode, now: Date): BranchWasteEntry => {
    const blind = blindnessOf(actor);
    const reversal =
      log.reversedAt && log.reversedBy && log.reversalReason
        ? {
            at: log.reversedAt.toISOString(),
            by: toPerson(log.reversedBy),
            reason: log.reversalReason,
            reasonText: WASTE_REVERSAL_TEXT[log.reversalReason],
            note: log.reversalNote,
          }
        : null;
    // An entry whose location has no department row (legacy data) is named after the location, so a row never loses its department.
    const department = log.location.department ?? { id: log.location.id, name: log.location.name };
    return {
      id: log.id,
      at: log.createdAt.toISOString(),
      itemId: log.inventoryItem.id,
      itemName: log.inventoryItem.name,
      quantity: log.quantity.toString(),
      unit: log.inventoryItem.usageUnit,
      reason: log.reason,
      reasonText: WASTE_REASON_TEXT[log.reason],
      note: log.note,
      loggedBy: toPerson(log.loggedBy),
      ...(blind.itemCosts ? {} : { valueKes: kes(entryValue(log)) }),
      status: log.reversedAt ? 'REVERSED' : 'LOGGED',
      reversal,
      can: { reverse: branchReverseCheck(mode, actor.id, log, now) === 'OK' },
      department: { id: department.id, name: department.name },
      branch: { id: log.site.id, name: log.site.name, code: log.site.code },
    };
  },

  items: (rows: { often: BranchItemRow[]; items: BranchItemRow[] }): BranchWasteItems => {
    const item = (row: BranchItemRow) => ({ itemId: row.id, name: row.name, unit: row.usageUnit });
    return { often: rows.often.map(item), items: rows.items.map(item) };
  },

  logResult: (actor: Actor, logs: BranchWasteLogRow[], flags: { wentNegative: boolean; replayed: boolean }, mode: ReverseMode, now: Date): LogBranchWasteResult => {
    const blind = blindnessOf(actor);
    const total = logs.reduce((sum, log) => sum.plus(entryValue(log)), new Prisma.Decimal(0));
    return {
      entries: logs.map((log) => branchWasteView.entry(actor, log, mode, now)),
      ...(blind.itemCosts ? {} : { totalValueKes: kes(total) }),
      ...(blind.stockFigures ? {} : { wentNegative: flags.wentNegative }),
      replayed: flags.replayed,
    };
  },
};
