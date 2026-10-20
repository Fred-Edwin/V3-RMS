import type { Queue } from 'bullmq';
import { backfillAllAuditIndexes, reconcileDocuments, registerDocuments, runNightlyChainCheck } from '../modules/workforce';
import { logger } from '../utils/logger';

export const WORKFORCE_AUDIT_JOB = 'workforce.audit.nightly';

/**
 * 02:00 Nairobi (6a A6): checks the audit chain for the last two days, and the whole chain on Sundays; a break raises the System Admin
 * alert once. Also fills the index rows of any entry that predates the index (a no-op when none is missing). Changes no audit entry.
 */
export const runWorkforceAuditJob = async (): Promise<void> => {
  const indexed = await backfillAllAuditIndexes();
  registerDocuments(); // the worker process does not mount the routes, so it registers the sources itself (idempotent)
  const documents = await reconcileDocuments();
  if (documents.registered > 0 || documents.failed > 0) logger.info(documents, 'Signed documents indexed');
  const result = await runNightlyChainCheck();
  if (indexed > 0 || result.failed > 0 || result.checked > 0) logger.info({ ...result, indexed }, 'Workforce audit nightly check');
};

export const ensureWorkforceAuditSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(WORKFORCE_AUDIT_JOB, {}, { repeat: { pattern: '0 2 * * *', tz: 'Africa/Nairobi' }, jobId: WORKFORCE_AUDIT_JOB, removeOnComplete: true, removeOnFail: 100 });
};
