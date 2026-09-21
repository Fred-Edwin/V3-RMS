// Inventory — Milestone Three (Prep)
// Mirrors the FROZEN backend contract by hand (no pnpm workspace in this repo,
// so there is no shared package to import from).
//
// Authoritative source: backend/src/modules/inventory/prep-validators.ts
// (Zod schemas) + prep.types.ts (z.infer types). If this file's shape
// disagrees with that one, the backend file wins — fix this file, not the
// other way around. A contract test on the backend enforces the reverse
// direction (serializer output satisfies the schemas).
//
// Wire-format rule: every decimal (quantity, cost, total) crosses the wire
// as a string, never a JS number.
//
// Plan: docs/features/inventory/milestone-3-plan.md §3.
//
// Naming: routes live under /inventory/prep/… throughout — never confuse
// with the unrelated BDS/KDS "prep tickets" domain (API_CONTRACT.md §5).

// ─── Enums ──────────────────────────────────────────────────────────────────

/** `null` means "no typical yield to compare against yet" — never used for a run within the normal band. */
export type YieldVarianceLabel = 'normal' | 'low yield' | 'high yield';

/** Query-filter form — single-word, matches the runs-list/History filter chips. */
export type YieldFlagFilter = 'normal' | 'low' | 'high';

// ─── Prep runs ───────────────────────────────────────────────────────────────

export interface PrepRunInputsPreview {
  /** e.g. "6kg chicken". */
  firstItemLabel: string;
  remainingCount: number;
}

export interface PrepRunSummary {
  id: string;
  when: string;
  outputItemId: string;
  outputName: string;
  inputsPreview: PrepRunInputsPreview;
  actualYield: string;
  /** The output item's usage unit. */
  yieldUnit: string;
  /** Null only when no typical yield exists yet for this output item. */
  yieldVarianceLabel: YieldVarianceLabel | null;
  /** Signed quantity delta, e.g. "+0.5" / "-1.2". Null in lockstep with yieldVarianceLabel. */
  yieldVarianceDelta: string | null;
  outputUnitCost: string;
  createdByInitials: string;
}

export interface PrepRunInputLine {
  itemName: string;
  quantity: string;
  unit: string;
  unitCostAtRunTime: string;
  lineCost: string;
}

export interface PrepRunDetail extends PrepRunSummary {
  createdByName: string;
  createdAt: string;
  inputLines: PrepRunInputLine[];
  totalInputCost: string;
  /** Null in lockstep with yieldVarianceLabel/yieldVarianceDelta. */
  typicalYieldAtRunTime: string | null;
}

export interface CreatePrepRunInput {
  outputItemId: string;
  inputLines: Array<{ inventoryItemId: string; quantity: string }>;
  actualYield: string;
}

export interface ListPrepRunsQuery {
  search?: string;
  outputItemId?: string;
  yieldFlag?: YieldFlagFilter;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

export interface PrepSummary {
  runsInRange: number;
  totalInputCost: string;
  yieldFlagCount: number;
}

export interface PrepSummaryQuery {
  dateFrom?: string;
  dateTo?: string;
}

/** Powers the New Prep Run screen's "Typical: ~6kg chicken -> ~22L" nudge. */
export interface TypicalYield {
  outputItemId: string;
  typicalInputSummary: string | null;
  typicalYield: string | null;
  sampleSize: number;
}
