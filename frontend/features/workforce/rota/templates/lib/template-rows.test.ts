import { describe, expect, it } from 'vitest';

import { AFTERNOON, MORNING } from '../../_shared/lib/rota-fixture';
import { mayEdit, retiredWords, templateCounts, templateRows } from './template-rows';

const early = { ...MORNING, id: 't-early', name: 'Early bake', organizationId: 's1' };
const old = { ...MORNING, id: 't-old', name: 'Short Saturday', isActive: false, retiredAt: '2026-08-02T09:00:00Z' };
const all = [early, old, AFTERNOON, MORNING];
const query = { page: 1, perPage: 50, search: '', filters: {} };

describe('Shift template rows', () => {
  it('shows active shifts by name and leaves retired ones out until asked', () => {
    expect(templateRows(all, query).rows.map((t) => t.name)).toEqual(['Afternoon', 'Early bake', 'Morning']);
  });
  it('filters by company-wide, this site, and shows only the retired ones when asked', () => {
    expect(templateRows(all, { ...query, filters: { view: 'company' } }).total).toBe(2);
    expect(templateRows(all, { ...query, filters: { view: 'site' } }).rows.map((t) => t.name)).toEqual(['Early bake']);
    expect(templateRows(all, { ...query, filters: { view: 'retired' } }).rows.map((t) => t.name)).toEqual(['Short Saturday']);
  });
  it('searches by name and pages', () => {
    expect(templateRows(all, { ...query, search: 'bake' }).total).toBe(1);
    expect(templateRows(all, { ...query, perPage: 2, page: 2 }).rows.map((t) => t.name)).toEqual(['Morning']);
  });
  it('counts the chips', () => {
    expect(templateCounts(all).view).toEqual({ '': 3, company: 2, site: 1, retired: 1 });
  });
  it('writes the retired date and who may edit what', () => {
    expect(retiredWords('2026-08-02T09:00:00Z')).toBe('Retired 2 Aug');
    expect(mayEdit(MORNING, true, false)).toBe(false);
    expect(mayEdit(MORNING, true, true)).toBe(true);
    expect(mayEdit(early, true, false)).toBe(true);
    expect(mayEdit(early, false, true)).toBe(false);
  });
});
