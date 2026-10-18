import type { UserRole } from '@prisma/client';
import { leftoversRepository } from './leftovers-repository';

export type Leftover =
  | { kind: 'OPEN_TABLES'; items: { orderId: string; orderNumber: number; table: string | null; unpaid: number }[] }
  | { kind: 'OPEN_TICKETS'; items: { ticketId: string; station: string; status: string }[] }
  | { kind: 'PENDING_DISPATCHES'; items: { dispatchId: string; reference: string | null; toSiteName: string | null }[] };

/**
 * What is left in the person's own job, by role (proposal 5.3): a waiter's open orders and tables, a chef's or
 * barista's tickets they claimed, a Store Attendant's dispatches still being packed. Other roles have nothing to show.
 * It informs the prompt; it never blocks finishing.
 */
export async function leftoversFor(role: UserRole, siteId: string, userId: string): Promise<Leftover[]> {
  if (role === 'WAITER') {
    const orders = await leftoversRepository.openOrders(siteId, userId);
    return orders.length ? [{ kind: 'OPEN_TABLES', items: orders.map((o) => ({ orderId: o.id, orderNumber: o.dailyNumber, table: o.tableNumber, unpaid: Number(o.total) })) }] : [];
  }
  if (role === 'CHEF' || role === 'BARISTA') {
    const tickets = await leftoversRepository.openTickets(siteId, userId);
    return tickets.length ? [{ kind: 'OPEN_TICKETS', items: tickets.map((t) => ({ ticketId: t.id, station: t.station, status: t.status })) }] : [];
  }
  if (role === 'STORE_ATTENDANT') {
    const dispatches = await leftoversRepository.packingDispatches(siteId, userId);
    if (dispatches.length === 0) return [];
    const names = await leftoversRepository.siteNames(dispatches.map((d) => d.toSiteId));
    return [{ kind: 'PENDING_DISPATCHES', items: dispatches.map((d) => ({ dispatchId: d.id, reference: d.reference, toSiteName: names.get(d.toSiteId) ?? null })) }];
  }
  return [];
}
