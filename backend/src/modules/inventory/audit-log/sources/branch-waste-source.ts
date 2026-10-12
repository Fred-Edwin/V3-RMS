import { nairobiDay } from '../../stock/_shared/nairobi-time';
import { WASTE_REASON_TEXT, WASTE_REVERSAL_TEXT } from '../../waste/_shared/waste-contract';
import { describeBranchWasteLogged, describeWasteReversed } from '../audit-log-describe';
import type { AuditEntry } from '../audit-log.types';
import { branchWasteAuditRepository, type BranchWasteEntryKind } from './branch-waste-repository';
import type { AuditSource } from './source';

type WasteRow = Awaited<ReturnType<typeof branchWasteAuditRepository.entries>>[number];

const record = (log: WasteRow, at: Date): NonNullable<AuditEntry['record']> => ({ kind: 'STOCK_CARD', id: log.inventoryItem.id, label: 'Stock ledger entry', day: nairobiDay(at) });

/**
 * Branch waste (Paper step 60, area `BRANCH_WASTE`), derived from the `waste_logs` rows of branch department locations: an entry logged
 * and an entry reversed (the original stays; a linked ledger row returned the stock). No money in the sentence. The link opens that
 * item's stock card on the day it happened. No event table.
 */
export const branchWasteSource: AuditSource = {
  area: 'BRANCH_WASTE',

  entries: async (scope, filter, take) => {
    const [logged, reversed] = await Promise.all([
      branchWasteAuditRepository.entries(scope, filter, 'LOGGED', take),
      branchWasteAuditRepository.entries(scope, filter, 'REVERSED', take),
    ]);
    const entry = (log: WasteRow, kind: BranchWasteEntryKind): AuditEntry[] => {
      const qty = log.quantity.toString();
      if (kind === 'LOGGED') {
        const what = describeBranchWasteLogged(log.inventoryItem.name, qty, log.inventoryItem.usageUnit, WASTE_REASON_TEXT[log.reason]);
        return [{ id: `branch-waste:logged:${log.id}`, at: log.createdAt.toISOString(), actor: log.loggedBy, area: 'BRANCH_WASTE', what, reason: null, record: record(log, log.createdAt) }];
      }
      if (!log.reversedAt || !log.reversedBy || !log.reversalReason) return [];
      const what = describeWasteReversed(log.inventoryItem.name, qty, log.inventoryItem.usageUnit, WASTE_REVERSAL_TEXT[log.reversalReason], log.reversalNote);
      return [{ id: `branch-waste:reversed:${log.id}`, at: log.reversedAt.toISOString(), actor: log.reversedBy, area: 'BRANCH_WASTE', what, reason: null, record: record(log, log.reversedAt) }];
    };
    return [...logged.flatMap((l) => entry(l, 'LOGGED')), ...reversed.flatMap((l) => entry(l, 'REVERSED'))];
  },

  count: async (scope, filter) => {
    const [logged, reversed] = await Promise.all([branchWasteAuditRepository.count(scope, filter, 'LOGGED'), branchWasteAuditRepository.count(scope, filter, 'REVERSED')]);
    return logged + reversed;
  },

  actorIds: (scope, range) => branchWasteAuditRepository.actorIds(scope, range),
};
