import { describe, expect, it } from 'vitest';
import { summaryOf } from './department-view';
import type { HeadRowRecord } from '../heads/heads-repository';
import type { DepartmentRecord } from './departments-repository';

const dept = (isHub = false): DepartmentRecord =>
  ({ id: 'd1', siteId: 's1', name: 'Kitchen', key: null, description: null, status: 'ACTIVE', site: { id: 's1', name: 'Town', type: 'BRANCH', isHub }, positions: [] }) as unknown as DepartmentRecord;
const row = (isActing: boolean): HeadRowRecord =>
  ({ id: 'h1', departmentId: 'd1', employeeId: 'e1', isActing, startsOn: new Date('2026-01-01'), endsOn: null, department: { siteId: 's1', key: null, name: 'Kitchen' }, employee: { id: 'e1', name: 'Kelvin', userId: null } }) as unknown as HeadRowRecord;

describe('"No head" for a department (the one rule shared with Home)', () => {
  it('is a gap only for a branch department with people and neither a head nor an acting head', () => {
    expect(summaryOf(dept(), 3, []).hasGap).toBe(true);
    expect(summaryOf(dept(), 0, []).hasGap).toBe(false);
    expect(summaryOf(dept(), 3, [row(false)]).hasGap).toBe(false);
    expect(summaryOf(dept(), 3, [row(true)]).hasGap).toBe(false);
    expect(summaryOf(dept(true), 3, []).hasGap).toBe(false);
  });
});
