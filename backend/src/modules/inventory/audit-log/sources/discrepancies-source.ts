import { FINDING_TEXT } from '../../discrepancies/_shared/discrepancies-contract';
import type { AuditEntry } from '../audit-log.types';
import { discrepanciesAuditRepository } from './discrepancies-repository';
import type { AuditSource } from './source';

/**
 * Discrepancies (Paper step 58, area `DISCREPANCIES`): a gap opened by a delivery count, a finding recorded, a finding reversed, one
 * entry each, in plain sentences ("Recorded a finding on DSC-NYR-0007 · Milk 1 L · Packed short at the store · signed with PIN"). A
 * reversal carries its reason. Never a PIN; no value in money (the log is not a money screen). The record link opens the discrepancy file.
 */
const sentenceOf = (e: Awaited<ReturnType<typeof discrepanciesAuditRepository.entries>>[number]): string => {
  const ref = e.discrepancy.reference;
  const item = e.discrepancy.dispatchLine.item;
  const size = e.discrepancy.gapQty.abs().toString();
  switch (e.type) {
    case 'OPENED':
      return `Opened ${ref} · ${item.name} ${e.discrepancy.gapQty.isNegative() ? 'short' : 'over'} by ${size} ${item.usageUnit}`;
    case 'FINDING_RECORDED':
      return `Recorded a finding on ${ref} · ${item.name} · ${e.finding ? FINDING_TEXT[e.finding] : 'finding'}${e.note ? ` · ${e.note}` : ''} · signed with PIN`;
    default:
      return `Reversed the finding on ${ref} · ${item.name}${e.finding ? ` · ${FINDING_TEXT[e.finding]}` : ''} · signed with PIN`;
  }
};

export const discrepanciesSource: AuditSource = {
  area: 'DISCREPANCIES',

  entries: async (scope, filter, take) => {
    const events = await discrepanciesAuditRepository.entries(scope, filter, take);
    return events.map(
      (e): AuditEntry => ({
        id: `discrepancy:${e.id}`,
        at: e.at.toISOString(),
        actor: { id: e.actor.id, name: e.actor.name, role: e.actorRoleLabel },
        area: 'DISCREPANCIES',
        what: sentenceOf(e),
        reason: e.type === 'FINDING_REVERSED' ? e.reason : null,
        record: { kind: 'DISCREPANCY', id: e.discrepancy.id, label: e.discrepancy.reference },
      }),
    );
  },

  count: (scope, filter) => discrepanciesAuditRepository.count(scope, filter),

  actorIds: (scope, range) => discrepanciesAuditRepository.actorIds(scope, range),
};
