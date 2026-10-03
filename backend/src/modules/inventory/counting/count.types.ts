/**
 * Inventory — Milestone Six, Session 2 (Central Store counting)
 * FROZEN API CONTRACT — TypeScript types, inferred from `count-validators.ts`.
 * Mirrored (by hand) in `frontend/features/inventory/types/count.ts`.
 */
import type { z } from 'zod';

import type {
  ApproveCountResultSchema,
  ApproveCountSchema,
  AttendantCountViewSchema,
  AttendantSaveResultSchema,
  AttendantSubmitResultSchema,
  CountListItemSchema,
  CountListSchema,
  CountPrintSchema,
  CountTotalsSchema,
  DecideLineSchema,
  ListCountsQuerySchema,
  ReturnCountResultSchema,
  ReturnCountSchema,
  SaveCountLinesSchema,
  SpotCountResultSchema,
  SpotCountSchema,
  SubmitCountSchema,
  VerifierCountLineSchema,
  VerifierCountViewSchema,
  countKindSchema,
  countLineDecisionSchema,
  countReasonSchema,
  countStatusSchema,
} from './count-validators';

export type CountKind = z.infer<typeof countKindSchema>;
export type CountStatus = z.infer<typeof countStatusSchema>;
export type CountLineDecision = z.infer<typeof countLineDecisionSchema>;
export type CountReasonValue = z.infer<typeof countReasonSchema>;

export type AttendantCountView = z.infer<typeof AttendantCountViewSchema>;
export type SaveCountLinesInput = z.infer<typeof SaveCountLinesSchema>;
export type AttendantSaveResult = z.infer<typeof AttendantSaveResultSchema>;
export type SubmitCountInput = z.infer<typeof SubmitCountSchema>;
export type AttendantSubmitResult = z.infer<typeof AttendantSubmitResultSchema>;

export type VerifierCountLine = z.infer<typeof VerifierCountLineSchema>;
export type CountTotals = z.infer<typeof CountTotalsSchema>;
export type VerifierCountView = z.infer<typeof VerifierCountViewSchema>;

export type ListCountsQuery = z.infer<typeof ListCountsQuerySchema>;
export type CountListItem = z.infer<typeof CountListItemSchema>;
export type CountList = z.infer<typeof CountListSchema>;

export type DecideLineInput = z.infer<typeof DecideLineSchema>;
export type ReturnCountInput = z.infer<typeof ReturnCountSchema>;
export type ApproveCountInput = z.infer<typeof ApproveCountSchema>;
export type ApproveCountResult = z.infer<typeof ApproveCountResultSchema>;
export type ReturnCountResult = z.infer<typeof ReturnCountResultSchema>;

export type SpotCountInput = z.infer<typeof SpotCountSchema>;
export type SpotCountResult = z.infer<typeof SpotCountResultSchema>;

export type CountPrint = z.infer<typeof CountPrintSchema>;
