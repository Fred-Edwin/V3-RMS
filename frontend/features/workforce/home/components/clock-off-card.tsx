'use client';

import Link from 'next/link';

import { Button } from '@/components/ui2/button';

import { FOCUS_RING, useWorkforcePermissions } from '../../_shared';
import type { ClockOffCopy } from '../../attendance';

const SWITCH_HREF = '/app/workforce/attendance/switch';
const SHIFTS_HREF = '/app/workforce/schedule/rota';
const LEAVE_HREF = '/app/workforce/leave';
const link = `font-wds-sans text-[14px] font-medium leading-[18px] text-wds-warning-fg underline underline-offset-2 ${FOCUS_RING}`;

function Block({ caption, children }: { caption: string; children: string }) {
  return (
    <div className="flex min-w-0 max-w-[430px] flex-1 flex-col gap-1.5">
      <h3 className="m-0 font-wds-mono text-[11px] font-normal leading-[14px] tracking-[0.06em] text-wds-text-secondary">{caption}</h3>
      <p className="m-0 font-wds-sans text-[14px] leading-[21px] text-wds-text-ink">{children}</p>
    </div>
  );
}

/**
 * What the Today board shows in place of the people when the branch clock is off (Paper 2.1 and 2.2): why the board is empty, what to do
 * about it, and the next step. A person who can switch the clock gets the brown button; everyone else gets the same words and the links
 * only. "Open Shifts" and "Open Leave" appear only for a viewer who may read the rota and leave (the server's table, never a role).
 */
export function ClockOffCard({ copy }: { copy: ClockOffCopy }) {
  const permissions = useWorkforcePermissions();
  const shifts = permissions.can('rota.read');
  const leave = permissions.can('leave.read');
  return (
    <section aria-label={copy.title} className="flex flex-col gap-4 border border-wds-border border-t-2 border-t-wds-caramel-600 bg-wds-surface px-8 py-6">
      <h2 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">{copy.title}</h2>
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Block caption="WHY YOU SEE NO ONE">{copy.why}</Block>
        <Block caption="WHAT TO DO">{copy.todo}</Block>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {copy.canSwitch ? (
          <Button asChild variant="primary">
            <Link href={SWITCH_HREF}>Open Attendance switch</Link>
          </Button>
        ) : null}
        {shifts ? (
          <Link href={SHIFTS_HREF} className={link}>
            Open Shifts
          </Link>
        ) : null}
        {leave ? (
          <Link href={LEAVE_HREF} className={link}>
            Open Leave
          </Link>
        ) : null}
      </div>
    </section>
  );
}
