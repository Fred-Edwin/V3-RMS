import { describe, expect, it } from 'vitest';

import { employmentLine, fileCellOf, siteDepartmentLine } from './employee-row-copy';

describe('the File column', () => {
  it('says Complete when nothing is missing and there is no probation', () => {
    expect(fileCellOf({ status: 'ACTIVE', gaps: [], probationEndsOn: null })).toEqual({ tone: 'success', label: 'Complete' });
  });
  it('names the one gap that blocks payroll', () => {
    expect(fileCellOf({ status: 'ACTIVE', gaps: ['BANK'], probationEndsOn: null }).label).toBe('Bank details missing');
  });
  it('says Needs finishing when several gaps block', () => {
    expect(fileCellOf({ status: 'ONBOARDING', gaps: ['BANK', 'NSSF_SHA'], probationEndsOn: null }).label).toBe('Needs finishing');
  });
  it('shows the probation end when only a contract or emergency contact is missing', () => {
    expect(fileCellOf({ status: 'ACTIVE', gaps: ['CONTRACT', 'EMERGENCY_CONTACT'], probationEndsOn: '2026-10-14' })).toEqual({ tone: 'warning', label: 'Probation ends 14 Oct' });
  });
  it('lets an exit win over everything', () => {
    expect(fileCellOf({ status: 'EXITED', gaps: ['BANK'], probationEndsOn: '2026-10-14' })).toEqual({ tone: 'neutral', label: 'Exited' });
  });
});

describe('the Employment and Site columns', () => {
  it('writes the contract state for monthly staff', () => {
    expect(employmentLine({ employment: 'MONTHLY', contractStatus: 'NONE' })).toBe('Monthly · no contract yet');
    expect(employmentLine({ employment: 'MONTHLY', contractStatus: 'ACTIVE' })).toBe('Monthly');
  });
  it('says a casual has no login', () => {
    expect(employmentLine({ employment: 'CASUAL', contractStatus: 'NONE' })).toBe('Casual · daily, no login');
  });
  it('leaves the department out when there is none', () => {
    expect(siteDepartmentLine({ organizationName: 'Nyeri Town', departmentName: null })).toBe('Nyeri Town');
    expect(siteDepartmentLine({ organizationName: 'Nyeri Town', departmentName: 'Barista' })).toBe('Nyeri Town · Barista');
  });
});
