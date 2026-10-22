'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui2/sheet';
import { peopleReads } from '@/features/workforce/people';
import { highlight, personLine, searchLinks, type SearchLink } from './search-logic';

/**
 * Search (Ctrl K), in place of the old "jump box" (Paper 2.x). One field finds a page of the menu (matching letters in bold) and, for
 * a person who may see people, a person (name, position, site). Open with the box, Ctrl K or Cmd K; arrows move, Enter opens, Escape
 * closes and gives focus back. People are asked for only when the person holds a people read (the server decides; a refusal just
 * shows no people), and a failed people search never hides the pages.
 */
interface Hit {
  key: string;
  label: string;
  hint: string;
  href: string;
  kind: 'page' | 'person';
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function ShellSearch({ links, canSeePeople, variant = 'light', className }: { links: readonly SearchLink[]; canSeePeople: boolean; variant?: 'light' | 'sidebar'; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [people, setPeople] = React.useState<Hit[]>([]);
  const [index, setIndex] = React.useState(0);
  const debounced = useDebounced(query, 200);
  const trigger = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    const q = debounced.trim();
    if (!open || !canSeePeople || q.length < 2) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    peopleReads.list({ q, page: 1, perPage: 5 }).then(
      (page) => {
        if (!cancelled) setPeople(page.rows.map((r) => ({ key: `p:${r.id}`, label: personLine(r), hint: 'Person', href: `/app/workforce/employees/${r.id}`, kind: 'person' as const })));
      },
      () => {
        if (!cancelled) setPeople([]);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [debounced, open, canSeePeople]);

  const pages = React.useMemo(() => searchLinks(links, query), [links, query]);
  const hits: Hit[] = React.useMemo(() => [...pages.map((l) => ({ key: l.key, label: l.label, hint: l.group, href: l.href, kind: 'page' as const })), ...people], [pages, people]);
  React.useEffect(() => setIndex(0), [query]);

  const go = (hit: Hit | undefined): void => {
    if (!hit) return;
    setOpen(false);
    setQuery('');
    router.push(hit.href);
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(hits[index]);
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        aria-keyshortcuts="Control+K"
        className={cn(
          'flex h-8 max-w-full items-center gap-2 border text-left outline-none transition-colors focus-visible:shadow-wds-ring',
          variant === 'sidebar'
            ? 'w-full rounded-[2px] border-[#4A3A2E] bg-[#1E1005] px-2.5 text-[#8A7F76] hover:bg-wds-sidebar-active-bg'
            : 'w-[380px] justify-between border-wds-border-strong bg-wds-surface px-3 text-wds-text-secondary hover:bg-wds-neutral-50',
          className
        )}
      >
        {variant === 'sidebar' ? (
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden className="shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        ) : null}
        <span className={cn('truncate font-wds-sans leading-4', variant === 'sidebar' ? 'grow text-xs' : 'text-[13px]')}>{variant === 'sidebar' ? 'Search' : 'Find a person, a request or a page'}</span>
        <kbd className={cn('ml-3 shrink-0 border px-1.5 font-wds-mono text-[10px] leading-4', variant === 'sidebar' ? 'border-[#4A3A2E] text-[#8A7F76]' : 'border-wds-border bg-wds-neutral-50 text-wds-text-secondary')}>Ctrl K</kbd>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="top" className="inset-x-auto left-1/2 top-16 w-[560px] max-w-[94vw] -translate-x-1/2 border border-wds-border bg-wds-surface p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Search</SheetTitle>
          <input
            autoFocus
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Find a person, a request or a page"
            aria-label="Search"
            aria-controls="shell-search-results"
            role="combobox"
            aria-expanded
            aria-activedescendant={hits[index] ? `shell-search-${hits[index]?.key}` : undefined}
            className="h-12 w-full border-b border-wds-border bg-transparent px-4 font-wds-sans text-[15px] text-wds-text-ink outline-none placeholder:text-wds-text-secondary"
          />
          <ul id="shell-search-results" role="listbox" className="m-0 max-h-[50vh] list-none overflow-y-auto p-1">
            {hits.length === 0 ? (
              <li className="px-3 py-6 text-center font-wds-sans text-[13px] text-wds-text-secondary">{query.trim() ? `Nothing matches "${query.trim()}".` : 'Type to find a page.'}</li>
            ) : (
              hits.map((hit, i) => (
                <li key={hit.key} id={`shell-search-${hit.key}`} role="option" aria-selected={i === index}>
                  <button
                    type="button"
                    onClick={() => go(hit)}
                    onMouseMove={() => setIndex(i)}
                    className={cn('flex w-full items-center justify-between px-3 py-2 text-left font-wds-sans text-[14px] text-wds-text-ink outline-none', i === index && 'bg-wds-neutral-50')}
                  >
                    <span className="truncate">
                      {highlight(hit.label, hit.kind === 'page' ? query : '').map((s, n) => (
                        <span key={n} className={s.bold ? 'font-semibold' : undefined}>
                          {s.text}
                        </span>
                      ))}
                    </span>
                    <span className="ml-3 shrink-0 font-wds-mono text-[10px] tracking-[0.06em] text-wds-text-secondary">{hit.hint.toUpperCase()}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
