import type { Queue } from 'bullmq';
import { branchRepository } from '../repositories/branch-repository';
import { WAITING_FOR_BRANCH_AFTER_HOURS } from '../modules/inventory/dispatch/_shared/dispatch-contract';
import { branchNotices } from '../modules/inventory/deliveries/deliveries-notify';
import { deliveriesRepository } from '../modules/inventory/deliveries/deliveries-repository';
import { discrepanciesService } from '../modules/inventory/discrepancies/discrepancies-service';
import { logger } from '../utils/logger';

/**
 * The two timers of Block 2 (docs/features/inventory/dispatch-contract.md §7; constants, not settings), run every 5 minutes in the
 * existing report worker. Both are idempotent: a conditional update stamps the record for exactly one run, so two workers, an
 * overlapping run or a retried job never send twice.
 *
 *  - WAITING: a delivery signed 2 hours ago that nobody has counted tells the Branch Manager once (map row 20, "Waiting for the branch").
 *    The 2 hours run from the final signature (`signedAt`), so a delivery nobody opens still nudges (Amendment 1 row 1).
 *  - REMINDER: a gap held for 24 hours without a finding reminds the Store Manager, then again every day (map row 19).
 * Nudges reach the browsers through the Block 1 Redis bridge (`sockets/inventory-badges-bridge.ts`), because the worker has no clients.
 */
export const DELIVERY_WAITING_JOB = 'inventory-delivery-waiting.schedule';
export const DISCREPANCY_REMINDER_JOB = 'inventory-discrepancy-reminder.schedule';

export interface WaitingDeps {
  hubId: () => Promise<string | null>;
  findDue: (hubId: string, cutoff: Date) => Promise<Array<{ id: string; reference: string | null; toSiteId: string; department: { name: string } }>>;
  claim: (id: string, hubId: string, at: Date, cutoff: Date) => Promise<boolean>;
  notify: (w: { hubId: string; branchId: string; dispatchId: string; reference: string; departmentName: string }) => Promise<void>;
}

export const createWaitingNotifier = (deps: WaitingDeps) => async (now: Date = new Date()): Promise<number> => {
  const hubId = await deps.hubId();
  if (!hubId) return 0;
  const cutoff = new Date(now.getTime() - WAITING_FOR_BRANCH_AFTER_HOURS * 60 * 60 * 1000);
  let told = 0;
  for (const d of await deps.findDue(hubId, cutoff)) {
    if (!(await deps.claim(d.id, hubId, now, cutoff))) continue;
    told += 1;
    await deps.notify({ hubId, branchId: d.toSiteId, dispatchId: d.id, reference: d.reference ?? '', departmentName: d.department.name });
  }
  return told;
};

export const notifyWaitingDeliveries = createWaitingNotifier({
  hubId: async () => (await branchRepository.findHub())?.id ?? null,
  findDue: (hubId, cutoff) => deliveriesRepository.findWaitingCandidates(hubId, cutoff),
  claim: (id, hubId, at, cutoff) => deliveriesRepository.claimWaiting(id, hubId, at, cutoff),
  notify: (w) => branchNotices.waiting(w),
});

export const remindOpenDiscrepancies = (now: Date = new Date()): Promise<number> => discrepanciesService.sendReminders(now);

/** Registers both repeating jobs (every 5 minutes, Nairobi time). */
export const ensureInventoryDeliverySchedule = async (queue: Queue): Promise<void> => {
  for (const name of [DELIVERY_WAITING_JOB, DISCREPANCY_REMINDER_JOB]) {
    await queue.add(name, {}, { repeat: { pattern: '*/5 * * * *', tz: 'Africa/Nairobi' }, jobId: name, removeOnComplete: true, removeOnFail: 100 });
  }
};

export const runInventoryDeliveryJob = async (name: string): Promise<boolean> => {
  if (name === DELIVERY_WAITING_JOB) {
    const told = await notifyWaitingDeliveries();
    if (told > 0) logger.info({ told }, 'Deliveries waiting for the branch: Branch Managers told');
    return true;
  }
  if (name === DISCREPANCY_REMINDER_JOB) {
    const sent = await remindOpenDiscrepancies();
    if (sent > 0) logger.info({ sent }, 'Discrepancy reminders sent to the Store Manager');
    return true;
  }
  return false;
};
