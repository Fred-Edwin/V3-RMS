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

// ─── Approval (Branch Manager) — Session B ─────────────────────────────────

export type RequisitionDisplayStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'RETURNED';

export interface RequisitionApprovalLine {
  id: string;
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  categoryName: string | null;
  parentCategoryName: string | null;
  /** Always null this milestone — no branch-department ledger exists yet. */
  onHand: null;
  parAtRequest: string | null;
  requestedQty: string | null;
  approvedQty: string | null;
  editReason: string | null;
  isEdited: boolean;
}

export interface RequisitionApprovalSection {
  departmentTag: DepartmentTag;
  status: RequisitionSectionStatus;
  managerNote: string | null;
  returnedNote: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  isAsRequested: boolean;
  changedLineCount: number;
  totalUnits: string;
  lines: RequisitionApprovalLine[];
}

export interface RequisitionApprovalDetail {
  id: string;
  type: RequisitionType;
  note: string | null;
  status: RequisitionStatus;
  openedAt: string;
  approvedAt: string | null;
  approvedByName: string | null;
  sections: RequisitionApprovalSection[];
}

export interface RequisitionManagerListRow {
  id: string;
  type: RequisitionType;
  note: string | null;
  status: RequisitionStatus;
  openedAt: string;
  totalUnits: string;
  sectionsSubmitted: number;
  sectionsTotal: number;
}

/**
 * Milestone Five addition (session-a-plan.md §1.4, additive only): one entry
 * per department this requisition has been dispatched for, cross-linking
 * History to the Dispatch/Delivery screens. Empty array when nothing has
 * been dispatched yet.
 */
export interface RequisitionDispatchSummaryEntry {
  dispatchId: string;
  departmentTag: DepartmentTag;
  status: 'AWAITING' | 'IN_TRANSIT' | 'CONFIRMED' | 'DISCREPANCY_OPEN';
  sequenceLabel: string;
}

export interface RequisitionHistoryRow {
  id: string;
  type: RequisitionType;
  note: string | null;
  openedAt: string;
  approvedAt: string | null;
  displayStatus: RequisitionDisplayStatus;
  signedByName: string | null;
  totalUnits: string;
  dispatchSummary: RequisitionDispatchSummaryEntry[];
}

export interface ApprovalLineEditInput {
  id?: string;
  inventoryItemId?: string;
  approvedQty: string | null;
  editReason?: string;
  deleted?: boolean;
}

export interface UpsertApprovalLinesInput {
  lines: ApprovalLineEditInput[];
  fillMyself?: boolean;
}

export interface ApproveRequisitionInput {
  pin: string;
}

export interface ReturnSectionInput {
  note: string;
}

export interface ListRequisitionHistoryQuery {
  from?: string;
  to?: string;
  status?: RequisitionDisplayStatus;
  limit?: number;
  cursor?: string;
}

export interface ListNeedsApprovalQuery {
  limit?: number;
}
