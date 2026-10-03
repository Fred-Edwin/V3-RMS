import { Prisma } from '@prisma/client';
import { lineVariance, lineVarianceValue, isReasonRequired, isDirectorAlert } from '../inventory/counting/count-calc';

export { lineVariance, lineVarianceValue, isReasonRequired, isDirectorAlert };

/** A gap line is one with a counted figure that differs from what the ledger expected. */
export const hasGap = (counted: Prisma.Decimal | null, expected: Prisma.Decimal): boolean => {
  const variance = lineVariance(counted, expected);
  return variance !== null && !variance.isZero();
};

/** A reason is satisfied when present, and `OTHER` also carries a note. */
export const reasonSatisfied = (reason: string | null, reasonNote: string | null): boolean =>
  reason !== null && (reason !== 'OTHER' || (reasonNote ?? '').trim().length > 0);
