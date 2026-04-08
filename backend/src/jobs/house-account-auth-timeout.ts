import type { Queue } from 'bullmq';
import { logger } from '../utils/logger';

export const AUTH_TIMEOUT_JOB_NAME = 'house-auth.timeout';
/** Default timeout in minutes before an authorization request auto-rejects */
export const AUTH_TIMEOUT_MINUTES = 5;

export interface HouseAuthTimeoutJobData {
  authRequestId: string;
}

/**
 * Enqueues a delayed job that auto-rejects a pending house account auth request
 * if the holder does not respond within AUTH_TIMEOUT_MINUTES.
 * Returns the BullMQ job ID so it can be stored and cancelled on resolution.
 */
export const enqueueAuthTimeoutJob = async (
  queue: Queue,
  authRequestId: string,
): Promise<string> => {
  const job = await queue.add(
    AUTH_TIMEOUT_JOB_NAME,
    { authRequestId } satisfies HouseAuthTimeoutJobData,
    {
      delay: AUTH_TIMEOUT_MINUTES * 60 * 1000,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );

  if (!job.id) {
    throw new Error(`Failed to enqueue auth timeout job for authRequestId: ${authRequestId}`);
  }

  logger.info({ authRequestId, jobId: job.id }, 'House account auth timeout job enqueued');
  return job.id;
};

/**
 * Cancels a pending timeout job if the holder or manager resolves the request first.
 * Safe to call even if the job has already fired (BullMQ ignores missing jobs).
 */
export const cancelAuthTimeoutJob = async (queue: Queue, jobId: string): Promise<void> => {
  try {
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info({ jobId }, 'House account auth timeout job cancelled');
    }
  } catch (error) {
    // Non-fatal: job may have already completed or been removed
    logger.warn({ error, jobId }, 'Could not cancel house account auth timeout job');
  }
};
