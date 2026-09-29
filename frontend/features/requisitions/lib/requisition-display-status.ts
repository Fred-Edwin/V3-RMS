import type { RequisitionListRow } from '../types';

export type RequisitionDisplayStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';

type StatusInput = Pick<RequisitionListRow, 'status' | 'mySectionStatus'>;

export const DISPLAY_STATUS_LABEL: Record<RequisitionDisplayStatus, string> = {
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting approval',
  RETURNED: 'Returned',
  APPROVED: 'Approved',
};

/**
 * What a department head should be told about a requisition. Approval is a
 * requisition-level event: the head's own section stays `SUBMITTED` after the
 * Branch Manager signs, so the requisition's status wins once it is APPROVED.
 */
export function getDisplayStatus(row: StatusInput): RequisitionDisplayStatus {
  return row.status === 'APPROVED' ? 'APPROVED' : row.mySectionStatus;
}

/** Sections can only be recalled or cancelled until the requisition is approved. */
export function isLockedByApproval(row: StatusInput): boolean {
  return row.status === 'APPROVED';
}
