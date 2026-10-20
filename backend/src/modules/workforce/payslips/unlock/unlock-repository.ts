import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Tx = Prisma.TransactionClient;

export interface WindowState {
  wrong: number; // wrong tries since the later of the window start and the last correct code
  lastWrongAt: Date | null;
  alerted: boolean; // an alert was already raised inside this count
}

/** The payslip code tries and the unlock tokens. Nothing here ever holds a code, only whether a try was right. */
export const unlockRepository = {
  /** One writer at a time per person, so two phones guessing together cannot slip past the count or both raise the alert. */
  async lockPerson(tx: Tx, userId: string): Promise<void> {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`payslip-code:${userId}`}))`);
  },

  async windowState(tx: Tx, userId: string, windowStart: Date): Promise<WindowState> {
    const lastRight = await tx.payslipCodeTry.findFirst({ where: { userId, success: true, createdAt: { gte: windowStart } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    const since = lastRight && lastRight.createdAt > windowStart ? lastRight.createdAt : windowStart;
    const wrong = await tx.payslipCodeTry.findMany({ where: { userId, success: false, createdAt: { gt: since } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, alerted: true } });
    return { wrong: wrong.length, lastWrongAt: wrong[0]?.createdAt ?? null, alerted: wrong.some((w) => w.alerted) };
  },

  addTry: (tx: Tx, data: { userId: string; deviceId: string; success: boolean; confirmed: boolean; alerted: boolean; createdAt: Date }) => tx.payslipCodeTry.create({ data, select: { id: true } }),

  createUnlock: (tx: Tx, data: { userId: string; deviceId: string; tokenHash: string; createdAt: Date; expiresAt: Date }) =>
    tx.payslipUnlock.create({ data: { ...data, lastUsedAt: data.createdAt }, select: { id: true } }),

  findUnlock: (tokenHash: string) => prisma.payslipUnlock.findUnique({ where: { tokenHash } }),

  /** A tap on a payslip screen keeps the unlock open (PD2). */
  touch: (id: string, now: Date) => prisma.payslipUnlock.updateMany({ where: { id, revokedAt: null }, data: { lastUsedAt: now } }),

  /** Leaving My payslips, or the app going to the background, locks again. */
  revoke: (userId: string, deviceId: string, now: Date) => prisma.payslipUnlock.updateMany({ where: { userId, deviceId, revokedAt: null }, data: { revokedAt: now } }),

  /** A first code, set only while the person has none (atomic: two taps set one). True when this call set it. */
  async setFirstPin(tx: Tx, userId: string, pinHash: string): Promise<boolean> {
    const result = await tx.user.updateMany({ where: { id: userId, pinHash: null, isActive: true, deletedAt: null }, data: { pinHash } });
    return result.count === 1;
  },

  hasCode: async (userId: string): Promise<boolean> => (await prisma.user.count({ where: { id: userId, pinHash: { not: null } } })) === 1,

  userNames: async (ids: readonly string[]) => new Map((await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true } })).map((u) => [u.id, u])),
};
