'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Topbar, type TopbarBreadcrumb } from '@/components/app/shell/topbar';
import { stockApi } from '../../stock/_shared/services/stock-api';
import type { StockItemRow } from '../../stock/_shared/types/stock-contract';
import { usePermissions } from '../hooks/use-permissions';

/**
 * The desktop top bar of the Counting, Stock and Waste screens: breadcrumb, "Search an item ⌘K" and the page's actions. The search
 * finds an item by name (type-ahead, 250 ms after the last key) and opens that item's stock card (needs owner decision N6, the
 * default applied). It needs `stock.read`; without it the box is not drawn. ⌘K or Ctrl+K focuses it; Up and Down move through the
 * results, Enter opens one, Escape closes the list.
 */
export function ScwTopbar({ breadcrumb, actions, search = true }: { breadcrumb: TopbarBreadcrumb; actions?: React.ReactNode; /** False where Paper draws no search (Start a count, Count setup). */ search?: boolean }) {
  const { can } = usePermissions();
  const canSearch = search && can('stock.read');
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState('');
  const [rows, setRows] = React.useState<StockItemRow[]>([]);
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const [anchor, setAnchor] = React.useState<{ left: number; top: number; width: number } | null>(null);
  const listId = React.useId();

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

  React.useEffect(() => {
    const term = text.trim();
    if (!canSearch || term.length < 1) {
      setRows([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      stockApi.items({ search: term, pageSize: 25 }, controller.signal).then(
        (res) => {
          if (controller.signal.aborted) return;
          setRows(res.rows.slice(0, 6));
          setHighlight(0);
        },
        () => {
          if (!controller.signal.aborted) setRows([]);
        },
      );
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text, canSearch]);

  const choose = (row: StockItemRow): void => {
    setOpen(false);
    setText('');
    router.push(`/app/inventory/stock/ledger/${row.itemId}`);
  };

  const show = open && text.trim() !== '';
  return (
    <>
      <Topbar
        breadcrumb={breadcrumb}
        hideSearch={!canSearch}
        searchRef={inputRef}
        searchProps={{
          placeholder: 'Search an item',
          'aria-label': 'Search an item',
          role: 'combobox',
          'aria-expanded': show,
          'aria-controls': listId,
          'aria-autocomplete': 'list',
          value: text,
          onChange: (e) => {
            setText(e.target.value);
            setOpen(true);
            const rect = e.currentTarget.closest('div')?.getBoundingClientRect();
            if (rect) setAnchor({ left: rect.left, top: rect.bottom + 4, width: rect.width });
          },
          onFocus: (e) => {
            setOpen(true);
            const rect = e.currentTarget.closest('div')?.getBoundingClientRect();
            if (rect) setAnchor({ left: rect.left, top: rect.bottom + 4, width: rect.width });
          },
          onBlur: () => window.setTimeout(() => setOpen(false), 120),
          onKeyDown: (e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => Math.min(rows.length - 1, h + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === 'Enter' && rows[highlight]) {
              e.preventDefault();
              choose(rows[highlight] as StockItemRow);
            } else if (e.key === 'Escape') {
              setOpen(false);
              e.currentTarget.blur();
            }
          },
        }}
        actions={actions}
      />
      {show && anchor ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching items"
          style={{ left: anchor.left, top: anchor.top, width: Math.max(anchor.width, 320) }}
          className="fixed z-40 flex flex-col border border-wds-border-strong bg-wds-surface shadow-wds-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-100"
        >
          {rows.length === 0 ? (
            <li className="px-3 py-2.5 font-wds-sans text-[13px] leading-4 text-wds-text-secondary" role="presentation">
              No item called “{text.trim()}”.
            </li>
          ) : (
            rows.map((row, i) => (
              <li
                key={row.itemId}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(row);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn('flex cursor-pointer items-center justify-between gap-3 px-3 py-2', i === highlight && 'bg-wds-neutral-50')}
              >
                <span className="truncate font-wds-sans text-[13px] leading-4 text-wds-text-ink">{row.name}</span>
                <span className="shrink-0 font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">
                  {row.onHand} {row.unit}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </>
  );
}
