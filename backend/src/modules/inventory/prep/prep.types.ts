/**
 * Inventory — Milestone Three (Prep)
 * FROZEN API CONTRACT — TypeScript types.
 *
 * Every type here is inferred from the Zod schemas in `prep-validators.ts` —
 * the schemas are the single definition, these are the compile-time view of
 * them. Do not hand-write a type that duplicates a schema; infer it.
 *
 * Plan: `docs/features/inventory/milestone-3-plan.md` §3.
 * Mirrored (by hand) in `frontend/features/inventory/types/prep.ts`.
 */
import type { z } from 'zod';

import type {
  CreatePrepRunSchema,
  ListPrepRunsQuerySchema,
  PrepRunDetailSchema,
  PrepRunInputLineSchema,
  PrepRunInputsPreviewSchema,
  PrepRunSummarySchema,
  PrepSummaryQuerySchema,
  PrepSummarySchema,
  TypicalYieldSchema,
  yieldFlagFilterSchema,
  yieldVarianceLabelSchema,
} from './prep-validators';

// --- Enums -----------------------------------------------------------------

export type YieldVarianceLabel = z.infer<typeof yieldVarianceLabelSchema>;
export type YieldFlagFilter = z.infer<typeof yieldFlagFilterSchema>;

// --- Prep runs ---------------------------------------------------------------

export type PrepRunInputsPreview = z.infer<typeof PrepRunInputsPreviewSchema>;
export type PrepRunSummary = z.infer<typeof PrepRunSummarySchema>;
export type PrepRunInputLine = z.infer<typeof PrepRunInputLineSchema>;
export type PrepRunDetail = z.infer<typeof PrepRunDetailSchema>;

export type CreatePrepRunInput = z.infer<typeof CreatePrepRunSchema>;
export type ListPrepRunsQuery = z.infer<typeof ListPrepRunsQuerySchema>;

export type PrepSummary = z.infer<typeof PrepSummarySchema>;
export type PrepSummaryQuery = z.infer<typeof PrepSummaryQuerySchema>;

export type TypicalYield = z.infer<typeof TypicalYieldSchema>;
