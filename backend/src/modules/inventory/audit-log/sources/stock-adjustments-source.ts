import { nairobiDay } from '../../stock/_shared/nairobi-time';
import { describeAdjustment } from '../audit-log-describe';
import type { AuditSource } from './source';
import { stockAdjustmentsRepository } from './stock-adjustments-repository';

/**
 * Stock adjustments (Paper step 58): a movement posted to the ledger by hand, and the row that reverses one. The record is the
 * `ADJ-####` number, which opens the stock ledger searched for it on the day it was posted. No event table.
 */
export const stockAdjustmentsSource: AuditSource = {
  area: 'STOCK_ADJUSTMENTS',

  entries: async (scope, filter, take) => {
    const rows = await stockAdjustmentsRepository.entries(scope, filter, take);
    return rows.map((r) => ({
      id: `adjustment:${r.id}`,
      at: r.createdAt.toISOString(),
      actor: r.user,
      area: 'STOCK_ADJUSTMENTS' as const,
      what: describeAdjustment({ itemName: r.inventoryItem.name, signedQuantity: r.quantity.toString(), unit: r.inventoryItem.usageUnit, reason: r.reason, reverses: r.reverses?.reference ?? null }),
      reason: null,
      ...(r.reference ? { record: { kind: 'LEDGER_SEARCH' as const, id: r.reference, label: r.reference, day: nairobiDay(r.createdAt) } } : {}),
    }));
  },

  count: (scope, filter) => stockAdjustmentsRepository.count(scope, filter),

  actorIds: (scope, range) => stockAdjustmentsRepository.actorIds(scope, range),
};
