/** PIN lookups for Purchasing: database access only. */
import type { UserRole } from '@prisma/client';
import { prisma } from '../../../../config/database';

export interface PinHolder {
  id: string;
  name: string;
  role: UserRole;
  pinHash: string | null;
}

export const pinRepository = {
  findHolder: (userId: string): Promise<PinHolder | null> =>
    prisma.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { id: true, name: true, role: true, pinHash: true } }),

  /** Active people of these roles who have a PIN, on the hub or with no organization (the System Admin). */
  findApprovers: (siteId: string, roles: readonly UserRole[]): Promise<PinHolder[]> =>
    prisma.user.findMany({
      where: { isActive: true, deletedAt: null, pinHash: { not: null }, role: { in: [...roles] }, OR: [{ siteId }, { siteId: null }] },
      select: { id: true, name: true, role: true, pinHash: true },
    }),
};
