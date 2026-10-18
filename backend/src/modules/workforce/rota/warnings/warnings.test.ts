import { describe, expect, it } from 'vitest';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { computeWarnings, type WarnInput, type WarnPerson } from './warnings';

const d = (s: string): NairobiDate => s as NairobiDate;
const days = ['2026-10-19', '2026-10-20', '2026-10-21'].map(d);
const person = (over: Partial<WarnPerson> & { employeeId: string }): WarnPerson => ({
  name: over.employeeId,
  departmentId: 'bar',
  shifts: {},
  leaveDates: new Set(),
  contractMinutes: null,
  ...over,
});
const input = (people: WarnPerson[], over: Partial<WarnInput> = {}): WarnInput => ({
  people,
  days,
  today: d('2026-10-19'),
  minimumCover: {},
  departments: [{ id: 'bar', name: 'Barista' }],
  ...over,
});
const codes = (w: ReturnType<typeof computeWarnings>) => w.map((x) => x.code);

describe('rota warnings (they inform, they never block)', () => {
  it('warns about a shift on an approved leave day, and only then', () => {
    const p = person({ employeeId: 'a', shifts: { '2026-10-20': [480] }, leaveDates: new Set(['2026-10-20', '2026-10-21']) });
    const found = computeWarnings(input([p]));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: 'LEAVE', employeeId: 'a', date: '2026-10-20' });
  });

  it('warns about a double shift', () => {
    const found = computeWarnings(input([person({ employeeId: 'a', shifts: { '2026-10-19': [480, 240] } })]));
    expect(codes(found)).toEqual(['DOUBLE_SHIFT']);
  });

  it('warns when planned hours pass the contract, not when equal', () => {
    const over = person({ employeeId: 'a', shifts: { '2026-10-19': [480], '2026-10-20': [480] }, contractMinutes: 900 });
    const equal = person({ employeeId: 'b', shifts: { '2026-10-19': [480], '2026-10-20': [420] }, contractMinutes: 900 });
    const found = computeWarnings(input([over, equal]));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: 'WEEKLY_HOURS', employeeId: 'a', detail: { plannedHours: 16, contractHours: 15 } });
  });

  it('flags thin coverage from today on and ignores past days', () => {
    const a = person({ employeeId: 'a', shifts: { '2026-10-20': [480] } });
    const found = computeWarnings(input([a], { minimumCover: { bar: 2 }, today: d('2026-10-20') }));
    expect(found.map((w) => w.date)).toEqual(['2026-10-20', '2026-10-21']);
    expect(found[0]).toMatchObject({ code: 'THIN_COVERAGE', detail: { needs: 2, has: 1 } });
  });

  it('no minimum, no thin warning', () => {
    expect(computeWarnings(input([person({ employeeId: 'a' })]))).toEqual([]);
  });
});
