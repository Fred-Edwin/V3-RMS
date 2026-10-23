'use client';

import * as React from 'react';

import { TablePager } from '@/components/ui2/data-table/table-pager';
import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';

import { EmptyState, ErrorBlock, FilterChip, ListSkeleton, PhoneScreen, useNow } from '../../../_shared';
import { ResetPasswordScreen } from '../../../security';
import { nairobiDayOf } from '../../log/lib/audit-query';
import { useMyRecord } from '../hooks/use-my-record';
import { CHIPS, RECORD_COPY, entriesWord, showing } from '../lib/my-record-words';
import type { RecordItem } from '../types/my-record-types';
import { MyRecordDesktop } from './my-record-desktop';
import { RecordEntry } from './record-entry';
import { RecordList } from './record-list';

/**
 * Activity on my record (6a A8, Paper 14.2): what was done to the person's own file, in groups (All, Pay, Time, Leave, File, Conduct,
 * Sign-ins), this month to begin with. Everyone with a login has it. Reading it writes nothing. One column on every width. Amounts,
 * codes and PINs never appear: the server words each entry, this screen only draws it.
 */
export function MyRecordScreen() {
  const now = useNow();
  const desktop = useMediaQuery('(min-width: 1024px)').matches;
  const email = useAuthStore((s) => s.user?.email ?? '');
  const record = useMyRecord();
  const [open, setOpen] = React.useState<RecordItem | null>(null);
  const [signedOut, setSignedOut] = React.useState(false);
  const opener = React.useRef<HTMLElement | null>(null);
  const today = React.useMemo(() => nairobiDayOf(), []);
  const data = record.list.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  // "This wasn't me": the server already ended every session; this phone now needs a new password (the Security flow's own page).
  if (signedOut) return <ResetPasswordScreen email={email} needsCurrent onDone={() => window.location.assign('/app/workforce')} />;
  if (desktop) return <MyRecordDesktop record={record} onSignedOut={() => setSignedOut(true)} />;

  let body: React.ReactNode;
  if (record.list.status === 'loading') body = <ListSkeleton rows={5} columns={['fill', 70]} label="Loading your record" />;
  else if (record.list.status === 'error' && !data) {
    body = <ErrorBlock title={RECORD_COPY.error} line={RECORD_COPY.errorLine} reference={record.list.error.code === 'NETWORK' ? undefined : record.list.error.code} onRetry={record.list.reload} />;
  } else if (items.length === 0) {
    body = record.event !== 'all' ? <EmptyState kind="nothingFound" title={RECORD_COPY.nothingFound} /> : <EmptyState kind="nothingYet" title={record.isMonth ? RECORD_COPY.empty : RECORD_COPY.emptyRange} />;
  } else {
    body = (
      <>
        <RecordList
          items={items}
          now={now}
          onOpen={(item, el) => {
            opener.current = el;
            setOpen(item);
          }}
        />
        <TablePager page={record.page} perPage={record.pageSize} shown={items.length} total={total} onPageChange={record.setPage} onPerPageChange={record.changePageSize} />
        <p role="status" className="sr-only">{showing(items.length, total)}</p>
      </>
    );
  }

  return (
    <PhoneScreen
      screen={RECORD_COPY.screen}
      kicker={RECORD_COPY.kicker}
      back="/app/workforce"
      figure={data ? entriesWord(total) : '…'}
      subtitle={record.isMonth ? RECORD_COPY.subtitle : RECORD_COPY.subtitleRange}
      heading={undefined}
    >
      {open ? (
        <RecordEntry
          item={open}
          onBack={() => {
            setOpen(null);
            // Back returns to the same place in the list: the card that was pressed gets focus again.
            window.setTimeout(() => opener.current?.focus(), 0);
          }}
          onAnswered={record.list.reload}
          onSignedOut={() => setSignedOut(true)}
        />
      ) : (
        <>
          <div role="group" aria-label="Group" className="flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <FilterChip key={c.value} label={c.label} count={c.value === 'all' && record.event === 'all' && data ? total : undefined} selected={record.event === c.value} onClick={() => record.chooseEvent(c.value)} />
            ))}
          </div>
          <DateRangePicker
            label="Dates"
            today={today}
            value={record.range}
            onChange={(r) => r && record.chooseRange(r)}
            buttonClassName="h-9 w-full justify-between px-3 text-[13px] max-sm:h-11"
            className="w-full"
          />
          {body}
        </>
      )}
    </PhoneScreen>
  );
}
