import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { referenceCounterRepository } from './reference-counter';

const txReturning = (lastNumber: number) => {
  const upsert = vi.fn().mockResolvedValue({ lastNumber });
  return { tx: { referenceCounter: { upsert } } as unknown as Prisma.TransactionClient, upsert };
};

describe('referenceCounterRepository', () => {
  it('nextNumber increments the (site, prefix) counter and returns the bare integer', async () => {
    const { tx, upsert } = txReturning(12);
    await expect(referenceCounterRepository.nextNumber(tx, 'site-1', 'CNT')).resolves.toBe(12);
    expect(upsert).toHaveBeenCalledWith({
      where: { siteId_prefix: { siteId: 'site-1', prefix: 'CNT' } },
      update: { lastNumber: { increment: 1 } },
      create: { siteId: 'site-1', prefix: 'CNT', lastNumber: 1 },
      select: { lastNumber: true },
    });
  });

  it('nextReference formats the same number as PREFIX-0007', async () => {
    const { tx } = txReturning(7);
    await expect(referenceCounterRepository.nextReference(tx, 'site-1', 'ADJ')).resolves.toBe('ADJ-0007');
    await expect(referenceCounterRepository.nextReference(tx, 'site-1', 'X', 6)).resolves.toBe('X-000007');
  });
});
