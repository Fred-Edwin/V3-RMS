'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, StatusTag, onHover, type StatusTagTone } from '../../_shared';
import { hmOf, type Board, type BoardPerson } from '../../attendance';

const STATE_WORDS: Record<BoardPerson['state'], { tone: StatusTagTone; label: string }> = {
  NOT_STARTED: { tone: 'neutral', label: 'Not started' },
  NOT_IN: { tone: 'error', label: 'Not in' },
  MISSED: { tone: 'error', label: 'Missed' },
  ON_SHIFT: { tone: 'success', label: 'On shift' },
  LATE: { tone: 'warning', label: 'Late' },
  ENDING: { tone: 'warning', label: 'Shift ended' },
  STAYED_ON: { tone: 'info', label: 'Staying on' },
  FINISHED: { tone: 'neutral', label: 'Finished' },
  AUTO_CLOSED: { tone: 'warning', label: 'Closed by phone' },
  NO_SHIFT: { tone: 'neutral', label: 'No shift' },
};

/** Everyone rostered on the day, as a table you can open a row of (the Today page; the Home shows only what needs a look). */
export function EveryoneList({ board, onOpen }: { board: Board; onOpen: (employeeId: string) => void }) {
  const rows = board.people.filter((p) => p.shifts.length > 0);
  return (
    <section aria-label="Everyone on the rota today" className="flex flex-col">
      <h2 className="m-0 flex h-9 items-center justify-between border-b border-wds-text-ink font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">
        <span>EVERYONE TODAY · {rows.length}</span>
      </h2>
      {rows.length === 0 ? <p className="m-0 py-4 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Nobody is rostered on this day.</p> : null}
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((p) => {
          const word = STATE_WORDS[p.state];
          const shift = p.shifts[0];
          return (
            <li key={p.employeeId} className="border-b border-wds-border">
              <button type="button" onClick={() => onOpen(p.employeeId)} className={cn('flex min-h-12 w-full flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-left', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'))}>
                <span className="w-[190px] shrink-0 font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{p.name}</span>
                <span className="w-[130px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{p.departmentName ?? 'No department'}</span>
                <span className="w-[170px] shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{shift ? `${shift.templateName} ${shift.startTime}–${shift.endTime}` : '—'}</span>
                <span className="w-[120px] shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-ink">
                  {shift?.clockedInAt ? `In ${hmOf(shift.clockedInAt)}` : 'Not in'}
                  {shift?.clockedOutAt ? ` · Out ${hmOf(shift.clockedOutAt)}` : ''}
                </span>
                <StatusTag tone={word.tone}>{word.label}</StatusTag>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
