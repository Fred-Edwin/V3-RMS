'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { attentionRows, comingUpRows, gapRows, nairobiDay, onboardingCount, peopleByBranch, useOrgOverview, usePeopleSummary, useRoster } from '@/features/workforce/people';

import type { CardDataState } from '../lib/card-registry';
import type { AttentionData, ComingUpData, KpiData, PeopleData } from './hr-cards';

/**
 * The data hooks of the cards slice 1a (People) owns: the Onboarding and No contract yet numbers, "Finish hiring" and "Probation ends"
 * on Needs your attention, People by branch, the probation dates on Coming up, and the Director's company headcount. All read the
 * roster the viewer may see; the page only calls a hook for a card the person may see.
 */
const loading: CardDataState<never> = { status: 'loading' };

function useRosterCard<T>(build: (rows: ReturnType<typeof useRoster>['data'] & object, today: string, open: (path: string) => void) => T): CardDataState<T> {
  const roster = useRoster();
  const router = useRouter();
  const data = roster.data;
  const retry = roster.reload;
  const built = useMemo(() => (data ? build(data, nairobiDay(), (path) => router.push(path)) : null), [data, build, router]);
  if (roster.status === 'error' && !data) return { status: 'error', retry };
  if (!built) return loading;
  return { status: 'ready', data: built };
}

const hrKpis = (rows: Parameters<typeof onboardingCount>[0]): KpiData => ({
  cells: [{ key: 'onboarding', label: 'ONBOARDING', value: String(onboardingCount(rows)), detail: 'starting or being set up' }],
});

/** The HR strip: Onboarding from the roster, No contract yet from the summary (it counts every monthly person without one). */
export function useHrKpis(): CardDataState<KpiData> {
  const base = useRosterCard(hrKpis);
  const summary = usePeopleSummary();
  const router = useRouter();
  return useMemo((): CardDataState<KpiData> => {
    if (base.status !== 'ready') return base;
    if (!summary.data) return summary.status === 'error' ? { status: 'error', retry: summary.reload } : loading;
    const n = summary.data.noContract;
    const onboarding = base.data.cells[0];
    return {
      status: 'ready',
      data: { cells: [...(onboarding ? [onboarding] : []), { key: 'no-contract', label: 'NO CONTRACT YET', value: String(n), detail: 'monthly staff', actionable: n > 0, onSelect: () => router.push('/app/workforce/employees?filter=no_contract') }] },
    };
  }, [base, summary.data, summary.status, summary.reload, router]);
}

const attention = (rows: Parameters<typeof attentionRows>[0], today: string, open: (p: string) => void): AttentionData => ({
  items: attentionRows(rows, today).slice(0, 6).map((r) => ({ key: r.key, kind: r.kind, title: r.title, detail: r.detail, age: r.age, late: r.late, action: { label: r.action, onClick: () => open(`/app/workforce/employees/${r.employeeId}`) } })),
  viewAll: { label: 'View all employees', onClick: () => open('/app/workforce/employees') },
});
const useAttentionFromRoster = (): CardDataState<AttentionData> => useRosterCard(attention);

/** Slice 1a's rows (Finish hiring, Probation ends) plus slice 1b's "No head for <department>", gaps first because a gap stops approvals. */
export function useHrAttention(): CardDataState<AttentionData> {
  const base = useAttentionFromRoster();
  const org = useOrgOverview(false);
  const router = useRouter();
  const orgData = org.data;
  return useMemo((): CardDataState<AttentionData> => {
    if (base.status !== 'ready') return base;
    const gaps = orgData
      ? gapRows(orgData).map((g) => ({ key: g.key, kind: 'setup' as const, title: g.title, detail: g.detail, age: g.age, late: true, action: { label: g.action, onClick: () => router.push(`/app/workforce/organisation/${g.departmentId}`) } }))
      : [];
    return { status: 'ready', data: { ...base.data, items: [...gaps, ...base.data.items].slice(0, 6) } };
  }, [base, orgData, router]);
}

const byBranch = (rows: Parameters<typeof peopleByBranch>[0]): PeopleData => ({ rows: peopleByBranch(rows) });
export const usePeopleByBranchData = (): CardDataState<PeopleData> => useRosterCard(byBranch);
export const useCompanyHeadcount = (): CardDataState<PeopleData> => useRosterCard(byBranch);

const comingUp = (rows: Parameters<typeof comingUpRows>[0], today: string): ComingUpData => ({ events: comingUpRows(rows, today).slice(0, 4).map((r) => ({ key: r.key, date: r.date, text: r.text })) });
export const useComingUpData = (): CardDataState<ComingUpData> => useRosterCard(comingUp);
