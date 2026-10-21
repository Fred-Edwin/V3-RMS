import { describe, expect, it } from 'vitest';

import type { DepartmentPerson, DepartmentView } from '../../_shared/types/org-types';
import { actingLine, dailyRateLine, departmentKpis, departmentSubtitle, employmentWord, headSince, moreLine } from './department-copy';

const view = (over: Partial<DepartmentView> = {}): DepartmentView => ({
  id: 'd', organizationId: 's', name: 'Service', inventoryTag: 'SERVICE', description: 'Front of house', isActive: true, people: 10, head: null, actingHead: null, hasGap: true,
  organizationName: 'Nyeri Town', isHub: false, positions: [{ id: 'p1', name: 'Waiter', isActive: true }, { id: 'p2', name: 'Host', isActive: true }, { id: 'p3', name: 'Old', isActive: false }],
  peoplePage: { items: [], page: 1, perPage: 8, total: 10 }, casualPool: { total: 3, items: [] }, can: { edit: true, assignHead: true }, ...over,
});
const person = (over: Partial<DepartmentPerson> = {}): DepartmentPerson => ({ employeeId: 'e', userId: 'u', name: 'N', positionName: 'Waiter', status: 'ACTIVE', payType: 'MONTHLY_SALARY', isHead: false, ...over });

describe('departmentKpis', () => {
  it('counts monthly people, the casual pool and the offered positions, and never invents shift or approval figures', () => {
    const cells = departmentKpis(view());
    expect(cells.map((c) => c.value)).toEqual(['10', '3', '–', '2']);
    expect(cells[3]?.detail).toBe('Waiter, Host');
    expect(cells[2]?.detail).toBe('not available yet');
  });
});

describe('words', () => {
  it('writes the subtitle with the site and the description', () => {
    expect(departmentSubtitle(view())).toBe('Nyeri Town. Front of house');
    expect(departmentSubtitle(view({ description: null }))).toBe('Nyeri Town.');
  });
  it('says Monthly, Casual, Onboarding or On notice', () => {
    expect(employmentWord(person())).toBe('Monthly');
    expect(employmentWord(person({ payType: 'DAILY_RATE' }))).toBe('Casual');
    expect(employmentWord(person({ status: 'ONBOARDING' }))).toBe('Onboarding');
    expect(employmentWord(person({ status: 'NOTICE' }))).toBe('On notice');
  });
  it('writes the head since date, the acting line, the "more" line and the daily rate', () => {
    expect(headSince('2026-02-03')).toBe('SINCE 3 FEB 2026');
    expect(actingLine('Faith Njeri', '2026-10-09')).toBe('Faith Njeri is acting head until 9 Oct.');
    expect(moreLine(8, 10)).toBe('2 more. Open the full list to see everyone.');
    expect(moreLine(3, 3)).toBe('');
    expect(dailyRateLine('1200.00')).toBe('KES 1,200 / day');
    expect(dailyRateLine(undefined)).toBeNull();
  });
});
