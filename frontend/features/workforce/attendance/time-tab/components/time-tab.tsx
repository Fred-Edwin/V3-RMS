'use client';

import * as React from 'react';

import { Callout } from '../../../_shared';
import { dateOf } from '../../_shared/lib/nairobi-clock';
import type { TimeFilter } from '../../_shared/types/attendance-types';
import { EditTimeFlow } from '../../fixes/components/fix-flows';
import { useTimeMonth } from '../hooks/use-time-month';
import { NO_DAYS_FOR_CHIP, emptyCopy, lateLine, problemCopy } from '../lib/time-view';
import { DayTable } from './day-table';
import { DayChips, MonthPicker, SpaceKept, SummaryRow, TimeEmpty, TimeProblem, TimeSkeleton } from './time-parts';
import { TimePager } from './time-pager';

const thisMonth = (): string => dateOf(new Date()).slice(0, 7);

/**
 * The Time tab on the employee file (Paper Schedule V1, frames 1.1 to 1.5): the month picker, the late line, the five figures, the
 * chips, the days and the pager. Everything it shows comes from T1; "Edit time" appears only when the server says `canEditTime`.
 * The tab itself is offered only to a viewer with `timesheet.read` (the file decides), so a department head never reaches it.
 */
export function TimeFileTab({ employeeId, name, positionName }: { employeeId: string; name: string; positionName: string | null }) {
  const current = React.useMemo(thisMonth, []);
  const [month, setMonth] = React.useState(current);
  const [filter, setFilter] = React.useState<TimeFilter>('all');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [editDate, setEditDate] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const { remote, shown, refreshing } = useTimeMonth({ employeeId, month, filter, page, pageSize });

  // A new month or chip starts on the first page.
  const chooseMonth = React.useCallback((next: string) => {
    setMonth(next);
    setFilter('all');
    setPage(1);
  }, []);
  const chooseFilter = React.useCallback((next: TimeFilter) => {
    setFilter(next);
    setPage(1);
  }, []);
  const choosePageSize = React.useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const picker = <MonthPicker month={month} thisMonth={current} onChange={chooseMonth} />;
  const empty = shown ? emptyCopy(shown) : null;

  // A person who does not clock has nothing to pick: the card stands alone (frame 1.4, top).
  if (shown && shown.emptyReason === 'DOES_NOT_CLOCK' && empty) return <TimeEmpty copy={empty} />;

  let body: React.ReactNode;
  if (remote.status === 'error' && !shown) {
    const copy = problemCopy(remote.error.status, name, positionName);
    body = <TimeProblem busy={copy.busy} title={copy.title} line={copy.line} reference={copy.busy ? undefined : remote.error.reference} onRetry={remote.reload} />;
  } else if (!shown) {
    body = <TimeSkeleton />;
  } else if (empty) {
    body = <TimeEmpty copy={empty} />;
  } else {
    body = (
      <div className="flex flex-col gap-5" aria-busy={refreshing}>
        <SummaryRow time={shown} />
        <DayChips counts={shown.counts} value={shown.filter} onChange={chooseFilter} />
        {remote.status === 'error' ? <Callout tone="error" size="sm">The days did not refresh. {remote.error.message}</Callout> : null}
        {shown.rows.length === 0 ? (
          <p className="m-0 border border-wds-border bg-wds-surface px-5 py-8 text-center font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{NO_DAYS_FOR_CHIP[shown.filter]}</p>
        ) : (
          <DayTable rows={shown.rows} canEditTime={shown.canEditTime} onEdit={setEditDate}>
            <TimePager page={shown.page} pageSize={shown.pageSize} total={shown.total} onPage={setPage} onPageSize={choosePageSize} />
          </DayTable>
        )}
        <SpaceKept />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {note ? (
        <Callout tone="success" role="status" size="sm">
          {note}
        </Callout>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {picker}
        {shown && !empty ? <p className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{lateLine(shown)}</p> : null}
      </div>
      {body}
      {editDate ? (
        <EditTimeFlow
          employeeId={employeeId}
          date={editDate}
          entryId={null}
          onClose={() => setEditDate(null)}
          onDone={(message) => {
            setEditDate(null);
            setNote(message);
            remote.reload();
          }}
        />
      ) : null}
    </div>
  );
}
