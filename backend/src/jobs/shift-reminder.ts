import type { Queue } from 'bullmq';
import { prisma } from '../config/database';
import { formatDateOnly, parseDateOnly } from '../utils/date-only';
import { logger } from '../utils/logger';

interface ShiftReminderDispatchJobData {
  userId: string;
  shiftName: string;
  startTime: string;
  date: string;
}

const nairobiDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Nairobi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const getNairobiDateString = (date: Date = new Date()): string => {
  const parts = nairobiDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to format Nairobi date');
  }

  return `${year}-${month}-${day}`;
};

const getTomorrowInNairobi = (): Date => {
  const todayInNairobi = parseDateOnly(getNairobiDateString());
  const tomorrow = new Date(todayInNairobi);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

export const enqueueTomorrowShiftReminderDispatchJobs = async (queue: Queue): Promise<number> => {
  const tomorrow = getTomorrowInNairobi();
  const tomorrowDate = formatDateOnly(tomorrow);

  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      date: tomorrow,
      user: {
        isActive: true,
      },
      shift: {
        isActive: true,
      },
    },
    select: {
      userId: true,
      shift: {
        select: {
          name: true,
          startTime: true,
        },
      },
    },
    orderBy: [{ userId: 'asc' }, { shift: { startTime: 'asc' } }],
  });

  const remindersByUser = new Map<string, ShiftReminderDispatchJobData>();
  for (const assignment of assignments) {
    if (!remindersByUser.has(assignment.userId)) {
      remindersByUser.set(assignment.userId, {
        userId: assignment.userId,
        shiftName: assignment.shift.name,
        startTime: assignment.shift.startTime,
        date: tomorrowDate,
      });
    }
  }

  const jobs = Array.from(remindersByUser.values());
  if (jobs.length === 0) {
    return 0;
  }

  await queue.addBulk(
    jobs.map((job) => ({
      name: 'shift.reminder.dispatch',
      data: job,
      opts: {
        jobId: `shift.reminder.dispatch:${job.userId}:${tomorrowDate}`,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    })),
  );

  logger.info({ count: jobs.length, date: tomorrowDate }, 'Queued shift reminder dispatch jobs');
  return jobs.length;
};

export const ensureShiftReminderSchedule = async (queue: Queue): Promise<void> => {
  await queue.add(
    'shift.reminder.schedule',
    {},
    {
      repeat: {
        pattern: '0 21 * * *',
        tz: 'Africa/Nairobi',
      },
      jobId: 'shift.reminder.schedule',
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
};
