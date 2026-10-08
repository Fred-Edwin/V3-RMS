import { formatKes } from '../../catalog/item-history';
import { nairobiDay } from '../../stock/_shared/nairobi-time';
import { WASTE_REASON_TEXT, WASTE_REVERSAL_TEXT } from '../../waste/_shared/waste-contract';
import { describeWasteLogged, describeWasteReversed } from '../audit-log-describe';
import type { AuditEntry } from '../audit-log.types';
import type { AuditSource } from './source';
import { wasteAuditRepository, type WasteEntryKind } from './waste-repository';

type WasteRow = Awaited<ReturnType<typeof wasteAuditRepository.entries>>[number];

const record = (log: WasteRow, at: Date): NonNullable<AuditEntry['record']> => ({ kind: 'STOCK_CARD', id: log.inventoryItem.id, label: 'Stock ledger entry', day: nairobiDay(at) });

/**
 * Waste (Paper step 58), derived from the `waste_logs` rows: an entry logged, and an entry reversed (the original stays; a
 * linked ledger row returned the stock). The link opens that item's stock card on the day it happened. No event table.
 */
export const wasteSource: AuditSource = {
  area: 'WASTE',

  entries: async (scope, filter, take) => {
    const [logged, reversed] = await Promise.all([wasteAuditRepository.entries(scope, filter, 'LOGGED', take), wasteAuditRepository.entries(scope, filter, 'REVERSED', take)]);
    const entry = (log: WasteRow, kind: WasteEntryKind): AuditEntry[] => {
      const qty = log.quantity.toString();
      if (kind === 'LOGGED') {
        const what = describeWasteLogged(log.inventoryItem.name, qty, log.inventoryItem.usageUnit, WASTE_REASON_TEXT[log.reason], formatKes(log.quantity.times(log.unitCost).toNumber()));
        return [{ id: `waste:logged:${log.id}`, at: log.createdAt.toISOString(), actor: log.loggedBy, area: 'WASTE', what, reason: null, record: record(log, log.createdAt) }];
      }
      if (!log.reversedAt || !log.reversedBy || !log.reversalReason) return [];
      const what = describeWasteReversed(log.inventoryItem.name, qty, log.inventoryItem.usageUnit, WASTE_REVERSAL_TEXT[log.reversalReason], log.reversalNote);
      return [{ id: `waste:reversed:${log.id}`, at: log.reversedAt.toISOString(), actor: log.reversedBy, area: 'WASTE', what, reason: null, record: record(log, log.reversedAt) }];
    };
    return [...logged.flatMap((l) => entry(l, 'LOGGED')), ...reversed.flatMap((l) => entry(l, 'REVERSED'))];
  },

  count: async (scope, filter) => {
    const [logged, reversed] = await Promise.all([wasteAuditRepository.count(scope, filter, 'LOGGED'), wasteAuditRepository.count(scope, filter, 'REVERSED')]);
    return logged + reversed;
  },

  actorIds: (scope, range) => wasteAuditRepository.actorIds(scope, range),
};
