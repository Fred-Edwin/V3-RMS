import type { Queue } from 'bullmq';
import { sweepLeave } from '../modules/workforce';
import { logger } from '../utils/logger';

export const LEAVE_ESCALATION_JOB = 'leave.escalation';

/** Moves leave requests that waited 72 hours for a Branch or Store Manager on to HR (writes the step, the audit entry and the notices). */
export const runLeaveEscalationJob = async (): Promise<{ moved: number; failed: number }> => {
  const result = await sweepLeave();
  if (result.moved > 0 || result.failed > 0) logger.info(result, 'Leave escalation');
  return result;
};

// Every hour, on the hour, Nairobi time. The stage itself is derived from the ask time, so a missed run changes nothing but the notices.
export const ensureLeaveEscalationSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    LEAVE_ESCALATION_JOB,
    {},
    { repeat: { pattern: '0 * * * *', tz: 'Africa/Nairobi' }, jobId: LEAVE_ESCALATION_JOB, removeOnComplete: true, removeOnFail: 100 },
  );
};
