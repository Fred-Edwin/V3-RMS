import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { formatCountReference, nextCountReference } from './count-numbers';
import { referenceCounterRepository } from '../../_shared/reference-counter';

vi.mock('../../_shared/reference-counter', () => ({ referenceCounterRepository: { nextNumber: vi.fn() } }));

describe('count references', () => {
  it('is CNT-{year}-{number padded to 4}', () => {
    expect(formatCountReference(new Date('2026-10-13T04:05:00Z'), 1)).toBe('CNT-2026-0001');
    expect(formatCountReference(new Date('2026-10-13T04:05:00Z'), 1013)).toBe('CNT-2026-1013');
    expect(formatCountReference(new Date('2026-10-13T04:05:00Z'), 12345)).toBe('CNT-2026-12345');
  });

  it('uses the Nairobi year: 23:30 UTC on 31 Dec is already 1 Jan in Nairobi, and the number does not reset', () => {
    expect(formatCountReference(new Date('2026-12-31T23:30:00Z'), 412)).toBe('CNT-2027-0412');
  });

  it('takes the number from the CNT counter of the site, in the caller’s transaction', async () => {
    vi.mocked(referenceCounterRepository.nextNumber).mockResolvedValue(7);
    const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;
    await expect(nextCountReference(tx, 'hub-1', new Date('2026-10-13T04:05:00Z'))).resolves.toBe('CNT-2026-0007');
    expect(referenceCounterRepository.nextNumber).toHaveBeenCalledWith(tx, 'hub-1', 'CNT');
  });
});
