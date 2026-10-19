'use client';

import { useRemote, type Remote } from '../../../_shared';
import { timesheetReads, type Page } from '../services/timesheet-services';
import type { MyRota, MyTime, OvertimeListItem, PeriodList, PersonPeriod, Report, Request } from '../types/timesheet-types';

/** One hook per read. `enabled` false (permissions still loading, nothing chosen yet) asks nothing. */

export const usePeriods = (siteId: string | undefined, enabled: boolean): Remote<PeriodList> =>
  useRemote(() => timesheetReads.periods(siteId), `periods:${siteId ?? 'mine'}`, enabled);

export const usePersonPeriod = (periodId: string | null, employeeId: string | null, enabled: boolean): Remote<PersonPeriod> =>
  useRemote(() => timesheetReads.person(periodId ?? '', employeeId ?? ''), `person:${periodId}:${employeeId}`, enabled && periodId !== null && employeeId !== null);

export const usePendingOvertime = (siteId: string | undefined, periodId: string | null, enabled: boolean): Remote<Page<OvertimeListItem>> =>
  useRemote(() => timesheetReads.overtime('PENDING', siteId, periodId ?? undefined), `ot:${siteId ?? 'mine'}:${periodId}`, enabled && periodId !== null);

export const useReport = (periodId: string, enabled: boolean): Remote<Report> => useRemote(() => timesheetReads.report(periodId), `report:${periodId}`, enabled);

export const useMyTime = (periodId: string | undefined, enabled: boolean): Remote<MyTime> => useRemote(() => timesheetReads.myTime(periodId), `my-time:${periodId ?? 'now'}`, enabled);

export const useMyRota = (enabled: boolean): Remote<MyRota> => useRemote(() => timesheetReads.myRota(), 'my-rota', enabled);

export const useMyRequests = (enabled: boolean): Remote<{ requests: Request[] }> => useRemote(() => timesheetReads.myRequests(), 'my-requests', enabled);
