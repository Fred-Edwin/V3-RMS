import { Prisma } from '@prisma/client';
import { formatAmount } from './expected-yield';
import type { VsUsual } from './prep-contract';

/**
 * The manager-only flags on a run (docs/features/inventory/prep-plan.md §1.2, §3.3). They are computed here and shown only to
 * callers holding `prep.read_flags`: the silent stock flag and `needsLook` never appear in an Attendant payload.
 */

export type StockCheckLine = {
  itemName: string;
  unit: string;
  quantity: Prisma.Decimal.Value;
  /** The stock the ledger showed when the run was recorded; null when it was not captured. */
  onHand: Prisma.Decimal.Value | null;
};

/** An input exceeds expected stock when the run used more than the ledger showed. A run still saves; this only flags it. */
export const exceedsStock = (quantity: Prisma.Decimal.Value, onHand: Prisma.Decimal.Value | null): boolean =>
  onHand !== null && new Prisma.Decimal(quantity).gt(new Prisma.Decimal(onHand));

export const hasStockFlag = (lines: readonly StockCheckLine[]): boolean => lines.some((line) => exceedsStock(line.quantity, line.onHand));

/** "Used 12 kg beef mince; 5 kg was in stock", one clause per input that went over. Null when none did. */
export const exceedsText = (lines: readonly StockCheckLine[]): string | null => {
  const over = lines.filter((line) => exceedsStock(line.quantity, line.onHand));
  if (over.length === 0) return null;
  return over
    .map((line) => `Used ${formatAmount(line.quantity, line.unit)} ${line.unit} ${line.itemName}; ${formatAmount(line.onHand ?? 0, line.unit)} ${line.unit} was in stock`)
    .join('; ');
};

/** Why a run sits in Needs a look, in the manager's words. Empty when nothing is wrong. */
export const flagReasons = (input: { vsUsual: VsUsual; stockExceeded: boolean; isCorrection: boolean }): string[] => {
  const reasons: string[] = [];
  if (input.vsUsual.label === 'LOW' || input.vsUsual.label === 'HIGH') reasons.push(input.vsUsual.text);
  if (input.stockExceeded) reasons.push('Used more than was in stock');
  if (input.isCorrection) reasons.push('Corrected run');
  return reasons;
};
