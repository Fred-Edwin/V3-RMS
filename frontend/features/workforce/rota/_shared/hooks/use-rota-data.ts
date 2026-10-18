'use client';

import { useRemote, type Remote } from '../../../_shared';
import { rotaReads } from '../services/rota-services';
import type { MyShifts, PrintedRota, TemplateView, WeekView } from '../types/rota-types';

/** The Rota reads as `Remote`s. `enabled` waits for the permissions so a screen never flashes "no access". */

export const useWeek = (weekStart: string, siteId: string | undefined, enabled = true): Remote<WeekView> =>
  useRemote(() => rotaReads.week({ weekStart, siteId }), `week:${weekStart}:${siteId ?? ''}`, enabled);

export const useTemplates = (siteId: string | undefined, weekStart: string, includeRetired: boolean, enabled = true): Remote<TemplateView[]> =>
  useRemote(() => rotaReads.templates({ siteId, weekStart, includeRetired }), `templates:${siteId ?? ''}:${weekStart}:${includeRetired}`, enabled);

export const usePrintedRota = (weekStart: string, siteId: string | undefined, departmentId: string | undefined, enabled = true): Remote<PrintedRota> =>
  useRemote(() => rotaReads.print({ weekStart, siteId, departmentId }), `print:${weekStart}:${siteId ?? ''}:${departmentId ?? ''}`, enabled);

/** The signed-in person's own upcoming shifts (default: today and the next 28 days). */
export const useMyShifts = (from?: string, to?: string, enabled = true): Remote<MyShifts> => useRemote(() => rotaReads.mine({ from, to }), `mine:${from ?? ''}:${to ?? ''}`, enabled);
