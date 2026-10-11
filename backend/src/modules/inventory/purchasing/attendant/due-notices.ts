import { dayAsDate, nairobiDay } from '../../counting/_shared/count-time';
import { branchRepository } from '../../../../repositories/branch-repository';
import { purchasingNotices } from '../_shared/purchasing-notify';
import { attendantRepository } from './attendant-repository';

const DAY_MS = 86_400_000;

export interface DueNoticeDeps {
  hubId: () => Promise<string | null>;
  findSentDueOn: typeof attendantRepository.findSentDueOn;
  dueToday: typeof purchasingNotices.dueToday;
  overdue: typeof purchasingNotices.overdue;
}

/**
 * The 08:00 Nairobi job (notification map rows 24 and 25): a sent order expected today tells the hub's Store Attendants "Delivery due
 * today"; one that was expected yesterday tells them "1 day overdue". Each order is told once for each: the job runs once a day and the
 * expected date is an exact match, so a later day does not repeat the push (the Notifications screen shows the days late itself).
 */
export const createDueNotifier = (deps: DueNoticeDeps) => async (now: Date = new Date()): Promise<{ dueToday: number; overdue: number }> => {
  const hubId = await deps.hubId();
  if (!hubId) return { dueToday: 0, overdue: 0 };
  const today = nairobiDay(now);
  const yesterday = new Date(dayAsDate(today).getTime() - DAY_MS);
  const [due, late] = await Promise.all([deps.findSentDueOn(hubId, dayAsDate(today)), deps.findSentDueOn(hubId, yesterday)]);
  for (const o of due) {
    if (o.reference) await deps.dueToday({ hubId, orderId: o.id, reference: o.reference, supplierName: o.supplierName, itemCount: o.itemCount });
  }
  for (const o of late) {
    if (o.reference) await deps.overdue({ hubId, orderId: o.id, reference: o.reference, supplierName: o.supplierName, daysLate: 1 });
  }
  return { dueToday: due.length, overdue: late.length };
};

export const sendDeliveryDueNotices = createDueNotifier({
  hubId: async () => (await branchRepository.findHub())?.id ?? null,
  findSentDueOn: (siteId, day) => attendantRepository.findSentDueOn(siteId, day),
  dueToday: (o) => purchasingNotices.dueToday(o),
  overdue: (o) => purchasingNotices.overdue(o),
});
