/** PIN lookup for Counting: database access only. */
import type { UserRole } from '@prisma/client';
import { prisma } from '../../../../config/database';

export interface PinHolder {
  id: string;
  name: string;
  role: UserRole;
  pinHash: string | null;
}

export const countPinRepository = {
  findHolder: (userId: string): Promise<PinHolder | null> =>
    prisma.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { id: true, name: true, role: true, pinHash: true } }),
};
