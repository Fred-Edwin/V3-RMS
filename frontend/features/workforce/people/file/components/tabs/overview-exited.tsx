import * as React from 'react';

import { Button } from '@/components/ui2/button';

import { KeyValueRows, Panel } from '../../../../_shared';
import { PANEL_ROWS } from '../../../_shared/components/titled-panel';
import { formatDayMonth } from '../../../_shared/lib/people-dates';
import type { EmployeeFile } from '../../../_shared/types/people-types';
import { firstName } from '../../lib/file-model';
import { exitBanner, exitRows } from '../../lib/file-rows';

/** The sand banner on an exited file, with the dark "Undo exit · N days left" button while the window is open. */
export function ExitBanner({ file, today, onUndo }: { file: EmployeeFile; today: string; onUndo: () => void }) {
  const banner = exitBanner(file, today);
  if (!banner) return null;
  return (
    <section aria-label="Exit" className="flex items-center justify-between gap-6 border border-wds-warning-border border-l-4 border-l-wds-caramel-600 bg-wds-warning-bg px-5 py-4 max-md:flex-col max-md:items-start">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="m-0 font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{banner.title}</h2>
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{banner.line}</p>
      </div>
      {banner.canUndo && file.actions.undoExit ? (
        <button
          type="button"
          onClick={onUndo}
          className="h-9 shrink-0 cursor-pointer border-0 bg-wds-neutral-950 px-[18px] font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-primary-fg transition-colors hover:bg-wds-neutral-800 focus-visible:outline-none focus-visible:shadow-wds-ring"
        >
          Undo exit · {banner.daysLeft} {banner.daysLeft === 1 ? 'day' : 'days'} left
        </button>
      ) : null}
    </section>
  );
}

/** "The exit" and "If they come back later" (Paper `12L6-0`). Rehire is a button once the undo window has closed. */
export function ExitedOverview({ file, open }: { file: EmployeeFile; open: (dialog: 'rehire') => void }) {
  const first = firstName(file.name);
  const exit = file.exit;
  return (
    <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1">
      <Panel title="The exit" padded={false}>
        <KeyValueRows rows={exitRows(file)} aria-label="The exit" topRule={false} className={PANEL_ROWS} />
      </Panel>
      <div className="flex flex-col gap-3">
        <Panel title={`If ${first} comes back later`}>
          <p className="m-0 mb-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">
            Rehire reopens this same file with a new start date, a new probation and a new contract. The old pay, leave and history stay, and the gap between {exit ? formatDayMonth(exit.lastDay) : 'the last day'} and the new start date shows on the timeline. There is never a second file.
          </p>
          {file.actions.rehire ? (
            <Button type="button" variant="flat" onClick={() => open('rehire')}>
              Rehire
            </Button>
          ) : (
            <Button type="button" variant="flat" disabled>
              {exit?.canUndo ? `Rehire (after ${formatDayMonth(exit.undoUntil)})` : 'Rehire'}
            </Button>
          )}
        </Panel>
        <section aria-label="What they can still do" className="flex flex-col gap-1.5 border border-wds-border bg-wds-neutral-50 px-4 py-3.5">
          <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">WHAT {first.toUpperCase()} CAN STILL DO</h3>
          <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">Open payslips and download the certificate of service from the link HR sends. They cannot clock in or sign in to the app.</p>
        </section>
      </div>
    </div>
  );
}
