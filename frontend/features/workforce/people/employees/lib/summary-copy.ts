import type { WorkforceKpiCell } from '../../../_shared';
import type { PeopleSummary } from '../../_shared/types/people-types';

/** The words and numbers drawn from `GET /workforce/people/summary` (R2): the strip, the chip counts and the line under the title. */

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function employeesSubtitle(summary: PeopleSummary | null, siteCount: number): string {
  if (!summary) return 'Nobody is deleted: an employee who leaves is exited, and the record stays.';
  const sites = siteCount > 0 ? ` across ${plural(siteCount, 'site', 'sites')}` : '';
  return `${plural(summary.onFile, 'person', 'people')}${sites}. Nobody is deleted: an employee who leaves is exited, and the record stays.`;
}

/**
 * Four cells as Paper draws them. "Needs finishing" and "No contract yet" are the cells you can act on, and only when there is
 * something to act on: a zero is plain. `onFilter` makes an actionable cell choose the matching chip.
 */
export function employeesKpiCells(summary: PeopleSummary, onFilter: (filter: string) => void): WorkforceKpiCell[] {
  return [
    { key: 'on-file', label: 'PEOPLE ON FILE', value: String(summary.onFile), detail: `${summary.active} active, ${summary.exited} exited` },
    {
      key: 'needs-finishing',
      label: 'NEEDS FINISHING',
      value: String(summary.needsFinishing),
      detail: 'bank, contract or photo missing',
      actionable: summary.needsFinishing > 0,
      onSelect: () => onFilter('needs_finishing'),
    },
    {
      key: 'no-contract',
      label: 'NO CONTRACT YET',
      value: String(summary.noContract),
      detail: 'monthly staff without one',
      actionable: summary.noContract > 0,
      onSelect: () => onFilter('no_contract'),
    },
    { key: 'joined', label: 'JOINED THIS MONTH', value: String(summary.joinedThisMonth), detail: `${summary.stillInProbation} still in probation` },
  ];
}

/** Chip counts in the shape the table wants: `counts[filterKey][value]`, with '' for All. */
export function employeeChipCounts(summary: PeopleSummary): Record<string, Record<string, number>> {
  return {
    filter: {
      '': summary.onFile,
      needs_finishing: summary.needsFinishing,
      no_contract: summary.noContract,
      casual_pool: summary.casualPool,
      exited: summary.exited,
    },
  };
}
