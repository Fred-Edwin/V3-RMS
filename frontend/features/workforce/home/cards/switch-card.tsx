'use client';

import * as React from 'react';
import Link from 'next/link';

import { Callout, useRemote } from '../../_shared';
import { attendanceReads } from '../../attendance';
import { defineHomeCard, type CardDataState } from '../lib/card-registry';

/**
 * Where the Director finds the per-site switch for the new clock (not drawn in Paper; listed under "Built beyond Paper"): one quiet note
 * on the Director's Home saying how many branches use it, with the link to the switch screen. It is shown to whoever holds
 * `attendance.switch` and nobody else.
 */

interface SwitchSummary {
  on: number;
  total: number;
}

function useSwitchSummary(): CardDataState<SwitchSummary> {
  const remote = useRemote(() => attendanceReads.switches(), 'home-switches');
  const { status, data, reload } = remote;
  return React.useMemo((): CardDataState<SwitchSummary> => {
    if (status === 'error' && !data) return { status: 'error', retry: reload };
    if (!data) return { status: 'loading' };
    return { status: 'ready', data: { on: data.filter((s) => s.enabled).length, total: data.length } };
  }, [status, data, reload]);
}

export const attendanceSwitchCard = defineHomeCard<SwitchSummary>({
  id: 'workforce.attendance-switch',
  title: 'Attendance clock',
  surfaces: ['desktop'],
  slot: 'wide',
  anyCapability: ['attendance.switch'],
  order: 90,
  isEmpty: (d) => d.total === 0,
  useData: useSwitchSummary,
  Card: ({ data }) => (
    <Callout
      title="Attendance clock"
      actionAt="end"
      action={
        <Link href="/app/workforce/attendance/switch" className="flex h-[34px] items-center whitespace-nowrap border border-wds-border-strong px-4 font-wds-sans text-[13px] leading-4 text-wds-text-ink hover:bg-wds-neutral-50">
          Choose branches
        </Link>
      }
    >
      {data.on === 0 ? 'Every branch still uses the old clock.' : `The new clock is on at ${data.on} of ${data.total} ${data.total === 1 ? 'branch' : 'branches'}.`}
    </Callout>
  ),
});
