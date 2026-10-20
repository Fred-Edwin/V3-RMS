import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Tx = Prisma.TransactionClient;

/** The few writes "This wasn't me" and the password reset make on accounts. Each is scoped by the person's id. */
export const sessionRepository = {
  flagOf: (userId: string) => prisma.workforceSecurityFlag.findUnique({ where: { userId } }),

  /** Raises the flag. False when it is already raised (a second press does nothing more). */
  async raiseFlag(tx: Tx, userId: string, now: Date): Promise<boolean> {
    const created = await tx.workforceSecurityFlag.createMany({ data: [{ userId, mustChangePassword: true, raisedAt: now }], skipDuplicates: true });
    if (created.count === 1) return true;
    // The row stays after a reset (it carries "tokens older than this are refused"): a new press raises it again.
    const again = await tx.workforceSecurityFlag.updateMany({ where: { userId, mustChangePassword: false }, data: { mustChangePassword: true, raisedAt: now } });
    return again.count === 1;
  },

  /** The password is set; the row stays so old sessions stay refused. */
  clearMustChange: (tx: Tx, userId: string) => tx.workforceSecurityFlag.updateMany({ where: { userId }, data: { mustChangePassword: false } }),

  deleteRefreshTokens: (tx: Tx, userId: string) => tx.refreshToken.deleteMany({ where: { userId } }),
  revokeUnlocks: (tx: Tx, userId: string, now: Date) => tx.payslipUnlock.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
  clearCode: (tx: Tx, userId: string) => tx.user.updateMany({ where: { id: userId }, data: { pinHash: null } }),
  setPassword: (tx: Tx, userId: string, passwordHash: string) => tx.user.updateMany({ where: { id: userId, isActive: true, deletedAt: null }, data: { passwordHash } }),
  passwordHashOf: async (userId: string): Promise<string | null> => (await prisma.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { passwordHash: true } }))?.passwordHash ?? null,
};
