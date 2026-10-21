import { describe, expect, it, vi } from 'vitest';

import type { PeopleSummary } from '../../_shared/types/people-types';
import { employeeChipCounts, employeesKpiCells, employeesSubtitle } from './summary-copy';

const summary: PeopleSummary = { onFile: 89, active: 77, exited: 12, needsFinishing: 3, blocksPayroll: 2, noContract: 4, joinedThisMonth: 5, stillInProbation: 2, casualPool: 6 };

describe('Employees summary words', () => {
  it('writes the line under the title as Paper does', () => {
    expect(employeesSubtitle(summary, 3)).toBe('89 people across 3 sites. Nobody is deleted. Leavers are marked Left and kept on file.');
    expect(employeesSubtitle({ ...summary, onFile: 1 }, 1)).toContain('1 person across 1 site.');
  });
  it('still reads while the numbers load', () => {
    expect(employeesSubtitle(null, 0)).toContain('Nobody is deleted');
  });
  it('makes the two cells you can act on buttons, and only when there is something to act on', () => {
    const pick = vi.fn();
    const cells = employeesKpiCells(summary, pick);
    expect(cells.map((c) => c.value)).toEqual(['77', '3', '2', '4']);
    expect(cells[1]?.actionable).toBe(true);
    cells[2]?.onSelect?.();
    expect(pick).toHaveBeenCalledWith('blocks_payroll');
    cells[3]?.onSelect?.();
    expect(pick).toHaveBeenCalledWith('no_contract');
    const quiet = employeesKpiCells({ ...summary, needsFinishing: 0, blocksPayroll: 0, noContract: 0 }, pick);
    expect(quiet.slice(1).every((c) => c.actionable === false)).toBe(true);
  });
  it('feeds the chips: All is everyone on file', () => {
    expect(employeeChipCounts(summary).filter).toEqual({ '': 89, needs_finishing: 3, blocks_payroll: 2, no_contract: 4, casual_pool: 6, exited: 12 });
  });
});
