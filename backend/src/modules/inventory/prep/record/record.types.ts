import type { Prisma } from '@prisma/client';
import type { PrepRunRow } from '../_shared/prep-run-repository';
import type { RunDetail } from '../_shared/prep-contract';

export type { CheckInput, CheckResult, RecordInput } from '../_shared/prep-contract';

export type RecordOutcome = { run: RunDetail; replayed: boolean };

export type ItemFacts = { id: string; name: string; usageUnit: string; currentCost: Prisma.Decimal };

/** One ingredient of a run with the figures it was judged on. */
export type AssessedLine = {
  itemId: string;
  item: ItemFacts;
  quantity: Prisma.Decimal;
  /** Stock the ledger showed when this was assessed. */
  onHand: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  lineCost: Prisma.Decimal;
  exceeds: boolean;
};

export type RecordedRow = PrepRunRow;
