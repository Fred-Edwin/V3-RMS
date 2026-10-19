import type { Queue } from 'bullmq';
import { refreshPayrollEstimates, sweepPayroll } from '../modules/workforce';
import { logger } from '../utils/logger';

export const PAYROLL_SWEEP_JOB = 'payroll.sweep';
export const PAYROLL_ESTIMATE_JOB = 'payroll.estimate';

/**
 * Makes the month's row when a month ends, and calculates it once every site on the new system has approved and the tax tables are
 * confirmed (within 15 minutes of the last approval, P5). For a company with no site on the new system it does nothing.
 */
export const runPayrollSweepJob = async (): Promise<void> => {
  const result = await sweepPayroll();
  if (result.created + result.calculated + result.failed > 0) logger.info(result, 'Payroll sweep');
};

/** The Director's estimate of the running month, refreshed every night (P28). */
export const runPayrollEstimateJob = async (): Promise<void> => {
  const result = await refreshPayrollEstimates();
  if (result.computed + result.failed > 0) logger.info(result, 'Payroll estimates refreshed');
};

// Every ten minutes for the sweep (a calculation starts within 15 minutes of the last approval); 00:30 Nairobi for the estimate.
export const ensurePayrollSchedules = async (queue: Queue): Promise<void> => {
  await queue.add(PAYROLL_SWEEP_JOB, {}, { repeat: { pattern: '*/10 * * * *', tz: 'Africa/Nairobi' }, jobId: PAYROLL_SWEEP_JOB, removeOnComplete: true, removeOnFail: 100 });
  await queue.add(PAYROLL_ESTIMATE_JOB, {}, { repeat: { pattern: '30 0 * * *', tz: 'Africa/Nairobi' }, jobId: PAYROLL_ESTIMATE_JOB, removeOnComplete: true, removeOnFail: 100 });
};
