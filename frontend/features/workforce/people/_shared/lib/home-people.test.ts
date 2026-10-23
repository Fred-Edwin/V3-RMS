import { describe, expect, it } from 'vitest';

import type { EmployeeListRow } from '../types/people-types';
import { attentionRows, comingUpRows, onboardingCount, peopleByBranch } from './home-people';

const row = (over: Partial<EmployeeListRow>): EmployeeListRow => ({
  id: 'e', employeeNumber: 'W-1', name: 'Joy Chebet', photoUrl: null, positionName: 'Barista', organizationId: 's1', organizationName: 'Nyeri Town', departmentId: 'd', departmentName: 'Barista',
  employment: 'MONTHLY', contractStatus: 'NONE', status: 'ACTIVE', probationEndsOn: null, gaps: [], reportsToName: null, reportsToNobody: false, isHead: false, ...over,
});
const today = '2026-10-05';

describe('Home people numbers', () => {
  it('counts onboarding people', () => {
    expect(onboardingCount([row({ status: 'ONBOARDING' }), row({}), row({ status: 'ONBOARDING' })])).toBe(2);
  });
  it('counts active people per site, biggest first, leaving out exited and onboarding', () => {
    const rows = [row({ id: '1' }), row({ id: '2' }), row({ id: '3', organizationId: 's2', organizationName: 'Nyeri Highway' }), row({ id: '4', status: 'EXITED' }), row({ id: '5', status: 'ONBOARDING' })];
    expect(peopleByBranch(rows)).toEqual([{ key: 's1', name: 'Nyeri Town', count: 2 }, { key: 's2', name: 'Nyeri Highway', count: 1 }]);
  });
});

describe('needs your attention', () => {
  it('lists probation ends within two weeks, soonest first, amber from three days', () => {
    const rows = attentionRows([row({ id: 'a', name: 'Ann', probationEndsOn: '2026-10-19' }), row({ id: 'b', name: 'Ben', probationEndsOn: '2026-10-07' }), row({ id: 'c', name: 'Cy', probationEndsOn: '2026-11-30' })], today);
    expect(rows.map((r) => r.title)).toEqual(['Probation ends · Ben', 'Probation ends · Ann']);
    expect(rows[0]).toMatchObject({ age: '2 DAYS', late: true, detail: 'Decide by 7 Oct' });
    expect(rows[1]?.late).toBe(false);
  });
  it('lists a file with gaps as Finish hiring and ignores a missing contract', () => {
    const rows = attentionRows([row({ id: 'a', gaps: ['NSSF_SHA', 'BANK'] }), row({ id: 'b', gaps: ['CONTRACT'] }), row({ id: 'c', status: 'EXITED', gaps: ['PAY'] })], today);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'Finish hiring · Joy Chebet', age: 'SET UP', detail: 'bank details, NSSF and SHA missing' });
  });
  it('says TODAY when the decision is due now', () => {
    expect(attentionRows([row({ probationEndsOn: today })], today)[0]?.age).toBe('TODAY');
  });
});

describe('coming up', () => {
  it('lists probation ends in the next 30 days in date order', () => {
    const rows = comingUpRows([row({ id: 'a', name: 'Ann', probationEndsOn: '2026-10-25' }), row({ id: 'b', name: 'Ben', probationEndsOn: '2026-10-10' }), row({ id: 'c', name: 'Cy', probationEndsOn: '2026-12-01' })], today);
    expect(rows.map((r) => r.text)).toEqual(['Ben: probation decision', 'Ann: probation decision']);
    expect(rows[0]?.date).toBe('10 OCT');
  });
});
