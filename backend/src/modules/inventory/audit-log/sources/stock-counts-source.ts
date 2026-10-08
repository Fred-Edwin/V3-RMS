import { fmtKesSigned } from '../../counting/_shared/count-format';
import { describeCountApproved, describeCountSigned, describeCountSignedAndApplied } from '../audit-log-describe';
import type { AuditEntry } from '../audit-log.types';
import { stockCountsRepository, type CountEntryKind } from './stock-counts-repository';
import type { AuditSource } from './source';

type CountRow = Awaited<ReturnType<typeof stockCountsRepository.entries>>[number];

/** "Samrat", "Others, Packaging", or the first items counted when the count was of single items (a recount). */
const scopeText = (count: CountRow): string =>
  count.scopeSections.length > 0 ? count.scopeSections.map((s) => s.sectionName).join(', ') : count.lines.slice(0, 3).map((l) => l.inventoryItem.name).join(', ');

const counted = (count: CountRow): number => count.lines.filter((l) => l.countedQty !== null).length;

const link = (count: CountRow): NonNullable<AuditEntry['record']> => ({ kind: 'COUNT', id: count.id, label: count.reference });

/**
 * Stock counts (Paper step 58), derived from the `counts` rows: a count signed by its counter, and a count approved by the
 * Manager (with what approving posted: the number of ledger adjustments and their net value). No event table.
 */
export const stockCountsSource: AuditSource = {
  area: 'STOCK_COUNTS',

  entries: async (scope, filter, take) => {
    const [signed, approved] = await Promise.all([
      stockCountsRepository.entries(scope, filter, 'SIGNED', take),
      stockCountsRepository.entries(scope, filter, 'APPROVED', take),
    ]);
    const posted = await stockCountsRepository.adjustmentsOf(scope, approved.map((c) => c.id));
    const entry = (count: CountRow, kind: CountEntryKind): AuditEntry[] => {
      const at = kind === 'SIGNED' ? count.signedAt : count.approvedAt;
      const by = kind === 'SIGNED' ? count.counter : count.approver;
      if (!at || !by) return [];
      const adjustments = posted.get(count.id) ?? { adjustments: 0, netKes: 0 };
      const net = fmtKesSigned(adjustments.netKes);
      const what =
        kind === 'SIGNED'
          ? describeCountSigned(scopeText(count), counted(count))
          : count.selfSigned
            ? describeCountSignedAndApplied(scopeText(count), counted(count), adjustments.adjustments, net)
            : describeCountApproved(adjustments.adjustments, net);
      return [{ id: `count:${kind.toLowerCase()}:${count.id}`, at: at.toISOString(), actor: by, area: 'STOCK_COUNTS', what, reason: null, record: link(count) }];
    };
    return [...signed.flatMap((c) => entry(c, 'SIGNED')), ...approved.flatMap((c) => entry(c, 'APPROVED'))];
  },

  count: async (scope, filter) => {
    const [signed, approved] = await Promise.all([stockCountsRepository.count(scope, filter, 'SIGNED'), stockCountsRepository.count(scope, filter, 'APPROVED')]);
    return signed + approved;
  },

  actorIds: (scope, range) => stockCountsRepository.actorIds(scope, range),
};
