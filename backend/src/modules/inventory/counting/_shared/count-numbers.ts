import type { Prisma } from '@prisma/client';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { nairobiDay } from './count-time';

/** The `CNT` counter's prefix in `reference_counters` (gap-free per site). */
export const COUNT_PREFIX = 'CNT';

/** "CNT-2026-0007": the year the count started (Nairobi) and the gap-free number padded to 4. The number never resets with the year. */
export const formatCountReference = (startedAt: Date, number: number): string =>
  `${COUNT_PREFIX}-${nairobiDay(startedAt).slice(0, 4)}-${String(number).padStart(4, '0')}`;

/** Takes the next number in the SAME transaction that creates the count. */
export const nextCountReference = async (tx: Prisma.TransactionClient, siteId: string, startedAt: Date): Promise<string> =>
  formatCountReference(startedAt, await referenceCounterRepository.nextNumber(tx, siteId, COUNT_PREFIX));
