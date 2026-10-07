import type { RunDetail } from '../_shared/prep-contract';

export type { CancelInput, CorrectInput } from '../_shared/prep-contract';

/** `replayed` is true when the same idempotency key had already made the new run (HTTP 200 instead of 201). */
export type CorrectOutcome = { run: RunDetail; replayed: boolean };

export type CancelPreviewItem = {
  itemId: string;
  itemName: string;
  onHandNow: string;
  onHandAfter: string;
  unit: string;
  belowZero: boolean;
};
