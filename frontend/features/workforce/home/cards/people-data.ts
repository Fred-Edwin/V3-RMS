'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { attentionRows, comingUpRows, gapRows, nairobiDay, onboardingCount, peopleByBranch, useOrgOverview, usePeopleSummary, useRoster } from '@/features/workforce/people';

import type { CardDataState } from '../lib/card-registry';
import type { AttentionData, ComingUpData, KpiData, PeopleData } from './hr-cards';
import { useLeaveComingUp } from './leave-data';
import { useTimesheetCloseEvents } from './timesheet-data';

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
  const failed = roster.status === 'error' && !data;
  // One object until the answer changes: the Home page compares answers by identity, so a fresh object each render would loop forever.
  return useMemo((): CardDataState<T> => {
    if (failed) return { status: 'error', retry };
    if (!built) return loading;
    return { status: 'ready', data: built };
  }, [failed, retry, built]);
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
  // Leave and "Report a problem" are not here any more: they wait for HR's decision, so they are rows of the Needs you card (SD17).
  // `base` is a new object on every render, so depend on its parts: the answer must keep the same identity until something changes,
  // or the page re-arranges on every render and loops (CLAUDE.md, Frontend Hook Stability Rules).
  const baseData = base.status === 'ready' ? base.data : null;
  const baseState = base.status === 'ready' ? null : base;
  return useMemo((): CardDataState<AttentionData> => {
    if (!baseData) return baseState ?? { status: 'loading' };
    const gaps = orgData
      ? gapRows(orgData).map((g) => ({ key: g.key, kind: 'setup' as const, title: g.title, detail: g.detail, age: g.age, late: true, action: { label: g.action, onClick: () => router.push(`/app/workforce/organisation/${g.departmentId}`) } }))
      : [];
    return { status: 'ready', data: { ...baseData, items: [...gaps, ...baseData.items].slice(0, 6) } };
    // `baseState` is only read when `baseData` is null; its status is what matters, so it is keyed by `base.status` and `base.status === 'error'` retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseData, base.status, orgData, router]);
}

const byBranch = (rows: Parameters<typeof peopleByBranch>[0]): PeopleData => ({ rows: peopleByBranch(rows) });
export const usePeopleByBranchData = (): CardDataState<PeopleData> => useRosterCard(byBranch);
export const useCompanyHeadcount = (): CardDataState<PeopleData> => useRosterCard(byBranch);

const comingUp = (rows: Parameters<typeof comingUpRows>[0], today: string): ComingUpData => ({ events: comingUpRows(rows, today).slice(0, 4).map((r) => ({ key: r.key, date: r.date, text: r.text })) });
/** Probation decisions from People (slice 1a), and the day each branch's timesheets close from Timesheets (slice 4a), deadlines first. */
export function useComingUpData(): CardDataState<ComingUpData> {
  const people = useRosterCard(comingUp);
  const closes = useTimesheetCloseEvents();
  const closeEvents = closes.status === 'ready' ? closes.data : null;
  const probation = people.status === 'ready' ? people.data : null;
  const leave = useLeaveComingUp();
  // The same answer until something changes: the Home page compares answers by identity.
  return useMemo((): CardDataState<ComingUpData> => (probation ? { status: 'ready', data: { events: [...(closeEvents ?? []), ...leave, ...probation.events].slice(0, 4) } } : people), [probation, closeEvents, leave, people]);
}
