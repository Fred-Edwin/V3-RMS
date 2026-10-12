import type { AuditEntry } from '../audit-log.types';
import { dispatchAuditRepository } from './dispatch-repository';
import type { AuditSource } from './source';

/**
 * Dispatch (Paper step 58, area `DISPATCH`): every sign, cancel, count and close of a delivery to a branch, worded in plain sentences
 * ("Signed and sent DSP-NYR-0232 · Pastry · 8 lines · carried by Wendo van KCB 214K"). Never a PIN: the events do not hold one. The
 * record link opens the dispatch file. A cancel carries its "preset — note" reason.
 */
const sentenceOf = (e: Awaited<ReturnType<typeof dispatchAuditRepository.entries>>[number]): string => {
  const ref = e.dispatch.reference ?? 'a dispatch';
  const dept = e.dispatch.department.name;
  switch (e.type) {
    case 'SIGNED_AND_SENT': {
      const n = e.dispatch._count.lines;
      return `Signed and sent ${ref} · ${dept} · ${n} ${n === 1 ? 'line' : 'lines'}${e.dispatch.carrier ? ` · carried by ${e.dispatch.carrier.name}` : ''} · signed with PIN`;
    }
    case 'CANCELLED':
      return `Cancelled ${ref} · ${dept} · signed with PIN`;
    case 'DELIVERY_CONFIRMED_ON_BEHALF':
      return `Confirmed ${ref} for ${dept} on behalf of the department · signed with PIN`;
    case 'DELIVERY_CONFIRMED':
      return `${dept} counted ${ref} · signed with PIN`;
    default:
      return `Closed ${ref} · ${dept}`;
  }
};

export const dispatchSource: AuditSource = {
  area: 'DISPATCH',

  entries: async (scope, filter, take) => {
    const events = await dispatchAuditRepository.entries(scope, filter, take);
    return events.map(
      (e): AuditEntry => ({
        id: `dispatch:${e.id}`,
        at: e.at.toISOString(),
        actor: { id: e.actor.id, name: e.actor.name, role: e.actorRoleLabel },
        area: 'DISPATCH',
        what: sentenceOf(e),
        reason: e.type === 'CANCELLED' ? e.reason : null,
        record: { kind: 'DISPATCH', id: e.dispatch.id, label: e.dispatch.reference ?? '' },
      }),
    );
  },

  count: (scope, filter) => dispatchAuditRepository.count(scope, filter),

  actorIds: (scope, range) => dispatchAuditRepository.actorIds(scope, range),
};
