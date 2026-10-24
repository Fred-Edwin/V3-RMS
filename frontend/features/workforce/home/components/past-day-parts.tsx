'use client';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../_shared';
import { fixedWords, type DepartmentCountRow, type ExceptionRow } from '../../attendance';

const arrow = cn('flex h-8 w-8 items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-[14px] leading-4 text-wds-text-ink disabled:pointer-events-none disabled:opacity-40', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'));
const caps = 'font-wds-mono text-[11px] font-normal leading-[14px] tracking-[0.06em] text-wds-text-secondary';
const editLink = cn('shrink-0 font-wds-sans text-[14px] font-medium leading-[18px] text-wds-warning-fg underline underline-offset-2', FOCUS_RING);

/** "Fri 23 Oct". */
export const shortDay = (date: string): string => new Date(`${date}T12:00:00+03:00`).toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');

/** The date picker at the right of the title (Paper 2.3): [‹] [Fri 23 Oct] [›], and "Back to today" on a day that is over. */
export function DayPicker({ date, onPrevious, onNext, nextDisabled, onToday }: { date: string; onPrevious: () => void; onNext: () => void; nextDisabled: boolean; onToday?: () => void }) {
  return (
    <div className="flex items-center gap-4">
      {onToday ? (
        <button type="button" onClick={onToday} className={cn('font-wds-sans text-[14px] font-medium leading-[18px] text-wds-warning-fg underline underline-offset-2', FOCUS_RING)}>
          Back to today
        </button>
      ) : null}
      <div role="group" aria-label="Day" className="flex items-center gap-2">
        <button type="button" aria-label="Previous day" onClick={onPrevious} className={arrow}>
          <span aria-hidden>‹</span>
        </button>
        <span aria-live="polite" className="flex h-8 min-w-[130px] items-center justify-center border border-wds-border bg-wds-surface px-4 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">
          {shortDay(date)}
        </span>
        <button type="button" aria-label="Next day" disabled={nextDisabled} onClick={onNext} className={arrow}>
          <span aria-hidden>›</span>
        </button>
      </div>
    </div>
  );
}

/** The "Past day · read only" tag beside the title. */
export function PastDayTag({ children }: { children: string }) {
  return <span className="inline-block bg-wds-neutral-100 px-2.5 py-1 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{children}</span>;
}

/** "THAT DAY'S EXCEPTIONS · 4": absent and late, each with "Edit time" when the viewer may fix a clock time. No "Clock in for…" on a day that is over. */
export function ExceptionsList({ rows, onEdit }: { rows: readonly ExceptionRow[]; onEdit?: (row: ExceptionRow) => void }) {
  return (
    <section aria-label="That day's exceptions" className="flex min-w-0 flex-col border border-wds-border bg-wds-surface">
      <h2 className={cn('m-0 flex h-10 items-center justify-between border-b border-wds-text-ink px-4', caps)}>
        <span>THAT DAY&apos;S EXCEPTIONS · {rows.length}</span>
        <span className="font-wds-sans text-[13px] tracking-normal">Absent and late first</span>
      </h2>
      {rows.length === 0 ? <p className="m-0 px-4 py-6 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Nobody was absent or late on this day.</p> : null}
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-4 border-b border-wds-border px-4 py-3 last:border-b-0">
            <div className={cn('flex min-w-0 flex-col gap-0.5 border-l-[3px] pl-3', row.tone === 'error' ? 'border-l-wds-error-fg' : 'border-l-wds-caramel-600')}>
              <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{row.name}</span>
              <span className={cn('font-wds-sans text-[13px] leading-4', row.tone === 'error' ? 'text-wds-error-fg' : 'text-wds-warning-fg')}>{row.status}</span>
            </div>
            {onEdit ? (
              <button type="button" onClick={() => onEdit(row)} aria-label={`Edit time: ${row.name}`} className={editLink}>
                Edit time
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The side panel "Fixed after the day": people whose clock time was changed once the day had ended. The server sends a count, so that is what it says. */
export function FixedAfterPanel({ rows }: { rows: readonly { employeeId: string; name: string; changes: number }[] }) {
  return (
    <section aria-label="Fixed after the day" className="flex min-w-0 flex-col border border-wds-border bg-wds-surface">
      <h2 className="m-0 border-b border-wds-border px-5 py-3.5 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">Fixed after the day</h2>
      {rows.length === 0 ? <p className="m-0 px-5 py-4 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No clock time was changed after this day ended.</p> : null}
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => (
          <li key={row.employeeId} className="flex flex-col gap-1 border-b border-wds-border px-5 py-3.5 last:border-b-0">
            <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{row.name}</span>
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{fixedWords(row.changes)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "BY DEPARTMENT": in over expected, the head, and what went wrong. Used on a past day and on the phone. */
export function DepartmentCounts({ rows, className }: { rows: readonly DepartmentCountRow[]; className?: string }) {
  return (
    <section aria-label="By department" className={cn('flex min-w-0 flex-col border border-wds-border bg-wds-surface', className)}>
      <h2 className={cn('m-0 flex h-10 items-center border-b border-wds-text-ink px-4', caps)}>BY DEPARTMENT</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-wds-border px-4 py-2.5 last:border-b-0">
            <span className="w-[130px] shrink-0 font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{row.name}</span>
            <span className={cn('w-[64px] shrink-0 font-wds-mono text-[13px] leading-4', row.problem ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{row.ratio}</span>
            <span className="min-w-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{row.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
