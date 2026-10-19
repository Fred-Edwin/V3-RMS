'use client';

import { useRemote, type Remote } from '../../../_shared';
import { monthReads } from '../services/month-services';
import type { MonthList, MonthView, OvertimeDetail, PersonDays, PersonDrawerData } from '../types/month-types';

/** One hook per months read. `enabled` false (permissions still loading, nothing chosen yet) asks nothing. */

export const useMonthList = (site: string | undefined, page: number, enabled: boolean): Remote<MonthList> =>
  useRemote(() => monthReads.list(site, page), `months:${site ?? 'mine'}:${page}`, enabled);

export const useMonth = (monthKey: string | null, site: string | undefined, from: string | undefined, to: string | undefined, refresh: number, enabled: boolean): Remote<MonthView> =>
  useRemote(() => monthReads.month(monthKey ?? '', site, { from, to }), `month:${site ?? 'mine'}:${monthKey}:${from ?? ''}:${to ?? ''}:${refresh}`, enabled && monthKey !== null);

export const usePersonDrawer = (monthKey: string, employeeId: string | null, site: string | undefined, from: string | undefined, to: string | undefined, refresh: number): Remote<PersonDrawerData> =>
  useRemote(() => monthReads.person(monthKey, employeeId ?? '', site, { from, to }), `drawer:${site ?? 'mine'}:${monthKey}:${employeeId}:${from ?? ''}:${to ?? ''}:${refresh}`, employeeId !== null);

export const usePersonDays = (monthKey: string, employeeId: string, site: string | undefined, from: string | undefined, to: string | undefined, view: 'all' | 'needs' | 'worked', page: number, rows: number, refresh: number): Remote<PersonDays> =>
  useRemote(() => monthReads.personDays(monthKey, employeeId, site, { from, to, view, page, rows }), `days:${site ?? 'mine'}:${monthKey}:${employeeId}:${from ?? ''}:${to ?? ''}:${view}:${page}:${rows}:${refresh}`);

export const useOvertimeDetail = (id: string): Remote<OvertimeDetail> => useRemote(() => monthReads.overtime(id), `overtime:${id}`);
