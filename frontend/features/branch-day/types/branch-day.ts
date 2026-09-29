/**
 * Branch day close — Milestone Six, Session 3. Hand-mirrored from the frozen
 * backend contract (`backend/src/modules/branch-day/branch-day-validators.ts`,
 * `API_CONTRACT.md` §26.3). Decimals cross the wire as strings.
 */

export type DepartmentTag = 'KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING';
export type BranchDayStatus = 'OPEN' | 'CLOSED';
/** COUNTING / BLOCKED / CLOSED are derived server-side at read time. */
export type DepartmentDayStatus = 'NOT_STARTED' | 'COUNTING' | 'COUNTED' | 'BLOCKED' | 'CLOSED';
export type GapReasonValue = 'CONSUMPTION' | 'UNLOGGED_WASTE' | 'WALK_IN_COMP' | 'SUSPECTED_LOSS' | 'OTHER';

export interface UserRef {
  id: string;
  name: string;
}

export interface BlockingDispatch {
  id: string;
  sequenceLabel: string;
}

export interface DepartmentDaySummary {
  tag: DepartmentTag;
  name: string;
  status: DepartmentDayStatus;
  blockingDispatches: BlockingDispatch[];
  countedBy: UserRef | null;
  countedAt: string | null;
  itemCount: number;
  countedLines: number;
  gapsAboveThreshold: number;
  netAdjustmentValue: string;
}

export interface CloseBlocker {
  code: 'NOT_COUNTED' | 'BLOCKED' | 'REASON_REQUIRED';
  departmentTag: DepartmentTag;
  message: string;
}

export interface BranchDayToday {
  id: string;
  reference: string;
  date: string;
  status: BranchDayStatus;
  branchName: string;
  closedAt: string | null;
  closedBy: UserRef | null;
  reopenCount: number;
  departments: DepartmentDaySummary[];
  yesterday: { id: string; date: string; status: BranchDayStatus; closedAt: string | null; closedBy: UserRef | null } | null;
  reasonRequiredKes: number;
  canClose: boolean;
  closeBlockers: CloseBlocker[];
}

export interface DepartmentLine {
  inventoryItemId: string;
  name: string;
  usageUnit: string;
  expectedQty: string;
  countedQty: string | null;
  gap: string | null;
  gapValue: string | null;
  unitCost: string;
  reasonRequired: boolean;
  reason: GapReasonValue | null;
  reasonNote: string | null;
}

export interface DepartmentDayDetail {
  branchDayId: string;
  date: string;
  dayStatus: BranchDayStatus;
  closedAt: string | null;
  reasonRequiredKes: number;
  summary: DepartmentDaySummary;
  lines: DepartmentLine[];
}

export interface SaveDepartmentLinesInput {
  lines: { inventoryItemId: string; countedQty: string | null; reason?: GapReasonValue | null; reasonNote?: string | null }[];
}

export interface SaveLinesResult {
  savedAt: string;
  detail: DepartmentDayDetail;
}

export interface CloseResult {
  id: string;
  reference: string;
  status: BranchDayStatus;
  closedAt: string;
  adjustmentCount: number;
  reversalCount: number;
  netAdjustmentValue: string;
  directorNotified: boolean;
}

export interface ReopenResult {
  id: string;
  status: BranchDayStatus;
  reopenCount: number;
}

export interface DayDocument {
  id: string;
  reference: string;
  date: string;
  branchName: string;
  branchAddress: string;
  branchPhone: string | null;
  openedAt: string;
  closedAt: string;
  closedBy: UserRef;
  reopenCount: number;
  departments: { tag: DepartmentTag; name: string; items: number; gaps: number; status: 'Closed' }[];
  totals: { items: number; gapLines: number; netAdjustmentValue: string };
}

/** The branch's own thresholds (`GET/PUT /inventory/thresholds` as a Branch Manager). */
export interface BranchThresholds {
  reasonRequiredKes: number;
  overnightAlertKes: number | null;
  directorAlertKes: number;
  isDefault: boolean;
  updatedBy: UserRef | null;
  updatedAt: string | null;
  directorUpdatedBy: UserRef | null;
  directorUpdatedAt: string | null;
}
