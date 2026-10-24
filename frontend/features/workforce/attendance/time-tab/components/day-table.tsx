import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, StatusTag } from '../../../_shared';
import type { TimeRow } from '../../_shared/types/attendance-types';
import { rowView, type RowView } from '../lib/time-view';

const HEAD = ['DATE', 'SHIFT', 'IN', 'OUT', 'HOURS', 'LATE', 'OVERTIME'] as const;
const head = 'px-5 py-3 text-left font-wds-mono text-[11px] font-normal leading-[14px] tracking-[0.06em] text-wds-text-secondary';
const body = 'px-5 py-3 align-middle font-wds-sans text-[14px] leading-[18px] text-wds-text-ink';

function Row({ view, onEdit }: { view: RowView; onEdit: (date: string) => void }) {
  return (
    <tr className={cn('border-t border-wds-neutral-100', view.today && 'bg-wds-caramel-100')} aria-current={view.today ? 'date' : undefined}>
      <td className={cn(body, 'whitespace-nowrap font-wds-mono text-[13px] tracking-[0.04em]', view.quiet && 'text-wds-text-secondary')}>{view.date}</td>
      <td className={cn(body, 'whitespace-nowrap', view.quiet ? 'text-wds-text-secondary' : 'text-wds-text-secondary')}>{view.shift}</td>
      <td className={cn(body, 'font-wds-mono text-[13px]')}>{view.inAt}</td>
      <td className={cn(body, view.out === 'On shift' ? 'text-wds-text-secondary' : 'font-wds-mono text-[13px]')}>{view.out}</td>
      <td className={cn(body, 'whitespace-nowrap')}>{view.hours}</td>
      <td className={body}>
        {view.tag ? (
          <StatusTag tone={view.tag.tone} size="row">
            {view.tag.text}
          </StatusTag>
        ) : view.quiet ? null : (
          <span className="text-wds-text-secondary">—</span>
        )}
      </td>
      <td className={cn(body, 'whitespace-nowrap', view.overtime === '—' && 'text-wds-text-secondary')}>{view.overtime}</td>
      <td className={cn(body, 'text-right')}>
        {view.canEdit ? (
          <button
            type="button"
            onClick={() => onEdit(view.key)}
            aria-label={`Edit time, ${view.date}`}
            className={cn('whitespace-nowrap font-wds-sans text-[14px] font-medium leading-[18px] text-wds-warning-fg underline underline-offset-2', FOCUS_RING)}
          >
            Edit time
          </button>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * The days of the month (Paper 1.1 and 1.2), newest first. "Edit time" sits on a day only when the server says the viewer may
 * (`canEditTime`); a day off or a leave day has none. Today is tinted. The table scrolls sideways on a narrow screen, since the
 * Time tab has no phone design.
 */
export function DayTable({ rows, canEditTime, onEdit, children }: { rows: TimeRow[]; canEditTime: boolean; onEdit: (date: string) => void; children?: React.ReactNode }) {
  return (
    <div className="border border-wds-border bg-wds-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <caption className="sr-only">Days of the month, newest first</caption>
          <thead>
            <tr className="border-b border-wds-text-ink">
              {HEAD.map((h) => (
                <th key={h} scope="col" className={head}>
                  {h}
                </th>
              ))}
              <th scope="col" className={head}>
                <span className="sr-only">Edit time</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row key={row.date} view={rowView(row, canEditTime)} onEdit={onEdit} />
            ))}
          </tbody>
        </table>
      </div>
      {children}
    </div>
  );
}
