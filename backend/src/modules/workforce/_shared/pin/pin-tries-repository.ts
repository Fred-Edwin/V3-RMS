import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database'; // a repository: the transaction below is the lock that serialises one person's checks
import { type PinAttempt, type PinPurpose, type PinTryStore } from './pin-door';
import { ALERT_AT, WINDOW_MS, shouldAlert, waitRemaining } from './pin-pause';

/**
 * The database store of PIN and code tries (`workforce_pin_tries`). Every try is recorded (who, what for, right or wrong; never
 * the digits), so a restart or a second server does not clear the count. One person's checks run one at a time (an advisory lock
 * on the person and purpose), so two phones guessing together cannot slip past the pause.
 */
export const pinTriesRepository: PinTryStore = {
  async attempt(userId: string, purpose: PinPurpose, now: Date, check: () => Promise<boolean>): Promise<PinAttempt> {
    return prisma.$transaction(async (tx): Promise<PinAttempt> => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`pin-tries:${purpose}:${userId}`}))`);
      const windowStart = new Date(now.getTime() - WINDOW_MS);
      const lastRight = await tx.workforcePinTry.findFirst({ where: { userId, purpose, success: true, createdAt: { gt: windowStart } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
      const since = lastRight ? lastRight.createdAt : windowStart;
      const wrong = await tx.workforcePinTry.findMany({ where: { userId, purpose, success: false, createdAt: { gt: since } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
      const wait = waitRemaining(wrong.length, wrong[0]?.createdAt ?? null, now);
      if (wait > 0) return { kind: 'SLOW', wait };
      const right = await check();
      await tx.workforcePinTry.create({ data: { userId, purpose, success: right, createdAt: now }, select: { id: true } });
      if (right) return { kind: 'RIGHT' };
      const count = wrong.length + 1;
      return { kind: 'WRONG', count, alert: shouldAlert(count, wrong.length >= ALERT_AT) };
    });
  },
};
