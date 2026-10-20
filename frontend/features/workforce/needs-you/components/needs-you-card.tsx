'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { TablePager } from '@/components/ui2/data-table/table-pager';
import { SearchInput } from '@/components/ui2/search-input';

import { ErrorBlock, FilterBar, FilterChip, ListSkeleton, OfflineStrip, EmptyState, STATES_COPY, fillCopy, useNow } from '../../_shared';
import { useSeenOnLeave } from '../hooks/use-seen-on-leave';
import { cardTitle, footerWords, kindCounts, kindLabel, liveText, matchesSearch } from '../lib/needs-you-words';
import type { NeedsYouState } from '../hooks/use-needs-you';
import { NeedsYouPhoneCards } from './needs-you-phone-cards';
import { NeedsYouTable } from './needs-you-table';

/** Above this many rows the table gets search, a Kind filter and the numbered pager (table convention, 6b N1 "Production adds"). */
const LONG_LIST = 25;
const SUBLINE = 'On your Home. Everything that needs your decision, oldest first. Each row opens the page where you decide; the menu badges show the same counts.';

function useOnline(): boolean {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const sync = (): void => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return online;
}

/**
 * "Needs you" (Paper Chapter 15 step 1): everything that waits for this person's decision, oldest first. The card decides nothing; each row
 * opens the page where it is decided. `phone` draws the same rows as cards. A failed source shows its rows missing with a line under the
 * table, never a wrong count; offline shows the last list greyed under the kit strip.
 */
export function NeedsYouCard({ state, phone = false }: { state: NeedsYouState; phone?: boolean }) {
  const now = useNow();
  const online = useOnline();
  const rows = React.useMemo(() => state.list?.rows ?? [], [state.list]);
  const [term, setTerm] = React.useState('');
  const [kind, setKind] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(LONG_LIST);
  useSeenOnLeave(rows.some((r) => r.isNew));

  const long = rows.length > LONG_LIST;
  const matching = React.useMemo(() => rows.filter((r) => (kind === null || r.kind === kind) && matchesSearch(r, term)), [rows, kind, term]);
  const shown = long ? matching.slice((page - 1) * perPage, page * perPage) : rows;

  let body: React.ReactNode;
  if (state.status === 'loading') {
    body = <ListSkeleton rows={4} />;
  } else if (state.status === 'error' && state.list === null) {
    body = <ErrorBlock title={STATES_COPY.waitingForYou.error} line="Your answers are safe." reference={state.error.code === 'NETWORK' ? undefined : state.error.code} onRetry={state.reload} />;
  } else if (rows.length === 0) {
    body = <EmptyState kind="nothingYet" title="Nothing needs you" line="New requests show here, in the bell and as badges on the menu. You will not be asked twice about the same one." />;
  } else if (long && matching.length === 0) {
    body = <EmptyState kind="nothingFound" title="No request matches" line={fillCopy(STATES_COPY.waitingForYou.nothingFound, { term })} />;
  } else {
    const dim = !online || state.status === 'error';
    body = phone ? <NeedsYouPhoneCards rows={shown} now={now} dim={dim} /> : <NeedsYouTable rows={shown} now={now} dim={dim} />;
  }

  return (
    <section aria-label="Needs you" className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <h2 className={cn('m-0 font-wds-sans font-semibold text-wds-text-ink', phone ? 'text-[20px] leading-[26px]' : 'text-[28px] leading-[34px] tracking-[-0.02em]')}>{cardTitle(state.list?.total ?? 0)}</h2>
        {phone ? null : <p className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{SUBLINE}</p>}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {liveText(state.list?.total ?? 0)}
      </p>
      {!online ? <OfflineStrip stillWorks="Your list is the last one we had." /> : null}
      {long ? (
        <FilterBar
          search={<SearchInput aria-label="Search Needs you" placeholder="Search requests" shortcutHint="" value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }} className="w-64" />}
          chips={
            <>
              <FilterChip label="All" count={rows.length} selected={kind === null} onClick={() => { setKind(null); setPage(1); }} />
              {kindCounts(rows).map((k) => (
                <FilterChip key={k.kind} label={kindLabel(k.kind)} count={k.count} selected={kind === k.kind} onClick={() => { setKind(k.kind); setPage(1); }} />
              ))}
            </>
          }
        />
      ) : null}
      {body}
      {state.status === 'error' && state.list !== null ? (
        <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">
          We could not refresh your list. The one shown is the last we had.
        </p>
      ) : null}
      {state.list?.partial ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">Some requests could not be loaded. Try again.</p> : null}
      {rows.length > 0 && state.status !== 'loading' ? (
        long ? (
          <TablePager page={page} perPage={perPage} shown={shown.length} total={matching.length} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
        ) : (
          <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{footerWords(shown.length, state.list?.total ?? shown.length)}</p>
        )
      ) : null}
    </section>
  );
}
