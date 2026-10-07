/**
 * Inventory — Milestone Five (Dispatch & Branch Receiving), Session A.
 * Hand-mirrors `backend/src/modules/dispatch/dispatch-validators.ts`
 * (the frozen contract source of truth). Keep in sync by hand — no shared
 * package in this repo.
 */
import type { DepartmentTag } from '@/features/inventory';

export type { DepartmentTag };

export type DispatchStatus = 'AWAITING' | 'IN_TRANSIT' | 'CONFIRMED' | 'DISCREPANCY_OPEN';

export type RequisitionType = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'AD_HOC';

// --- Dispatch queue (C1/C2) ----------------------------------------------------

export interface DispatchQueueDepartment {
  departmentTag: DepartmentTag;
  status: DispatchStatus | null; // null = approved, not yet dispatched
  totalUnits: string;
  dispatchId: string | null;
}

export interface DispatchQueueRow {
  requisitionId: string;
  toOrganizationId: string;
  branchName: string;
  requisitionType: RequisitionType;
  openedAt: string;
  departments: DispatchQueueDepartment[];
}

export interface ListDispatchQueueQuery {
  limit?: number;
}

// --- Fulfil detail (C2) ---------------------------------------------------------

export interface FulfilLine {
  requisitionLineId: string | null;
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  requestedQty: string | null;
  onHandQty: string;
  dispatchQty: string;
  isSubstitute: boolean;
  substituteNote: string | null;
}

export type RequisitionSectionStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'RETURNED';

export interface FulfilSection {
  departmentTag: DepartmentTag;
  status: RequisitionSectionStatus;
  dispatchStatus: DispatchStatus | null;
  dispatchId: string | null;
  lines: FulfilLine[];
}

export interface FulfilDetail {
  requisitionId: string;
  toOrganizationId: string;
  branchName: string;
  requisitionType: RequisitionType;
  openedAt: string;
  sections: FulfilSection[];
}

export interface FulfilLineInput {
  requisitionLineId?: string | null;
  inventoryItemId: string;
  dispatchQty: string;
  isSubstitute?: boolean;
  substituteNote?: string;
}

export interface FulfilDepartmentInput {
  lines: FulfilLineInput[];
  pin: string;
}

// --- Delivery note (C3) ----------------------------------------------------------

export interface DeliveryNoteLine {
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  requestedQty: string | null;
  dispatchedQty: string;
  confirmedQty: string | null;
  isSubstitute: boolean;
  substituteNote: string | null;
}

export interface DeliveryNote {
  id: string;
  sequenceLabel: string;
  status: DispatchStatus;
  departmentTag: DepartmentTag;
  branchName: string;
  dispatchedByName: string | null;
  dispatchedAt: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  confirmedOnBehalf: boolean;
  lines: DeliveryNoteLine[];
}

// --- Deliveries / confirm (C4/C5, Session B) --------------------------------

export interface ListDeliveriesQuery {
  limit?: number;
}

export interface DeliveryLine {
  dispatchLineId: string;
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  requestedQty: string | null;
  dispatchedQty: string;
  confirmedQty: string | null;
  isSubstitute: boolean;
  substituteNote: string | null;
}

export interface DeliveryRow {
  id: string;
  sequenceLabel: string;
  status: DispatchStatus;
  departmentTag: DepartmentTag;
  branchName: string;
  dispatchedByName: string | null;
  dispatchedAt: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  confirmedOnBehalf: boolean;
  lines: DeliveryLine[];
}

export interface ConfirmLineInput {
  dispatchLineId: string;
  confirmedQty: string;
}

export interface ConfirmDeliveryInput {
  lines: ConfirmLineInput[];
  pin: string;
}

// --- Discrepancy (C6/C7, Session B) -----------------------------------------

export type DiscrepancyStatus = 'OPEN' | 'RESOLVED';
export type DiscrepancyOutcome = 'FOUND_REDELIVERED' | 'TRANSIT_LOSS_WRITEOFF' | 'MISCOUNT_CORRECTED';

export interface ListDiscrepanciesQuery {
  limit?: number;
  status?: DiscrepancyStatus;
  search?: string;
  /** With `page`, the list is paged by `perPage` (25, 50 or 100) and `limit` is ignored. */
  page?: number;
  perPage?: number;
}

export interface DiscrepancyPage {
  rows: DiscrepancyRow[];
  total: number;
}

export interface DiscrepancyRow {
  id: string;
  referenceNumber: string;
  status: DiscrepancyStatus;
  outcome: DiscrepancyOutcome | null;
  gapQty: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  branchName: string;
  departmentTag: DepartmentTag;
  dispatchSequenceLabel: string;
  itemName: string;
  usageUnit: string;
  dispatchedQty: string;
  confirmedQty: string | null;
}

export interface DiscrepancyDetail extends DiscrepancyRow {
  resolutionNote: string | null;
  followUpDispatchId: string | null;
  costAtDispatch: string;
  confirmedByName: string | null;
  confirmedAt: string | null;
}

export interface ResolveDiscrepancyInput {
  outcome: DiscrepancyOutcome;
  resolutionNote: string;
  pin: string;
}
