'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { TablePager } from '@/components/ui2/data-table/table-pager';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui2/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { ScwCheckbox } from '../../../_shared/components/scw-checkbox';
import { FormErrorBanner } from '../../../_shared/components/stock-states';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { AddItemsList, SetupView } from '../../_shared/types/counting-contract';

const ALL = '__all__';

/**
 * Add items to a section (Paper steps 24B `23EG-0`, 24C `23KP-0`, 50 `265Y-0`, 51 `25SX-0`): search as you type with bold matches
 * and a "N matches for “…”" line, Category, Type and Department filters, the tabs "Not in any section" and "In other sections",
 * rows with a tick box and where the item is now ("New, no supplier", or "In Summer · moves here"), a numbered pager, and
 * "Add N items". An item from another section moves here (and is logged). No matches shows the drawn message with "Clear search".
 */
export function AddItemsDrawer({
  open,
  onOpenChange,
  section,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: { id: string; name: string } | null;
  onAdded: (view: SetupView) => void;
}) {
  return (
    <Sheet open={open && section !== null} onOpenChange={onOpenChange}>
      {open && section ? <Body section={section} onClose={() => onOpenChange(false)} onAdded={onAdded} /> : null}
    </Sheet>
  );
}

function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  if (!t) return <>{text}</>;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong className="font-semibold">{text.slice(i, i + t.length)}</strong>
      {text.slice(i + t.length)}
    </>
  );
}

