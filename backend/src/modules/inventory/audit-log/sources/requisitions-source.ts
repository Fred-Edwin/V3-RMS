import { eventTypeSchema } from '../../requisitions/_shared/requisitions-contract';
import { sentenceOf } from '../../requisitions/_shared/requisitions-sentences';
import type { AuditEntry } from '../audit-log.types';
import { requisitionsAuditRepository } from './requisitions-repository';
import type { AuditSource } from './source';

/**
 * Requisitions (Paper step 58, area `REQUISITIONS`): every `RequisitionEvent` of the branches in scope, worded by the same sentence
 * function as the file's Activity tab. A sentence that does not already name the requisition gets its reference added, so a row in a
 * list of many requisitions says which one ("Sent Kitchen's list · signed with PIN · REQ-NYR-0112"). The record link opens the file.
 * Never an account number or a PIN: the events do not hold one, and the sentences only say "signed with PIN".
 */
export const requisitionsSource: AuditSource = {
  area: 'REQUISITIONS',

  entries: async (scope, filter, take) => {
    const { events, departmentBySection, lineLabels } = await requisitionsAuditRepository.entries(scope, filter, take);
    return events.flatMap((e): AuditEntry[] => {
      const type = eventTypeSchema.safeParse(e.type);
      if (!type.success) return [];
      const sentence = sentenceOf(
        { type: type.data, fromValue: e.fromValue, toValue: e.toValue, reason: e.reason },
        {
          reference: e.requisition.reference,
          departmentName: e.sectionId ? (departmentBySection.get(e.sectionId) ?? null) : null,
          line: e.lineId ? (lineLabels.get(e.lineId) ?? null) : null,
        },
      );
      return [
        {
          id: `requisition:${e.id}`,
          at: e.at.toISOString(),
          actor: { id: e.actor.id, name: e.actor.name, role: e.actorRoleLabel },
          area: 'REQUISITIONS',
          what: sentence.includes(e.requisition.reference) ? sentence : `${sentence} · ${e.requisition.reference}`,
          reason: null,
          record: { kind: 'REQUISITION', id: e.requisition.id, label: e.requisition.reference },
        },
      ];
    });
  },

  count: (scope, filter) => requisitionsAuditRepository.count(scope, filter),

  actorIds: (scope, range) => requisitionsAuditRepository.actorIds(scope, range),
};
