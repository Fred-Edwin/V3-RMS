import { describe, expect, it } from 'vitest';

import type { PositionView } from '../../_shared/types/org-types';
import { clockingChanged, formOf, positionKpis, positionRowLine, positionSubtitle, roleLabel, toPositionPatch, validatePosition } from './position-copy';

const pos = (over: Partial<PositionView> = {}): PositionView => ({
  id: 'p', name: 'Barista', defaultTracksTime: true, loginRole: 'BARISTA', casualsAllowed: true, isActive: true, holderCount: 12,
  departments: [{ id: 'd1', name: 'Barista', organizationId: 's1' }, { id: 'd2', name: 'Barista', organizationId: 's2' }], ...over,
});

describe('positionKpis', () => {
  it('counts positions, idle ones, and who clocks, and makes "nobody holds it" a button only when there is one', () => {
    const list = [pos(), pos({ id: 'q', name: 'Pastry cook', holderCount: 0 }), pos({ id: 'r', name: 'Branch Manager', defaultTracksTime: false, holderCount: 2 }), pos({ id: 's', name: 'Old', isActive: false })];
    const cells = positionKpis(list, () => undefined);
    expect(cells.map((c) => c.value)).toEqual(['3', '1', '2', '1']);
    expect(cells[1]?.detail).toBe('Pastry cook, safe to retire');
    expect(cells[1]?.actionable).toBe(true);
    expect(positionKpis([pos()], () => undefined)[1]?.actionable).toBe(false);
  });
});

describe('row words', () => {
  it('says how it clocks and its login role', () => {
    expect(positionRowLine(pos())).toBe('Clocks in · login role Barista');
    expect(positionRowLine(pos({ loginRole: null }))).toBe('Clocks in · no login needed');
    expect(positionRowLine(pos({ defaultTracksTime: false }))).toBe('Does not clock in');
    expect(roleLabel('STORE_MANAGER')).toBe('Store Manager');
  });
  it('writes where it is used, once per department name', () => {
    expect(positionSubtitle(pos())).toBe('12 people · used in the Barista department at 2 sites');
    expect(positionSubtitle(pos({ departments: [], holderCount: 0 }))).toBe('0 people · not offered by any department yet');
  });
});

describe('edit form', () => {
  it('needs a name', () => {
    expect(validatePosition({ ...formOf(pos()), name: ' ' }).name).toBe('Give the position a name.');
    expect(validatePosition(formOf(pos())).name).toBeUndefined();
  });
  it('sends only what changed and null when nothing did', () => {
    const p = pos();
    expect(toPositionPatch(p, formOf(p))).toBeNull();
    expect(toPositionPatch(p, { ...formOf(p), casualsAllowed: false })).toEqual({ casualsAllowed: false });
  });
  it('adds the acknowledged count when "clocks in" changes, and a login role of "" clears it', () => {
    const p = pos();
    const f = { ...formOf(p), tracksTime: false, loginRole: '' };
    expect(clockingChanged(p, f)).toBe(true);
    expect(toPositionPatch(p, f, 2)).toEqual({ defaultTracksTime: false, loginRole: null, acknowledgedPeople: 2 });
  });
});
