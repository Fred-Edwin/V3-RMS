'use client';

import { useState } from 'react';

import { useAuthStore } from '@/store/authStore';

import { useOrgOverview } from '../../../people';
import { useWorkforcePermissions } from '../../../_shared';
import { useRotaEditor } from '../../_shared/hooks/use-rota-editor';
import { useWeek } from '../../_shared/hooks/use-rota-data';
import { addDays, mondayOf, nairobiToday } from '../../_shared/lib/rota-dates';
import { ALL_DEPARTMENTS } from '../../_shared/lib/week-view';

/** How far ahead the server lets a rota be planned (26 weeks) and back it can be read (104). */
const WEEKS_AHEAD = 26;
const WEEKS_BACK = 104;

/**
 * What the desktop and phone Rota share: who may read it, which site (HR and the Director pick one; everyone else gets their own),
 * which week, which department, the loaded week and the editor that saves each change at once.
 */
export function useRotaSelection() {
  const perms = useWorkforcePermissions();
  const user = useAuthStore((s) => s.user);
  const canRead = perms.can('rota.read');
  const readsAllSites = perms.scopeOf('rota.read') === 'all';
  const overview = useOrgOverview(false, perms.ready && readsAllSites);
  const sites = overview.data?.organizations ?? [];

  const thisWeek = mondayOf(nairobiToday());
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [siteChoice, setSiteChoice] = useState<string | null>(null);
  const [departmentChoice, setDepartmentChoice] = useState(ALL_DEPARTMENTS);

  const siteId = readsAllSites ? (siteChoice ?? sites.find((s) => s.type === 'BRANCH')?.id ?? sites[0]?.id) : undefined;
  const week = useWeek(weekStart, siteId, perms.ready && canRead && (!readsAllSites || siteId !== undefined));
  const departmentId = week.data?.departments.some((d) => d.id === departmentChoice) ? departmentChoice : ALL_DEPARTMENTS;
  const editor = useRotaEditor(week.data, siteId, week.reload);
  const siteName = readsAllSites ? (sites.find((s) => s.id === siteId)?.name ?? '') : (user?.organizationName ?? '');

  return {
    perms,
    canRead,
    readsAllSites,
    sites,
    sitesFailed: overview.status === 'error',
    siteId,
    siteName,
    weekStart,
    week,
    editor,
    departmentId,
    setDepartment: setDepartmentChoice,
    setSite: (id: string) => {
      setSiteChoice(id);
      setDepartmentChoice(ALL_DEPARTMENTS);
    },
    stepWeek: (by: number) => setWeekStart((w) => addDays(w, by * 7)),
    previousDisabled: weekStart <= addDays(thisWeek, -WEEKS_BACK * 7),
    nextDisabled: weekStart >= addDays(thisWeek, WEEKS_AHEAD * 7),
  };
}
