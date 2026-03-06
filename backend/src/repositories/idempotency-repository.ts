import { prisma } from '../config/database';

export const idempotencyRepository = {
  findByKey: async (key: string): Promise<{ orderId: string } | null> => {
    return prisma.idempotencyKey.findUnique({
      where: { key },
      select: { orderId: true },
    });
  },

  create: async (key: string, orderId: string): Promise<void> => {
    await prisma.idempotencyKey.create({
      data: { key, orderId },
    });
  },

  pruneOlderThan: async (cutoff: Date): Promise<number> => {
    const result = await prisma.idempotencyKey.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  },
};
