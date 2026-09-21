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
  DepartmentTagParamSchema,
  ListRequisitionsQuerySchema,
  OpenRequisitionSchema,
  RequisitionListRowSchema,
  RequisitionSectionDetailSchema,
  RequisitionSectionLineSchema,
  RequisitionSectionParamsSchema,
  UpsertRequisitionLinesSchema,
  departmentTagSchema,
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
