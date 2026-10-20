'use client';

import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';

import { daysWord, rangeShort } from '../../_shared/lib/leave-dates';
import { requestsHref } from '../../_shared/lib/leave-routes';
import type { CalendarView } from '../../_shared/types/leave-types';
import { COLUMNS, COLUMN_PX, dayHeads, placeBar } from '../lib/calendar-layout';

const NAME_PX = 170;
const WIDTH = NAME_PX + COLUMNS * COLUMN_PX;
const MONO = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary';

/**
 * The three-week grid (spec Step 16): people down, 21 days across (46 px each), a grey bar for approved leave and a dashed amber bar
 * for a request still waiting. Each bar is a button that opens that request on the Requests tab. The name column stays in view when the
 * grid scrolls sideways. The ON ROTA row appears only when one department is chosen, and only planned days carry counts.
 */
export function CalendarGrid({ view, departmentLabel, today }: { view: CalendarView; departmentLabel: string; today: string }) {
  const router = useRouter();
  const heads = dayHeads(view.from);
  const cover = new Map(view.coverRows.map((c) => [c.date, c] as const));
  const minimum = view.coverRows.find((c) => c.minimum !== null)?.minimum ?? null;
  const weeks = [0, 1, 2].map((w) => heads.slice(w * 7, w * 7 + 7));

  return (
    <div className="overflow-x-auto border border-wds-border bg-wds-surface">
      <table role="grid" aria-label={`Leave calendar, ${departmentLabel}, ${rangeShort(view.from, view.to)}`} className="border-collapse" style={{ width: WIDTH, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: NAME_PX }} />
          {heads.map((h) => <col key={h.date} style={{ width: COLUMN_PX }} />)}
        </colgroup>
        <thead>
          <tr className="h-7 border-b border-wds-border bg-wds-neutral-50">
            <th scope="col" className="sticky left-0 z-10 bg-wds-neutral-50" />
            {weeks.map((w, i) => {
              const planned = w.some((d) => cover.get(d.date)?.planned);
              const first = w[0];
              const last = w[6];
              return (
                <th key={i} scope="colgroup" colSpan={7} className={cn('border-l border-wds-border pl-2 text-left font-normal uppercase', MONO)}>
                  {first && last ? `${rangeShort(first.date, last.date)}${view.coverRows.length > 0 ? ` · ${planned ? 'rota planned' : 'not planned yet'}` : ''}` : ''}
                </th>
              );
            })}
          </tr>
          <tr className="h-9 border-b border-wds-text-ink">
            <th scope="col" className={cn('sticky left-0 z-10 bg-wds-surface pl-3 text-left font-normal', MONO)}>PERSON</th>
            {heads.map((h) => (
              <th key={h.date} scope="col" aria-current={h.date === today ? 'date' : undefined} className={cn('text-center font-normal', h.date === today && 'border-b-2 border-wds-text-ink')}>
                <span className={cn('block', MONO)}>{h.weekday}</span>
                <span className="block font-wds-sans text-[11px] leading-[14px] text-wds-text-ink">{h.day}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.people.map((p) => (
            <tr key={p.id} className="h-10 border-b border-wds-neutral-100">
              <th scope="row" className="sticky left-0 z-10 bg-wds-surface pl-3 text-left font-normal">
                <span className="block truncate font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{p.name}</span>
                <span className="block truncate font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">{p.roleLabel}</span>
              </th>
              <td colSpan={COLUMNS} className="relative p-0">
                {p.bars.map((b) => {
                  const placed = placeBar(b, view.from);
                  if (!placed) return null;
                  const waiting = b.status === 'WAITING';
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => router.push(requestsHref(b.id))}
                      aria-label={`${p.name}, ${p.roleLabel}, ${waiting ? 'asked, waiting' : 'leave'}, ${daysWord(b.days)}, ${rangeShort(b.start, b.end)}`}
                      className={cn(
                        'absolute top-1.5 flex h-7 items-center overflow-hidden whitespace-nowrap px-2 font-wds-mono text-[11px] leading-[14px] focus-visible:outline-none focus-visible:shadow-wds-ring',
                        waiting ? 'border border-dashed border-wds-caramel-600 bg-wds-warning-bg text-wds-warning-fg' : 'bg-wds-neutral-100 text-wds-text-secondary hover:bg-wds-neutral-200',
                        placed.continuesBefore && 'rounded-l-none border-l-0',
                        placed.continuesAfter && 'border-r-0'
                      )}
                      style={{ left: placed.column * COLUMN_PX + 2, width: placed.span * COLUMN_PX - 4 }}
                    >
                      {`${waiting ? 'Asked' : 'Leave'} · ${daysWord(b.days)}`}
                    </button>
                  );
                })}
              </td>
            </tr>
          ))}
        </tbody>
        {view.coverRows.length > 0 ? (
          <tfoot>
            <tr className="h-9 bg-wds-neutral-50">
              <th scope="row" className={cn('sticky left-0 z-10 bg-wds-neutral-50 pl-3 text-left font-normal', MONO)}>{`ON ROTA · NEEDS ${minimum ?? '–'}`}</th>
              {heads.map((h) => {
                const c = cover.get(h.date);
                const tight = Boolean(c && c.planned && c.minimum !== null && c.working < c.minimum);
                return <td key={h.date} className={cn('text-center font-wds-mono text-[12px] leading-4', tight ? 'font-semibold text-wds-warning-fg' : 'text-wds-text-ink')}>{c?.planned ? c.working : ''}</td>;
              })}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
