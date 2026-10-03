import { describe, expect, it } from 'vitest';

import { getDisplayStatus, isLockedByApproval } from './requisition-display-status';

describe('getDisplayStatus', () => {
  it('shows APPROVED once the requisition is approved, even though the section stays SUBMITTED', () => {
    expect(getDisplayStatus({ status: 'APPROVED', mySectionStatus: 'SUBMITTED' })).toBe('APPROVED');
  });

  it('falls back to the section status before approval', () => {
    expect(getDisplayStatus({ status: 'PENDING_APPROVAL', mySectionStatus: 'SUBMITTED' })).toBe('SUBMITTED');
    expect(getDisplayStatus({ status: 'OPEN', mySectionStatus: 'RETURNED' })).toBe('RETURNED');
    expect(getDisplayStatus({ status: 'OPEN', mySectionStatus: 'DRAFT' })).toBe('DRAFT');
    expect(getDisplayStatus({ status: 'OPEN', mySectionStatus: 'NOT_STARTED' })).toBe('NOT_STARTED');
  });
});

describe('isLockedByApproval', () => {
  it('locks only approved requisitions', () => {
    expect(isLockedByApproval({ status: 'APPROVED', mySectionStatus: 'SUBMITTED' })).toBe(true);
    expect(isLockedByApproval({ status: 'PENDING_APPROVAL', mySectionStatus: 'SUBMITTED' })).toBe(false);
  });
});
