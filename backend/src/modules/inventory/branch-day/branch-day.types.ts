/**
 * Branch day close — Milestone Six, Session 3
 * FROZEN API CONTRACT — TypeScript types, inferred from `branch-day-validators.ts`.
 * Mirrored (by hand) in `frontend/features/branch-day/types/branch-day.ts`.
 */
import type { z } from 'zod';

import type {
  AcceptOpeningResultSchema,
  AcceptOpeningSchema,
  BranchDayDetailSchema,
  BranchDayTodaySchema,
  HistoryListSchema,
  HistoryQuerySchema,
  HistoryRowSchema,
  OpeningLineSchema,
  OpeningViewSchema,
  ReopenEntrySchema,
  CloseBlockerSchema,
  CloseDaySchema,
  CloseResultSchema,
  DayDocumentSchema,
  DepartmentDayDetailSchema,
  DepartmentDaySummarySchema,
  DepartmentLineSchema,
  ReopenDaySchema,
  ReopenResultSchema,
  SaveDepartmentLinesSchema,
  SaveLinesResultSchema,
  departmentTagSchema,
  gapReasonSchema,
} from './branch-day-validators';

export type DepartmentTagValue = z.infer<typeof departmentTagSchema>;
export type GapReasonValue = z.infer<typeof gapReasonSchema>;
export type DepartmentDaySummary = z.infer<typeof DepartmentDaySummarySchema>;
export type DepartmentLine = z.infer<typeof DepartmentLineSchema>;
export type DepartmentDayDetail = z.infer<typeof DepartmentDayDetailSchema>;
export type CloseBlocker = z.infer<typeof CloseBlockerSchema>;
export type BranchDayToday = z.infer<typeof BranchDayTodaySchema>;
export type SaveDepartmentLinesInput = z.infer<typeof SaveDepartmentLinesSchema>;
export type SaveLinesResult = z.infer<typeof SaveLinesResultSchema>;
export type CloseDayInput = z.infer<typeof CloseDaySchema>;
export type CloseResult = z.infer<typeof CloseResultSchema>;
export type ReopenDayInput = z.infer<typeof ReopenDaySchema>;
export type ReopenResult = z.infer<typeof ReopenResultSchema>;
export type DayDocument = z.infer<typeof DayDocumentSchema>;

// Session 4 — history, detail, opening
export type HistoryRow = z.infer<typeof HistoryRowSchema>;
export type HistoryList = z.infer<typeof HistoryListSchema>;
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
export type ReopenEntry = z.infer<typeof ReopenEntrySchema>;
export type BranchDayDetail = z.infer<typeof BranchDayDetailSchema>;
export type OpeningLine = z.infer<typeof OpeningLineSchema>;
export type OpeningView = z.infer<typeof OpeningViewSchema>;
export type AcceptOpeningInput = z.infer<typeof AcceptOpeningSchema>;
export type AcceptOpeningResult = z.infer<typeof AcceptOpeningResultSchema>;
