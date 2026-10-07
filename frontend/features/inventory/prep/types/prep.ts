// Inventory — Prep: the OLD list and detail shapes, kept only for the old History page and run-detail drawer.
//
// TEMPORARY (Prep rebuild, Slice 2). The new contract is `../_shared/types/prep-contract.ts`; `../services/prep-api-service.ts`
// adapts the new endpoints to these shapes. This file is deleted with the old screens (Slices 3 and 4).
//
// Wire-format rule: every decimal (quantity, cost, total) is a string, never a JS number.

// ─── Enums ──────────────────────────────────────────────────────────────────

/** `null` means "no typical yield to compare against yet" — never used for a run within the normal band. */
export type YieldVarianceLabel = 'normal' | 'low yield' | 'high yield';

/** Query-filter form — single-word, matches the runs-list/History filter chips. */
export type YieldFlagFilter = 'normal' | 'low' | 'high';

// ─── Prep runs ───────────────────────────────────────────────────────────────

export interface PrepRunInputsPreview {
  /** e.g. "6 kg chicken". */
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
  /** Signed quantity delta, e.g. "+0.5" / "−1.2". Null in lockstep with yieldVarianceLabel. */
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
  /** True when the caller's role does not see run costs (the cost fields are then "0" and must not be drawn). */
  costsHidden: boolean;
  createdByName: string;
  createdAt: string;
  inputLines: PrepRunInputLine[];
  totalInputCost: string;
  /** Null in lockstep with yieldVarianceLabel/yieldVarianceDelta. */
  typicalYieldAtRunTime: string | null;
}

export interface ListPrepRunsQuery {
  search?: string;
  outputItemId?: string;
  yieldFlag?: YieldFlagFilter;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  /** 1-based page of `limit` runs. */
  page?: number;
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
