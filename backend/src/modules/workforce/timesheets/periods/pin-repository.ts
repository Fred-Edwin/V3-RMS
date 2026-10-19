import { prisma } from '../../../../config/database';

/** Read-only: the signer's own PIN hash. A missing PIN and a wrong PIN look the same to the caller. */
export const pinRepository = {
  hashOf: async (userId: string): Promise<string | null> => (await prisma.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { pinHash: true } }))?.pinHash ?? null,
};
