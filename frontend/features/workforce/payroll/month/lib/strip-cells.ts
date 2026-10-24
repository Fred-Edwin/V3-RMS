import type { WorkforceKpiCell } from '../../../_shared';
import { dayMonth, kes, people, weekdayDayMonth } from '../../_shared/lib/format';
import type { MonthView } from '../../_shared/types/month-types';
import type { StoredEstimate } from '../../_shared/types/tab-types';

/** The four cells of the strip for a month (spec S-shell). The first is always the stage cell: amber while it moves, green when Paid. */
export function stripCells(view: MonthView, estimate: StoredEstimate | null): WorkforceKpiCell[] {
  const paid = view.state === 'PAID';
  const stage: WorkforceKpiCell = {
    key: 'stage',
    label: `${view.label.split(' ')[0]?.toUpperCase() ?? ''} · STAGE`,
    value: view.stageCell.word,
    detail: paid && view.lockedAt ? `Locked on ${weekdayDayMonth(view.lockedAt)}` : view.stageCell.caption,
    actionable: !paid,
    ...(paid ? { tone: 'success' as const } : {}),
  };
  const k = view.kpis;
  if (view.state === 'OPEN') {
    return [
      stage,
      { key: 'expected', label: 'EXPECTED GROSS (KES)', value: estimate ? kes(estimate.expectedGross) : '—', detail: 'for the whole month, from the shifts' },
      { key: 'earned', label: 'EARNED SO FAR (KES)', value: estimate ? kes(estimate.earnedSoFar) : '—', detail: estimate ? `not paid yet, ${percent(estimate.earnedSoFar, estimate.expectedGross)}% of expected` : 'not worked out yet' },
      { key: 'against', label: 'AGAINST LAST MONTH', value: estimate?.vsLastMonth ? signed(estimate.vsLastMonth.amount) : '—', detail: estimate?.vsLastMonth ? `${estimate.vsLastMonth.percent}% on last month's gross` : 'no earlier month yet' },
    ];
  }
  if (view.state === 'WAITING') {
    const sites = k?.sitesApproved ?? { approved: 0, total: 0 };
    return [
      stage,
      { key: 'approved', label: 'TIMESHEETS APPROVED', value: `${sites.approved} of ${sites.total} sites`, detail: people(k?.headcount ?? 0) },
      { key: 'net', label: 'NET PAY (KES)', value: '—', detail: 'worked out when every site approves' },
      { key: 'cost', label: 'TOTAL COST (KES)', value: '—', detail: 'gross + casual' },
    ];
  }
  return [
    stage,
    { key: 'gross', label: 'GROSS PAY (KES)', value: kes(k?.gross), detail: people(k?.headcount ?? 0) },
    { key: 'net', label: 'NET PAY (KES)', value: kes(k?.net), detail: view.publishedAt ? `published ${dayMonth(view.publishedAt)}` : 'to staff' },
    { key: 'cost', label: 'TOTAL COST (KES)', value: kes(k?.totalCost), detail: `gross + casual ${kes(k?.casual)}` },
  ];
}

const signed = (amount: string): string => {
  const text = kes(amount);
  return text === '0' || text.startsWith('-') ? text : `+${text}`;
};

function percent(part: string, whole: string): number {
  const w = Number(whole);
  return w > 0 ? Math.round((Number(part) / w) * 100) : 0;
}

/** The caption of the stage cell for a screen reader: "September, stage: In review. HR checks 5 unusual lines." */
export const stageSpokenCell = (view: MonthView): string => `${view.label.split(' ')[0]}, stage: ${view.stageCell.word}. ${view.stageCell.caption}.`;
