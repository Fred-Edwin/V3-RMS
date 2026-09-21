// Inventory — Milestone Four (Requisition & Branch Approval), Session A
// Mirrors the FROZEN backend contract by hand (no pnpm workspace in this
// repo, so there is no shared package to import from).
//
// Authoritative source: backend/src/modules/requisitions/requisitions-validators.ts
// (Zod schemas) + requisitions.types.ts (z.infer types). If this file's shape
// disagrees with that one, the backend file wins — fix this file, not the
// other way around. A contract test on the backend enforces the reverse
// direction (serializer output satisfies the schemas).
//
// Wire-format rule: every decimal (parAtRequest, requestedQty) crosses the
// wire as a string, never a JS number.
//
// Plan: docs/features/inventory/milestone-4-sessions/session-a-plan.md.
// Session B (branch-manager approve/return/edit) is not built here.

import type { DepartmentTag } from '@/features/inventory';

export type { DepartmentTag };

// ─── Enums ──────────────────────────────────────────────────────────────────

export type RequisitionType = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'AD_HOC';
export type RequisitionStatus = 'OPEN' | 'PENDING_APPROVAL' | 'APPROVED';
export type RequisitionSectionStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'RETURNED';

// ─── Requisitions (list / open) ────────────────────────────────────────────

export interface RequisitionListRow {
  id: string;
  type: RequisitionType;
  note: string | null;
  status: RequisitionStatus;
  openedAt: string;
  /** The caller's own department section status only — never other departments'. */
  mySectionStatus: RequisitionSectionStatus;
}

export interface OpenRequisitionInput {
  type: RequisitionType;
  note?: string;
}

export interface ListRequisitionsQuery {
  limit?: number;
}

// ─── Section fill (Department Head) ────────────────────────────────────────

export interface RequisitionSectionLine {
  id: string;
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  categoryName: string | null;
  parentCategoryName: string | null;
  /** Reference only — null when no RestockLevel exists for this branch department/item yet. */
  parAtRequest: string | null;
  requestedQty: string | null;
}

export interface RequisitionSectionDetail {
  requisitionId: string;
  departmentTag: DepartmentTag;
  status: RequisitionSectionStatus;
  managerNote: string | null;
  returnedNote: string | null;
  submittedAt: string | null;
  lines: RequisitionSectionLine[];
}

export interface UpsertRequisitionLineInput {
  id?: string;
  inventoryItemId?: string;
  requestedQty: string | null;
}

export interface UpsertRequisitionLinesInput {
  lines: UpsertRequisitionLineInput[];
  managerNote?: string;
}
