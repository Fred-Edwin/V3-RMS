'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Topbar, type TopbarBreadcrumb } from '@/components/app/shell/topbar';
import { nairobiToday } from '@/components/ui2/data-table/table-dates';
import { dayStatusChip } from '../../_shared/lib/branch-day-copy';
import type { HistoryRow } from '../../_shared/types/branch-day-contract';
import { useDayAccess, useDayBase } from '../hooks/use-day-access';
import { longDay } from '../lib/desk-format';
import { dayPaths } from '../lib/desk-paths';
import { branchDayDeskApi } from '../services/branch-day-desk-api';

const MAX_RESULTS = 6;
const LISTBOX = 'day-search-results';

/**
 * The top bar of every Branch day desktop screen: breadcrumb and "Search a day" (⌘K), 420 wide at most (Paper C13). Typing lists the days
 * that match the day number under the box ("DAY-NYR-0044 · Wednesday 7 October · Closed", gap G9), or "No day matches."; an arrow key and
 * Enter open one. Enter with nothing highlighted opens History filtered to what was typed.
 */
export function DayTopbar({ breadcrumb, actions }: { breadcrumb: TopbarBreadcrumb; actions?: React.ReactNode }) {
  const router = useRouter();
  const base = useDayBase();
  const paths = dayPaths(base);
  const access = useDayAccess();
  const everyBranch = access.view === 'all';
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [results, setResults] = React.useState<HistoryRow[] | null>(null);
  const [active, setActive] = React.useState(-1);
  const [rect, setRect] = React.useState<{ left: number; top: number; width: number } | null>(null);
  const query = text.trim();

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Look the days up 200 ms after the last letter; only the newest answer is kept.
  React.useEffect(() => {
    setActive(-1);
    if (query === '' || !access.ready || access.view === 'none') {
      setResults(null);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      void branchDayDeskApi
        .history({ q: query, from: '2020-01-01', to: nairobiToday(), page: 1, pageSize: 25 })
        .then((res) => {
          if (live) setResults(res.rows.slice(0, MAX_RESULTS));
        })
        .catch(() => {
          if (live) setResults([]);
        });
    }, 200);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, access.ready, access.view]);

  const place = React.useCallback((): void => {
    const box = inputRef.current?.getBoundingClientRect();
    if (box) setRect({ left: box.left, top: box.bottom + 4, width: box.width });
  }, []);

  const open = (row: HistoryRow): void => {
    setText('');
    setResults(null);
    inputRef.current?.blur();
    router.push(row.status === 'OPEN' ? paths.today(everyBranch ? row.branch.id : undefined) : paths.file(row.id));
  };

  const showList = focused && query !== '' && results !== null && rect !== null;

  return (
    <>
      <Topbar
        breadcrumb={breadcrumb}
        actions={actions}
        searchRef={inputRef}
        searchProps={{
          placeholder: 'Search a day',
          'aria-label': 'Search a day',
          role: 'combobox',
          'aria-expanded': showList,
          'aria-controls': LISTBOX,
          'aria-autocomplete': 'list',
          'aria-activedescendant': active >= 0 ? `${LISTBOX}-${active}` : undefined,
          value: text,
          className: 'w-full max-w-[420px] grow',
          onFocus: () => {
            place();
            setFocused(true);
          },
          onBlur: () => setFocused(false),
          onChange: (e) => {
            place();
            setText(e.target.value);
          },
          onKeyDown: (e) => {
            const count = results?.length ?? 0;
            if (e.key === 'ArrowDown' && count > 0) {
              e.preventDefault();
              setActive((i) => (i + 1) % count);
            } else if (e.key === 'ArrowUp' && count > 0) {
              e.preventDefault();
              setActive((i) => (i <= 0 ? count - 1 : i - 1));
            } else if (e.key === 'Enter' && query !== '') {
              e.preventDefault();
              const row = active >= 0 ? results?.[active] : undefined;
              if (row) open(row);
              else {
                router.push(`${base}/history?search=${encodeURIComponent(query)}`);
                setText('');
                setResults(null);
              }
            } else if (e.key === 'Escape') {
              setText('');
              setResults(null);
              e.currentTarget.blur();
            }
          },
        }}
      />
      {showList && rect ? (
        <ul
          id={LISTBOX}
          role="listbox"
          aria-label="Days that match"
          style={{ left: rect.left, top: rect.top, width: rect.width }}
          className="fixed z-50 m-0 list-none border border-wds-border-strong bg-wds-surface p-0 shadow-[0_12px_32px_#28190A2E]"
        >
          {results.length === 0 ? (
            <li role="option" aria-selected={false} aria-disabled="true" className="px-3 py-2.5 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
              No day matches.
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.id}
                id={`${LISTBOX}-${i}`}
                role="option"
                aria-selected={i === active}
                // mouseDown (not click) so the input keeps focus long enough to hear it.
                onMouseDown={(e) => {
                  e.preventDefault();
                  open(r);
                }}
                className={cn('flex cursor-pointer items-baseline gap-2 border-b border-wds-border px-3 py-2 last:border-b-0', i === active ? 'bg-wds-caramel-100' : '[@media(hover:hover)]:hover:bg-wds-neutral-50')}
              >
                <span className="font-wds-mono text-[13px] leading-4 text-[#1F5BAE]">{r.reference}</span>
                <span className="truncate font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                  · {longDay(r.date)} · {dayStatusChip(r.status)}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </>
  );
}
