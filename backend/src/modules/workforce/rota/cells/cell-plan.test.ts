import { describe, expect, it } from 'vitest';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { planCopy, type CopyFacts } from '../copy/copy-plan';
import { planCells } from './cell-plan';

const d = (s: string): NairobiDate => s as NairobiDate;
const entry = (id: string, employeeId: string, date: string, templateId: string) => ({ id, employeeId, date, templateId });

describe('planCells', () => {
  it('adds a shift to an empty day', () => {
    const plan = planCells([{ employeeId: 'a', date: d('2026-10-20'), templateIds: ['m'] }], []);
    expect(plan.add).toEqual([{ employeeId: 'a', date: '2026-10-20', templateId: 'm' }]);
    expect(plan.remove).toEqual([]);
  });

  it('swaps one shift for another', () => {
    const plan = planCells([{ employeeId: 'a', date: d('2026-10-20'), templateIds: ['n'] }], [entry('e1', 'a', '2026-10-20', 'm')]);
    expect(plan.remove.map((e) => e.id)).toEqual(['e1']);
    expect(plan.add.map((a) => a.templateId)).toEqual(['n']);
    expect(plan.changed[0]).toMatchObject({ from: ['m'], to: ['n'] });
  });

  it('clears a day', () => {
    const plan = planCells([{ employeeId: 'a', date: d('2026-10-20'), templateIds: [] }], [entry('e1', 'a', '2026-10-20', 'm')]);
    expect(plan.remove).toHaveLength(1);
    expect(plan.add).toEqual([]);
  });

  it('drops a cell that is already as asked, so nothing is saved or told', () => {
    const plan = planCells([{ employeeId: 'a', date: d('2026-10-20'), templateIds: ['m'] }], [entry('e1', 'a', '2026-10-20', 'm')]);
    expect(plan.changed).toEqual([]);
  });

  it('lets the later change to one cell win', () => {
    const plan = planCells(
      [
        { employeeId: 'a', date: d('2026-10-20'), templateIds: ['m'] },
        { employeeId: 'a', date: d('2026-10-20'), templateIds: ['n'] },
      ],
      [],
    );
    expect(plan.add.map((x) => x.templateId)).toEqual(['n']);
  });
});

describe('planCopy (start from last week)', () => {
  const base: CopyFacts = {
    source: [
      { employeeId: 'a', date: d('2026-10-26'), templateId: 'm' },
      { employeeId: 'b', date: d('2026-10-26'), templateId: 'm' },
      { employeeId: 'a', date: d('2026-10-27'), templateId: 'm' },
      { employeeId: 'a', date: d('2026-10-27'), templateId: 'n' },
    ],
    names: new Map([['a', 'Ann'], ['b', 'Bo']]),
    occupied: new Set(),
    today: d('2026-10-19'),
    clashOf: () => null,
  };

  it('copies everything that fits and counts shifts and people', () => {
    const plan = planCopy(base);
    expect(plan).toMatchObject({ shiftsCopied: 4, people: 2, kept: 0, clashes: [] });
    expect(plan.changes.find((c) => c.date === '2026-10-27')?.templateIds).toEqual(['m', 'n']);
  });

  it('shows a clash and does not copy it', () => {
    const plan = planCopy({ ...base, clashOf: (id, date) => (id === 'b' && date === '2026-10-26' ? { kind: 'ON_LEAVE', detail: 'On approved leave' } : null) });
    expect(plan.clashes).toEqual([{ employeeId: 'b', name: 'Bo', date: '2026-10-26', kind: 'ON_LEAVE', detail: 'On approved leave' }]);
    expect(plan.shiftsCopied).toBe(3);
    expect(plan.changes.some((c) => c.employeeId === 'b')).toBe(false);
  });

  it('keeps cells that already hold a shift and skips past days', () => {
    const plan = planCopy({ ...base, occupied: new Set(['a|2026-10-27']), today: d('2026-10-27') });
    expect(plan.skippedPast).toBe(2); // both people's 26th
    expect(plan.kept).toBe(2); // the two shifts planned for the occupied 27th
    expect(plan.shiftsCopied).toBe(0);
  });
});
