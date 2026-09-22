/**
 * Inventory — Milestone Four (Requisition & Branch Approval), Session A
 * FROZEN API CONTRACT (Session A subset) — TypeScript types.
 *
 * Every type here is inferred from the Zod schemas in
 * `requisitions-validators.ts` — the schemas are the single definition,
 * these are the compile-time view of them.
 *
 * Mirrored (by hand) in `frontend/features/requisitions/types/index.ts`.
 */
import type { z } from 'zod';

import type {
  ApproveRequisitionSchema,
  DepartmentTagParamSchema,
  ListNeedsApprovalQuerySchema,
  ListRequisitionHistoryQuerySchema,
  ListRequisitionsQuerySchema,
  OpenRequisitionSchema,
  RequisitionApprovalDetailSchema,
  RequisitionApprovalLineSchema,
  RequisitionApprovalSectionSchema,
  RequisitionHistoryRowSchema,
  RequisitionListRowSchema,
  RequisitionManagerListRowSchema,
  RequisitionSectionDetailSchema,
  RequisitionSectionLineSchema,
  RequisitionSectionParamsSchema,
  ReturnSectionSchema,
  UpsertApprovalLinesSchema,
  UpsertRequisitionLinesSchema,
  departmentTagSchema,
  requisitionDisplayStatusSchema,
  requisitionSectionStatusSchema,
  requisitionStatusSchema,
  requisitionTypeSchema,
} from './requisitions-validators';

// --- Enums --------------------------------------------------------------------

export type RequisitionType = z.infer<typeof requisitionTypeSchema>;
export type RequisitionStatus = z.infer<typeof requisitionStatusSchema>;
export type RequisitionSectionStatus = z.infer<typeof requisitionSectionStatusSchema>;
export type DepartmentTag = z.infer<typeof departmentTagSchema>;

// --- Requisitions (list / open) -----------------------------------------------

export type RequisitionListRow = z.infer<typeof RequisitionListRowSchema>;
export type OpenRequisitionInput = z.infer<typeof OpenRequisitionSchema>;
export type ListRequisitionsQuery = z.infer<typeof ListRequisitionsQuerySchema>;

// --- Section fill (Department Head) -------------------------------------------

export type DepartmentTagParam = z.infer<typeof DepartmentTagParamSchema>;
export type RequisitionSectionParams = z.infer<typeof RequisitionSectionParamsSchema>;
export type RequisitionSectionLine = z.infer<typeof RequisitionSectionLineSchema>;
export type RequisitionSectionDetail = z.infer<typeof RequisitionSectionDetailSchema>;
export type UpsertRequisitionLinesInput = z.infer<typeof UpsertRequisitionLinesSchema>;

// --- Approval (Branch Manager) — Session B --------------------------------

export type RequisitionDisplayStatus = z.infer<typeof requisitionDisplayStatusSchema>;
export type RequisitionApprovalLine = z.infer<typeof RequisitionApprovalLineSchema>;
export type RequisitionApprovalSection = z.infer<typeof RequisitionApprovalSectionSchema>;
export type RequisitionApprovalDetail = z.infer<typeof RequisitionApprovalDetailSchema>;
export type RequisitionManagerListRow = z.infer<typeof RequisitionManagerListRowSchema>;
export type RequisitionHistoryRow = z.infer<typeof RequisitionHistoryRowSchema>;
export type UpsertApprovalLinesInput = z.infer<typeof UpsertApprovalLinesSchema>;
export type ApproveRequisitionInput = z.infer<typeof ApproveRequisitionSchema>;
export type ReturnSectionInput = z.infer<typeof ReturnSectionSchema>;
export type ListRequisitionHistoryQuery = z.infer<typeof ListRequisitionHistoryQuerySchema>;
export type ListNeedsApprovalQuery = z.infer<typeof ListNeedsApprovalQuerySchema>;
