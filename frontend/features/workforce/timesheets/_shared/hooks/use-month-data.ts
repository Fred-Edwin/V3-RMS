'use client';

import { useEffect, useRef } from 'react';

import { useRemote, type Remote } from '../../../_shared';
import { monthReads } from '../services/month-services';
import type { MonthList, MonthView, OvertimeDetail, PersonDays, PersonDrawerData } from '../types/month-types';

/** One hook per months read. `enabled` false (permissions still loading, nothing chosen yet) asks nothing. */

export const useMonthList = (site: string | undefined, page: number, enabled: boolean): Remote<MonthList> =>
  useRemote(() => monthReads.list(site, page), `months:${site ?? 'mine'}:${page}`, enabled);

/**
 * Asks again when `token` changes, and keeps the old answer on screen while it does (no skeleton flash after a decision): the
 * numbers update in place. A different key (another month, another person) still starts from loading.
 */
function useReloadOn<T>(remote: Remote<T>, token: number): Remote<T> {
  const seen = useRef(token);
  const reload = remote.reload;
  useEffect(() => {
    if (token === seen.current) return;
    seen.current = token;
    reload();
  }, [token, reload]);
  return remote;
}

export const useMonth = (monthKey: string | null, site: string | undefined, from: string | undefined, to: string | undefined, refresh: number, enabled: boolean): Remote<MonthView> =>
  useReloadOn(useRemote(() => monthReads.month(monthKey ?? '', site, { from, to }), `month:${site ?? 'mine'}:${monthKey}:${from ?? ''}:${to ?? ''}`, enabled && monthKey !== null), refresh);

export const usePersonDrawer = (monthKey: string, employeeId: string | null, site: string | undefined, from: string | undefined, to: string | undefined, refresh: number): Remote<PersonDrawerData> =>
  useReloadOn(useRemote(() => monthReads.person(monthKey, employeeId ?? '', site, { from, to }), `drawer:${site ?? 'mine'}:${monthKey}:${employeeId}:${from ?? ''}:${to ?? ''}`, employeeId !== null), refresh);

export const usePersonDays = (monthKey: string, employeeId: string, site: string | undefined, from: string | undefined, to: string | undefined, view: 'all' | 'needs' | 'worked', page: number, rows: number, refresh: number): Remote<PersonDays> =>
  useReloadOn(useRemote(() => monthReads.personDays(monthKey, employeeId, site, { from, to, view, page, rows }), `days:${site ?? 'mine'}:${monthKey}:${employeeId}:${from ?? ''}:${to ?? ''}:${view}:${page}:${rows}`), refresh);

export const useOvertimeDetail = (id: string): Remote<OvertimeDetail> => useRemote(() => monthReads.overtime(id), `overtime:${id}`);
