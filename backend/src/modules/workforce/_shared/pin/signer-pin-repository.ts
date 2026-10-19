import { prisma } from '../../../../config/database';

/** Read-only: the signer's own PIN hash. A person who is inactive or removed cannot sign. */
export const signerPinRepository = {
  hashOf: async (userId: string): Promise<string | null> => (await prisma.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { pinHash: true } }))?.pinHash ?? null,
};
