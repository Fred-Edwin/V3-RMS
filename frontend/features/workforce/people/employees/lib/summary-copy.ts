import type { WorkforceKpiCell } from '../../../_shared';
import type { PeopleSummary } from '../../_shared/types/people-types';

/** The words and numbers drawn from `GET /workforce/people/summary` (R2): the strip, the chip counts and the line under the title. */

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function employeesSubtitle(summary: PeopleSummary | null, siteCount: number): string {
  if (!summary) return 'Nobody is deleted. Leavers are marked Left and kept on file.';
  const sites = siteCount > 0 ? ` across ${plural(siteCount, 'site', 'sites')}` : '';
  return `${plural(summary.onFile, 'person', 'people')}${sites}. Nobody is deleted. Leavers are marked Left and kept on file.`;
}

/**
 * Four cells as Paper draws them. "Needs finishing" and "No contract yet" are the cells you can act on, and only when there is
 * something to act on: a zero is plain. `onFilter` makes an actionable cell choose the matching chip.
 */
export function employeesKpiCells(summary: PeopleSummary, onFilter: (filter: string) => void): WorkforceKpiCell[] {
  return [
    {
      key: 'on-file',
      label: 'ACTIVE STAFF',
      value: String(summary.active),
      detail: `${summary.joinedThisMonth} new this month, ${summary.stillInProbation} on probation`,
    },
    {
      key: 'needs-finishing',
      label: 'INCOMPLETE FILES',
      value: String(summary.needsFinishing),
      detail: 'missing bank, login, photo or other details',
      actionable: summary.needsFinishing > 0,
      onSelect: () => onFilter('needs_finishing'),
    },
    {
      key: 'blocks-payroll',
      label: 'BLOCKS PAYROLL',
      value: String(summary.blocksPayroll),
      detail: 'missing pay, bank, NSSF or SHA',
      actionable: summary.blocksPayroll > 0,
      onSelect: () => onFilter('blocks_payroll'),
    },
    {
      key: 'no-contract',
      label: 'NO CONTRACT YET',
      value: String(summary.noContract),
      detail: 'monthly staff without one',
      actionable: summary.noContract > 0,
      onSelect: () => onFilter('no_contract'),
    },
  ];
}

/** Chip counts in the shape the table wants: `counts[filterKey][value]`, with '' for All. */
export function employeeChipCounts(summary: PeopleSummary): Record<string, Record<string, number>> {
  return {
    filter: {
      '': summary.onFile,
      needs_finishing: summary.needsFinishing,
      blocks_payroll: summary.blocksPayroll,
      no_contract: summary.noContract,
      casual_pool: summary.casualPool,
      on_probation: summary.stillInProbation,
      ...(summary.payChangesWaiting !== null ? { pay_change: summary.payChangesWaiting } : {}),
      ...(summary.payChangesMonth !== null ? { pay_change_month: summary.payChangesMonth } : {}),
      exited: summary.exited,
    },
  };
}