function Body({ section, onClose, onAdded }: { section: { id: string; name: string }; onClose: () => void; onAdded: (view: SetupView) => void }) {
  const [text, setText] = React.useState('');
  const [q, setQ] = React.useState('');
  const [tab, setTab] = React.useState<'unsectioned' | 'other'>('unsectioned');
  const [category, setCategory] = React.useState('');
  const [type, setType] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(50);
  const [data, setData] = React.useState<AddItemsList | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  const options = React.useRef({ categories: new Set<string>(), types: new Set<string>() });

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [text]);

  React.useEffect(() => {
    const controller = new AbortController();
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    countingApi
      .addItemsList({ sectionId: section.id, q: q || undefined, tab, categoryId: category || undefined, type: type || undefined, departmentTag: department || undefined, page, pageSize: perPage as 25 | 50 | 100 }, controller.signal)
      .then(
        (res) => {
          if (controller.signal.aborted) return;
          res.rows.forEach((r) => {
            if (r.categoryName) options.current.categories.add(r.categoryName);
            options.current.types.add(r.typeText);
          });
          setData(res);
          setStatus('ready');
        },
        () => {
          if (!controller.signal.aborted) setStatus('error');
        },
      );
    return () => controller.abort();
  }, [section.id, q, tab, category, type, department, page, perPage, tick]);

  const toggle = (id: string): void =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const add = async (): Promise<void> => {
    if (adding || picked.size === 0) return;
    setAdding(true);
    setFailure(null);
    try {
      const view = await countingApi.addItems(section.id, Array.from(picked));
      onAdded(view);
      onClose();
    } catch (err) {
      setFailure(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.addItems.error));
      setAdding(false);
    }
  };

  const filterSelect = (label: string, value: string, set: (v: string) => void, values: string[]) => (
    <Select
      value={value || ALL}
      onValueChange={(v) => {
        set(v === ALL ? '' : v);
        setPage(1);
      }}
    >
      <SelectTrigger aria-label={label} className="h-9 w-auto gap-1.5 rounded-none border-wds-border-strong px-3 text-[13px] leading-4">
        <span>
          {label} · {value || 'All'}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All</SelectItem>
        {values.map((v) => (
          <SelectItem key={v} value={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const rows = data?.rows ?? [];
  const noMatches = status === 'ready' && rows.length === 0 && q !== '';
  const emptyTab = status === 'ready' && rows.length === 0 && q === '';
  const tabBtn = (key: 'unsectioned' | 'other', label: string, n: number | undefined) => (
    <button
      key={key}
      type="button"
      aria-pressed={tab === key}
      onClick={() => {
        setTab(key);
        setPage(1);
      }}
      className={cn(
        'border px-3 py-1.5 font-wds-sans text-[12px] leading-4 outline-none transition-colors duration-100 focus-visible:shadow-wds-ring',
        tab === key ? 'border-wds-text-ink bg-wds-text-ink text-white' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink [@media(hover:hover)]:hover:bg-wds-neutral-50',
      )}
    >
      {label} {n ?? ''}
    </button>
  );

  return (
    <SheetContent side="right" className="w-[480px] gap-0 border-l border-wds-border-strong">
      <SheetHeader className="border-b-0 px-7 pb-4 pt-6">
        <SheetTitle className="text-[20px] leading-[26px]">Add items to {section.name}</SheetTitle>
        <SheetDescription className="text-[13px] leading-4 text-wds-text-secondary">Pick what belongs on this shelf. Added items are counted from the next count.</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-7">
        <div className="flex flex-col gap-2">
          <label className="relative flex h-9 items-center border border-wds-border-strong bg-wds-surface px-3 focus-within:border-wds-selected-edge focus-within:shadow-wds-ring">
            <span className="sr-only">Find an item</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Find an item" autoComplete="off" className="min-w-0 grow bg-transparent font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none placeholder:text-wds-text-faint" />
            {text ? (
              <button type="button" aria-label="Clear the search" onClick={() => setText('')} className="-mr-1 flex size-6 items-center justify-center text-wds-neutral-700 outline-none hover:text-wds-text-ink focus-visible:shadow-wds-ring">
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </label>
          <div className="flex flex-wrap gap-2">
            {filterSelect('Category', category, setCategory, Array.from(options.current.categories).sort())}
            {filterSelect('Type', type, setType, Array.from(options.current.types).sort())}
            {filterSelect('Department', department, setDepartment, ['KITCHEN', 'BARISTA'])}
          </div>
        </div>

        {q !== '' && data?.matchText ? (
          <p className="-mb-3 border-b border-wds-border-strong pb-2.5 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary" aria-live="polite">
            {noMatches ? `0 matches for “${q}” · all sections` : data.matchText}
          </p>
        ) : null}
        {!noMatches ? <div className="flex gap-2">{tabBtn('unsectioned', 'Not in any section', data?.chips.unsectioned)}{tabBtn('other', 'In other sections', data?.chips.otherSections)}</div> : null}

        {failure ? <FormErrorBanner title="Could not add the items" description={failure} /> : null}

        {status === 'error' ? (
          <FormErrorBanner title="Could not search" description={COUNTING_STATES_COPY.addItems.error} />
        ) : status === 'loading' && !data ? (
          <div className="flex flex-col border-t border-wds-border-strong" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-wds-border px-1 py-3">
                <Skeleton className="size-[18px]" />
                <div className="flex grow flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-[50%]" />
                  <Skeleton className="h-3 w-[70%]" />
                </div>
              </div>
            ))}
          </div>
        ) : noMatches ? (
          <div className="flex flex-col gap-2 border-b border-wds-border px-5 py-6">
            <h3 className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">No item called “{q}”</h3>
            <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">{COUNTING_STATES_COPY.addItemsNoMatches.empty.replace('{query}', q).split('. ').slice(1).join('. ')}</p>
            <button type="button" onClick={() => setText('')} className="w-fit font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring">
              Clear search
            </button>
          </div>
        ) : emptyTab ? (
          <p className="border-t border-wds-border-strong py-6 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">{COUNTING_STATES_COPY.addItems.empty}</p>
        ) : (
          <>
            <ul className={cn('flex flex-col border-t border-wds-border-strong', status === 'loading' && 'opacity-60 transition-opacity')} aria-busy={status === 'loading'}>
              {rows.map((row) => {
                const on = picked.has(row.itemId);
                return (
                  <li key={row.itemId} className={cn('border-b border-wds-border', on && tab === 'other' && 'bg-wds-espresso-50')}>
                    <label className="flex cursor-pointer items-center gap-3 px-1 py-3 [@media(hover:hover)]:hover:bg-wds-neutral-50 focus-within:shadow-[inset_0_0_0_2px_var(--wds-ring)]">
                      <ScwCheckbox checked={on} onCheckedChange={() => toggle(row.itemId)} aria-label={`Add ${row.name}`} />
                      <span className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="truncate font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">
                          <Highlight text={row.name} term={q} />
                        </span>
                        <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{[row.categoryName, row.typeText, row.unit].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className={cn('shrink-0 font-wds-sans text-[12px] leading-4', row.placement.kind === 'UNSECTIONED' ? 'text-wds-warning-fg' : 'text-wds-selected-edge')}>
                        {row.placement.kind === 'UNSECTIONED' ? (row.placement.note ?? 'New') : `In ${row.placement.sectionName} · moves here`}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {data ? (
              <TablePager page={page} perPage={perPage} shown={rows.length} total={data.page.total} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} className="-mx-7 border-t border-wds-border" />
            ) : null}
            {tab === 'other' ? <p className="-mt-2 font-wds-sans text-[12px] leading-[17px] text-wds-text-faint">A moved item leaves its old section and keeps its count history.</p> : null}
          </>
        )}
        {status === 'error' ? (
          <Button variant="secondary" size="sm" className="w-fit" onClick={() => setTick((n) => n + 1)}>
            Try again
          </Button>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-wds-border px-7 pb-6 pt-4">
        <button type="button" onClick={onClose} className="font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge outline-none hover:underline focus-visible:shadow-wds-ring">
          Cancel
        </button>
        <button
          type="button"
          disabled={picked.size === 0 || adding}
          title={picked.size === 0 ? 'Tick at least one item' : undefined}
          onClick={() => void add()}
          className="flex h-10 items-center bg-wds-gradient-primary px-5 font-wds-sans text-[14px] font-semibold leading-5 text-wds-primary-fg outline-none transition-[filter,transform,box-shadow] duration-100 focus-visible:shadow-wds-ring enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted motion-safe:enabled:active:scale-[0.99]"
        >
          {adding ? 'Adding…' : picked.size === 0 ? 'Add items' : `Add ${picked.size} item${picked.size === 1 ? '' : 's'}`}
        </button>
      </div>
    </SheetContent>
  );
}
