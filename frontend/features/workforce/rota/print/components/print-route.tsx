'use client';

import { useSearchParams } from 'next/navigation';

import { addDays, mondayOf, nairobiToday } from '../../_shared/lib/rota-dates';
import { PrintScreen } from './print-screen';

const WEEK = /^\d{4}-\d{2}-\d{2}$/;

/** Reads the week, site and department from the address ("?week=2026-10-12&site=…&dept=…") and prints that rota. */
export function PrintRoute() {
  const params = useSearchParams();
  const asked = params.get('week');
  const weekStart = asked && WEEK.test(asked) ? asked : mondayOf(addDays(nairobiToday(), 0));
  return <PrintScreen weekStart={weekStart} siteId={params.get('site') ?? undefined} departmentId={params.get('dept') ?? undefined} />;
}
