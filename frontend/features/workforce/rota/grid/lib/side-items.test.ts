import { describe, expect, it } from 'vitest';

import { person, shift, weekOf } from '../../_shared/lib/rota-fixture';
import { departmentItems, siteItems } from './side-items';

describe('Side list items', () => {
  const week = weekOf([person('e1', 'Amina Hassan', { '2026-10-13': [shift('t-morning')] })], {
    departments: [{ id: 'd-barista', name: 'Barista', people: 1, shifts: 1, headName: 'Victor Maina' }],
    totals: { people: 1, shifts: 1, plannedMinutes: 480 },
  });

  it('starts with All departments and then each department with its head', () => {
    const items = departmentItems(week);
    expect(items[0]).toMatchObject({ id: 'all', title: 'All departments', sub: '1 person · 1 shift', status: 'Complete' });
    expect(items[1]).toMatchObject({ id: 'd-barista', sub: '1 person · Head Victor Maina' });
  });
  it('says "No head" where there is none', () => {
    const items = departmentItems({ ...week, departments: [{ id: 'd-x', name: 'Housekeeping', people: 2, shifts: 0, headName: null }] });
    expect(items[1]).toMatchObject({ sub: '2 people · No head', status: 'Not started' });
  });
  it('counts a site from its departments and gives only the chosen site a status', () => {
    const items = siteItems([{ id: 's1', name: 'Nyeri Town', departments: [{ people: 3 }, { people: 4 }] }, { id: 's2', name: 'Nyeri Highway', departments: [] }], 's1', week);
    expect(items[0]).toMatchObject({ title: 'Nyeri Town', sub: '7 people', status: 'Complete' });
    expect(items[1]).toMatchObject({ sub: '0 people', status: undefined });
  });
});
