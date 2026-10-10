import { CORRECTION_REASON_TEXT } from '../../branch-day/_shared/branch-day-contract';
import {
  describeCountCorrected,
  describeCountSigned,
  describeDayClosed,
  describeOpeningAccepted,
  describeOpeningRecounted,
} from '../../branch-day/branch-day-sentences';
import { nairobiDay } from '../../stock/_shared/nairobi-time';
import type { AuditEntry } from '../audit-log.types';
import { branchDayAuditRepository } from './branch-day-repository';
import type { AuditSource } from './source';

type Day = { id: string; reference: string; businessDate: Date };
const trim = (n: { toString(): string }): string => String(Number(n.toString()));

const dayLink = (day: Day, at: Date): NonNullable<AuditEntry['record']> => ({ kind: 'DAY', id: day.id, label: day.reference, day: nairobiDay(at) });

/**
 * Branch day (Paper step 58 and B17, area `BRANCH_DAY`), derived from the rows that already say who and when (contract §9): an opening
 * checked, a count signed (on behalf of the department when the Branch Manager signed it), the day closed, a count corrected. No event
 * table. The owner's ruling for this build: the log carries no money and no PIN, so the close reads "Closed the day" with no Used value
 * and nothing says "signed with PIN". A correction's reason and note ride in `reason`; its record opens the ledger searched for the
 * day number. Printing is not an event.
 */
export const branchDaySource: AuditSource = {
  area: 'BRANCH_DAY',

  entries: async (scope, filter, take) => {
    const [openings, counts, closes, corrections] = await Promise.all([
      branchDayAuditRepository.openings(scope, filter, take),
      branchDayAuditRepository.counts(scope, filter, take),
      branchDayAuditRepository.closes(scope, filter, take),
      branchDayAuditRepository.corrections(scope, filter, take),
    ]);
    const entries: AuditEntry[] = [
      ...openings.map(
        (o): AuditEntry => {
          const differences = o.lines
            .filter((l) => !l.overnightVariance.isZero())
            .map((l) => ({ itemName: l.inventoryItem.name, lastNightQty: trim(l.prefilledQty), countedQty: trim(l.acceptedQty) }));
          const name = o.department?.name ?? '';
          return {
            id: `branch-day:opening:${o.id}`,
            at: o.acceptedAt.toISOString(),
            actor: o.acceptedBy,
            area: 'BRANCH_DAY',
            what: o.kind === 'RECOUNTED' ? describeOpeningRecounted(name, differences) : describeOpeningAccepted(name),
            reason: null,
            record: dayLink(o.branchDay, o.acceptedAt),
          };
        },
      ),
      ...counts.flatMap((c): AuditEntry[] =>
        c.countedAt && c.countedBy
          ? [
              {
                id: `branch-day:count:${c.id}`,
                at: c.countedAt.toISOString(),
                actor: c.countedBy,
                area: 'BRANCH_DAY',
                what: describeCountSigned(c.department?.name ?? '', c._count.lines, c.onBehalf),
                reason: null,
                record: dayLink(c.branchDay, c.countedAt),
              },
            ]
          : [],
      ),
      ...closes.flatMap((d): AuditEntry[] =>
        d.closedAt && d.closedBy
          ? [{ id: `branch-day:close:${d.id}`, at: d.closedAt.toISOString(), actor: d.closedBy, area: 'BRANCH_DAY', what: describeDayClosed(null), reason: null, record: dayLink(d, d.closedAt) }]
          : [],
      ),
      ...corrections.map(
        (c): AuditEntry => ({
          id: `branch-day:correction:${c.id}`,
          at: c.correctedAt.toISOString(),
          actor: c.correctedBy,
          area: 'BRANCH_DAY',
          what: describeCountCorrected(c.branchDayLine.inventoryItem.name, c.branchDayLine.department.department?.name ?? '', trim(c.fromClosingQty), trim(c.toClosingQty)),
          reason: c.note ? `${CORRECTION_REASON_TEXT[c.reason]} · ${c.note}` : CORRECTION_REASON_TEXT[c.reason],
          record: { kind: 'LEDGER_SEARCH', id: c.branchDay.reference, label: c.branchDay.reference, day: nairobiDay(c.correctedAt) },
        }),
      ),
    ];
    return entries.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).slice(0, take);
  },

  count: (scope, filter) => branchDayAuditRepository.count(scope, filter),

  actorIds: (scope, range) => branchDayAuditRepository.actorIds(scope, range),
};
