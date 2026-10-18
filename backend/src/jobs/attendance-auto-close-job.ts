import type { Queue } from 'bullmq';
import { sweepAutoClose } from '../modules/workforce';
import { logger } from '../utils/logger';

export const ATTENDANCE_AUTO_CLOSE_JOB = 'attendance.auto-close';

/**
 * Closes shifts nobody answered the end-of-shift prompt for (after the rule's minutes), and clock-ins left open past
 * midnight. Only sites whose new clock is switched on are looked at, so for every other site this does nothing.
 */
export const runAttendanceAutoCloseJob = async (): Promise<number> => {
  const { closed } = await sweepAutoClose();
  if (closed > 0) logger.info({ closed }, 'Attendance auto-close closed shifts');
  return closed;
};

// Every minute: the prompt gives a person about 15 minutes, so a closer sweep keeps the close close to the deadline.
export const ensureAttendanceAutoCloseSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    ATTENDANCE_AUTO_CLOSE_JOB,
    {},
    {
      repeat: { pattern: '* * * * *', tz: 'Africa/Nairobi' },
      jobId: ATTENDANCE_AUTO_CLOSE_JOB,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};
