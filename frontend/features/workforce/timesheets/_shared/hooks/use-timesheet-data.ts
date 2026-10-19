'use client';

import { useRemote, type Remote } from '../../../_shared';
import { timesheetReads } from '../services/timesheet-services';
import type { MyRota, MyTime, Request } from '../types/timesheet-types';

/** One hook per read for the phone screens. `enabled` false (permissions still loading) asks nothing. The months reads are in `use-month-data.ts`. */

export const useMyTime = (periodId: string | undefined, enabled: boolean): Remote<MyTime> => useRemote(() => timesheetReads.myTime(periodId), `my-time:${periodId ?? 'now'}`, enabled);

export const useMyRota = (enabled: boolean): Remote<MyRota> => useRemote(() => timesheetReads.myRota(), 'my-rota', enabled);

export const useMyRequests = (enabled: boolean): Remote<{ requests: Request[] }> => useRemote(() => timesheetReads.myRequests(), 'my-requests', enabled);
