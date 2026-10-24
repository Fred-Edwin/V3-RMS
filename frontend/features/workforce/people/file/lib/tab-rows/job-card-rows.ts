import { formatDayMonthYear } from '../../../_shared/lib/people-dates';
import type { EmployeeFile } from '../../../_shared/types/people-types';

/** One row of the Job card (frames 7.1 and 12.1): a label, a line, and under it a grey line when there is one ("Head of Barista · Nyeri Town"). */
export interface JobCardRow {
  label: string;
  main: string;
  /** Drawn in semibold, with `sub` under it: the person this one reports to. */
  strong?: boolean;
  sub?: string;
  muted?: boolean;
  /** Numbers and amounts are drawn in the mono face. */
  mono?: boolean;
  /** A warning tone for a line that needs attention ("Company default · no contract yet"). */
  warning?: boolean;
}

/** The label-and-value rows of the Pay card (`payRows`), as rows of the same grid. */
export function fromKeyValueRows(rows: readonly { label: string; value: unknown; mono?: boolean; tone?: string }[]): JobCardRow[] {
  return rows.map((r) => ({ label: r.label, main: typeof r.value === 'string' ? r.value : '', mono: r.mono === true, muted: r.tone === 'muted', warning: r.tone === 'warning' }));
}

/** "Permanent · signed 3 Feb 2025": the recorded contract, or why there is none. */
export function contractLine(file: Pick<EmployeeFile, 'timeline' | 'contractStatus' | 'employment'>): { text: string; muted: boolean } {
  const recorded = file.timeline.find((e) => e.kind === 'CONTRACT');
  if (recorded) {
    const type = typeof recorded.detail.type === 'string' ? `${recorded.detail.type} · ` : '';
    return { text: `${type}signed ${formatDayMonthYear(recorded.on)}`, muted: false };
  }
  if (file.employment === 'CASUAL') return { text: 'Casual, paid by the day', muted: true };
  return { text: 'None recorded yet', muted: true };
}

/** "Confirmed 3 May 2025", "On probation, ends 31 Oct 2026" or a dash when the person has no probation. */
export function probationLine(file: Pick<EmployeeFile, 'probation'>): { text: string; muted: boolean } {
  const p = file.probation;
  if (!p) return { text: 'Not applicable', muted: true };
  if (p.confirmedOn) return { text: `Confirmed ${formatDayMonthYear(p.confirmedOn)}`, muted: false };
  if (p.decidedOn) return { text: `Decided ${formatDayMonthYear(p.decidedOn)}`, muted: false };
  return { text: `On probation, ends ${formatDayMonthYear(p.endsOn)}`, muted: false };
}

/** The six rows of the Job card, in the order of the frames. */
export function jobCardRows(file: EmployeeFile): JobCardRow[] {
  const boss = file.reportsTo;
  const contract = contractLine(file);
  const probation = probationLine(file);
  return [
    { label: 'Position', main: file.position?.name ?? 'Not set' },
    { label: 'Department', main: file.department?.name ?? 'None' },
    { label: 'Site', main: file.organization.name },
    boss
      ? { label: 'Reports to', main: boss.name, strong: true, ...(boss.positionName ? { sub: [boss.positionName, boss.organizationName].join(' · ') } : {}) }
      : { label: 'Reports to', main: 'No head yet', muted: true },
    { label: 'Contract', main: contract.text, muted: contract.muted },
    { label: 'Probation', main: probation.text, muted: probation.muted },
  ];
}
