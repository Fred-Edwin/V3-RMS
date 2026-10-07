import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { blindnessOf } from '../../_shared/blind-rule';
import { toPerson } from '../../stock/_shared/person';
import {
  WASTE_REASON_TEXT,
  WASTE_REVERSAL_TEXT,
  type LogWasteResult,
  type WasteEntry,
  type WasteItemOption,
  type WasteItems,
  type WasteList,
} from './waste-contract';
import type { WasteLogRow } from './waste-row';
import { reverseCheck } from './waste-rules';

type Actor = NonNullable<Request['user']>;

/** A catalog item as the picker reads it: with its cost now and what the Central Store holds. */
export type WasteItemRow = { id: string; name: string; usageUnit: string; currentCost: Prisma.Decimal; onHand: Prisma.Decimal };

/** KES with two decimals, as a string ("1260.00"). */
export const kes = (value: Prisma.Decimal): string => value.toDecimalPlaces(2).toFixed(2);

/** The value an entry counts for: quantity × the cost it was logged at; a reversed entry counts for nothing. */
export const entryValue = (log: Pick<WasteLogRow, 'quantity' | 'unitCost' | 'reversedAt'>): Prisma.Decimal =>
  log.reversedAt ? log.quantity.times(0) : log.quantity.times(log.unitCost);

/**
 * The only place that decides which keys a waste response carries (there is no `isAttendant` check anywhere):
 *  - money (`valueKes`, `unitCost`, `totalValueKes`) follows `catalog.see_costs`;
 *  - stock figures (`onHand`, `wentNegative`) follow `restock.read`;
 *  - nothing else about stock ever appears.
 */
export const wasteView = {
  entry: (actor: Actor, log: WasteLogRow, now: Date): WasteEntry => {
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
      can: { reverse: reverseCheck(actor, log, now) === 'OK' },
    };
  },

  item: (actor: Actor, item: WasteItemRow): WasteItemOption => {
    const blind = blindnessOf(actor);
    return {
      itemId: item.id,
      name: item.name,
      unit: item.usageUnit,
      ...(blind.itemCosts ? {} : { unitCost: kes(item.currentCost) }),
      ...(blind.stockFigures ? {} : { onHand: item.onHand.toString() }),
    };
  },

  items: (actor: Actor, rows: { often: WasteItemRow[]; items: WasteItemRow[] }): WasteItems => ({
    often: rows.often.map((row) => wasteView.item(actor, row)),
    items: rows.items.map((row) => wasteView.item(actor, row)),
  }),

  logResult: (actor: Actor, logs: WasteLogRow[], flags: { wentNegative: boolean; replayed: boolean }, now: Date): LogWasteResult => {
    const blind = blindnessOf(actor);
    const total = logs.reduce((sum, log) => sum.plus(entryValue(log)), new Prisma.Decimal(0));
    return {
      entries: logs.map((log) => wasteView.entry(actor, log, now)),
      ...(blind.itemCosts ? {} : { totalValueKes: kes(total) }),
      ...(blind.stockFigures ? {} : { wentNegative: flags.wentNegative }),
      replayed: flags.replayed,
    };
  },

  list: (
    actor: Actor,
    input: {
      logs: WasteLogRow[];
      chips: WasteList['chips'];
      page: WasteList['page'];
      kpis?: WasteList['kpis'];
      bannerText?: string | null;
    },
    now: Date,
  ): WasteList => ({
    ...(input.kpis ? { kpis: input.kpis } : {}),
    rows: input.logs.map((log) => wasteView.entry(actor, log, now)),
    chips: input.chips,
    ...(input.bannerText !== undefined ? { bannerText: input.bannerText } : {}),
    page: input.page,
  }),
};
