'use client';

import * as React from 'react';

import { DialogButton } from '../../../_shared';
import { clockHours } from '../../_shared/lib/month-words';
import { dayTitle, hmWords } from '../../_shared/lib/timesheet-words';
import type { LastDay, NeedLookItem } from '../../_shared/types/month-types';
import { hmOf } from '../../../attendance';
import { needLookAction, needLookTitle, type NeedAction } from '../lib/person-view';

/** "Planned 14:00 to 22:00 · clocked 13:58 to 22:35." from the last-7-days row of the same date, when it is among them. */
export function evidenceLine(day: LastDay | undefined): string | null {
  if (!day) return null;
  const planned = day.plannedStart && day.plannedEnd ? `Planned ${day.plannedStart} to ${day.plannedEnd}` : 'Not on the rota';
  const clocked = day.clockIn ? `clocked ${hmOf(day.clockIn)} to ${day.clockOut ? hmOf(day.clockOut) : 'not yet'}` : 'no clock';
  return `${planned} · ${clocked}.`;
}

/**
 * One day that needs the manager (spec S4): the day, what is wrong, the evidence when it is among the last 7 days, and ONE button for
 * the kind: decide the overtime, fix the clock-out, answer the request, or look at the day. A button the viewer may not use is absent.
 */
export function NeedLookCard({ item, day, allowed, onAction }: { item: NeedLookItem; day: LastDay | undefined; allowed: Record<NeedAction, boolean>; onAction: (action: NeedAction, item: NeedLookItem) => void }) {
  const action = needLookAction(item, allowed);
  const evidence = evidenceLine(day);
  return (
    <li className="flex flex-col gap-1.5 border border-wds-warning-border bg-wds-caramel-100 px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{needLookTitle(item, dayTitle(item.date))}</span>
        {item.kind === 'OVERTIME' && item.minutes ? <span className="shrink-0 font-wds-sans text-[13px] font-semibold leading-[18px] text-wds-warning-fg">Overtime {hmWords(item.minutes)}</span> : null}
      </div>
      {evidence ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{evidence}</p> : null}
      {item.kind === 'OVERTIME' && item.minutes ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Recorded as overtime because the shift ran past its planned end ({clockHours(item.minutes)}).</p> : null}
      {action ? (
        <div>
          <DialogButton kind="primary" onClick={() => onAction(action.action, item)}>
            {action.label}
          </DialogButton>
        </div>
      ) : null}
    </li>
  );
}
