import { describe, expect, it } from 'vitest';
import { day, item } from '../months/month-fixtures';
import { personMonthRows } from '../months/people-rows';
import { monthTotals } from '../months/people-rows';
import { decidedLines, decidedText, hoursMinutes, roleLabel, spoken } from './decided-by';
import { buildSnapshot, hashSnapshot, stableStringify } from './snapshot';

const faith = { name: 'Faith Njeri', role: 'MANAGER' };
const names = (id: string | null) => (id === 'm1' ? faith : null);

describe('"Decided by" wording', () => {
  it('words each case as the document does', () => {
    expect(decidedText(decidedLines([day('2026-09-01')], [], names))).toBe('Matches the shift, approved by the system');
    const lines = decidedLines([day('2026-09-01')], [item('2026-09-12', { status: 'APPROVED_PART', decidedById: 'm1', needsMinutes: 35, authorisedMinutes: 20 })], names);
    expect(decidedText(lines)).toBe('Matches the shift, approved by the system; Overtime approved in part (20 min of 35 min) by Faith Njeri, Branch Manager');
    expect(decidedText(decidedLines([], [item('2026-09-12', { status: 'APPROVED', decidedById: 'm1', authorisedMinutes: 35 })], names))).toBe('Overtime approved by Faith Njeri, Branch Manager');
    expect(decidedText(decidedLines([], [item('2026-09-12', { status: 'DECLINED', decidedById: 'm1' })], names))).toBe('Overtime not approved by Faith Njeri, Branch Manager');
    expect(decidedText(decidedLines([], [item('2026-09-12', { status: 'AUTO_AUTHORISED', needsMinutes: 0, autoMinutes: 20, authorisedMinutes: 20 })], names))).toBe('Service tail within the allowance');
    expect(decidedText(decidedLines([day('2026-09-09', { status: 'NEEDS_LOOK', reasons: ['ABSENT'], workedMinutes: 0 })], [], names))).toBe('Absent Wed 9 Sep, no leave; unpaid by the Rules');
    expect(decidedText(decidedLines([day('2026-09-11', { status: 'APPROVED', reasons: ['OPEN_SHIFT'], decidedById: 'm1' })], [], names))).toBe('Clock-out fix approved by Faith Njeri, Branch Manager');
    expect(decidedText(decidedLines([], [], names, 3))).toBe('Approved leave, 3 days');
  });
  it('formats hours as the document does', () => {
    expect([hoursMinutes(176 * 60), hoursMinutes(35), hoursMinutes(177 * 60 + 5)]).toEqual(['176:00', '0:35', '177:05']);
    expect([spoken(35), spoken(90), spoken(180), spoken(5)]).toEqual(['35 min', '1 h 30', '3 h', '5 min']);
    expect(roleLabel('STORE_MANAGER')).toBe('Store Manager');
    expect(roleLabel('SOME_NEW_ROLE')).toBe('Some new role');
  });
});

describe('the frozen snapshot', () => {
  const days = [day('2026-09-01'), day('2026-09-12', { status: 'APPROVED', decidedById: 'm1' })];
  const items = [item('2026-09-12', { status: 'APPROVED', decidedById: 'm1', authorisedMinutes: 35 })];
  const rows = personMonthRows(days.map((d) => ({ day: d, person: { id: 'e1', name: 'Cynthia Wairimu', departmentId: 'd', department: { name: 'Barista' } } })), items, []);
  const build = (approvedAt: Date) =>
    buildSnapshot({ monthKey: '2026-09', site: { id: 's1', name: 'Nyeri Town' }, start: '2026-09-01' as never, end: '2026-09-30' as never, approvedAt, approvedBy: faith, ownHoursIncluded: false, totals: monthTotals(rows, items), rules: [], rows, days, items, nameOf: names });

  it('carries one row per person with the lines that explain it, and the totals', () => {
    const snapshot = build(new Date('2026-10-01T08:42:00Z'));
    expect(snapshot.people).toHaveLength(1);
    expect(snapshot.people[0]!.decided.map((l) => l.code)).toEqual(['MATCHES_ROTA', 'OVERTIME_APPROVED']);
    expect(snapshot.totals.workedMinutes).toBe(960);
  });
  it('hashes the same whatever order the keys were built in, and a change changes the hash', () => {
    const a = build(new Date('2026-10-01T08:42:00Z'));
    expect(hashSnapshot(a)).toBe(hashSnapshot(JSON.parse(JSON.stringify(a))));
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    expect(hashSnapshot(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSnapshot(build(new Date('2026-10-01T08:43:00Z')))).not.toBe(hashSnapshot(a));
    const changed = JSON.parse(JSON.stringify(a)) as typeof a;
    changed.people[0]!.workedMinutes += 1;
    expect(hashSnapshot(changed)).not.toBe(hashSnapshot(a));
  });
});
