import type { Queue } from 'bullmq';
import { inventoryNotify } from '../modules/inventory/_shared/notify';
import { URGENT_ESCALATION_MS } from '../modules/inventory/requisitions/requisitions-state';
import { requisitionsRepository } from '../modules/inventory/requisitions/requisitions-repository';
import type { Notification } from '../modules/inventory/_shared/notify';
import { logger } from '../utils/logger';

/**
 * Urgent escalation (contract §5 and §7, map row 3): an Urgent requisition still unsigned one hour after it was marked Urgent
 * tells the Director, once. Runs every minute in the existing report worker.
 *
 * Idempotent: the claim stamps `urgentEscalatedAt` in one conditional update that succeeds for exactly one run, so two workers or
 * a retried job cannot send twice, and a requisition already escalated is never picked up again. Only unsigned requisitions
 * qualify (Collecting or Ready to approve); a signed or cancelled one never escalates. Clearing Urgent and setting it again starts a
 * new hour and clears the stamp (the repository's `setUrgent`). The push is NOT held for quiet hours: a stuck urgent order is the
 * reason to wake the Director; only the count alert is held (contract §7).
 */
export const URGENT_ESCALATION_JOB = 'requisition-urgent-escalation.schedule';

export interface EscalationDeps {
  findDue: (cutoff: Date) => Promise<Array<{ id: string; siteId: string; reference: string; urgentNote: string | null; siteName: string }>>;
  claim: (siteId: string, id: string, cutoff: Date, at: Date) => Promise<boolean>;
  send: (n: Notification) => Promise<void>;
}

export const createEscalator = (deps: EscalationDeps) => async (now: Date = new Date()): Promise<number> => {
  const cutoff = new Date(now.getTime() - URGENT_ESCALATION_MS);
  const due = await deps.findDue(cutoff);
  let escalated = 0;
  for (const r of due) {
    if (!(await deps.claim(r.siteId, r.id, cutoff, now))) continue;
    escalated += 1;
    await deps.send({
      audiences: [{ kind: 'directors' }],
      message: {
        title: 'Urgent requisition waiting',
        body: `${r.reference} at ${r.siteName} has been Urgent and unapproved for over an hour.${r.urgentNote ? ` ${r.urgentNote}` : ''}`,
        link: `/app/branch/requisitions/${r.id}`,
        tag: `requisition-urgent-escalation-${r.id}`,
        data: { type: 'requisition_urgent_escalation', requisitionId: r.id },
        urgency: 'high',
      },
      badgeSites: [r.siteId],
      reason: 'requisition.urgent_escalated',
    });
  }
  if (escalated > 0) logger.info({ escalated }, 'Urgent requisitions escalated to the Director');
  return escalated;
};

export const escalateUrgentRequisitions = createEscalator({
  findDue: requisitionsRepository.findDueForEscalation,
  claim: requisitionsRepository.claimEscalation,
  send: (n) => inventoryNotify.send(n),
});

export const ensureUrgentEscalationSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    URGENT_ESCALATION_JOB,
    {},
    { repeat: { pattern: '* * * * *', tz: 'Africa/Nairobi' }, jobId: URGENT_ESCALATION_JOB, removeOnComplete: true, removeOnFail: 100 },
  );
};
