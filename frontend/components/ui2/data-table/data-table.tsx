'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { Button } from '../button';
import { Skeleton } from '../skeleton';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table';
import { TablePager } from './table-pager';
import { filterKeysOf, type TableFilter, TableToolbar } from './table-toolbar';
import { hasActiveNarrowing, matchSummary, type TableQuery, totalPages, UNPAGED } from './table-query';
import { useTableUrlState } from './use-table-url-state';

export interface TableColumn<Row> {
  id: string;
  header: React.ReactNode;
  /** `term` is the current search text: pass it to `<HighlightMatch>` in the cells people search by. */
  cell: (row: Row, ctx: { term: string }) => React.ReactNode;
  /** CSS width of the column, e.g. `'120px'`. Omit to share the remaining space. */
  width?: string;
  align?: 'left' | 'right';
  /** Classes for both the header and body cell (truncation, tabular numbers). */
  className?: string;
}

export interface TableResult<Row> {
  rows: Row[];
  /** Every row that matches the search and filters (not just this page). */
  total: number;
  /** Chip counts: `counts[filterKey][value]`, with `''` for "All". */
  counts?: Record<string, Record<string, number>>;
}

export interface TableFetchContext {
  signal: AbortSignal;
}

export interface TableCopy {
  emptyTitle: string;
  emptyDescription: string;
  filteredEmptyTitle: string;
  filteredEmptyDescription: string;
  errorTitle: string;
  errorDescription?: string;
  permissionDescription?: string;
}

export interface DataTableProps<Row> {
  columns: readonly TableColumn<Row>[];
  getRowId: (row: Row) => string;
  /**
   * Loads one page. Called when the URL state changes, never per keystroke. It may be an inline function: the table keeps
   * the latest one and does not refetch when only its identity changes. Pass `perPage: 0` (`UNPAGED`) handling for `paged={false}`.
   */
  fetchRows: (query: TableQuery, ctx: TableFetchContext) => Promise<TableResult<Row>>;
  filters?: readonly TableFilter[];
  copy: TableCopy;
  /** Accessible name of the table and its search form, e.g. "Stock items". */
  label: string;
  searchPlaceholder?: string;
  /** Hides the search box (a table that is a single item's ledger has nothing to search). */
  searchable?: boolean;
  /** Opens a row. Rows become focusable and respond to Enter and Space. */
  onRowActivate?: (row: Row) => void;
  /** Adds a class to a row, e.g. to mark a negative balance. */
  rowClassName?: (row: Row) => string | undefined;
  /** Chip counts from a separate call (a summary endpoint). Takes precedence over `result.counts` and may arrive after the rows. */
  counts?: Record<string, Record<string, number>>;
  /** Change this number to reload the current page (after a save elsewhere on the screen). */
  refreshToken?: number;
  /** Do not fetch yet (permissions still loading). */
  enabled?: boolean;
  /** The user may not read this table. Shows the permission state instead of rows. */
  permissionDenied?: boolean;
  /** §4a item 5: drag-to-reorder lists show the whole section on one scrollable list, with no pager. */
  paged?: boolean;
  /** With `paged={false}`: the list scrolls inside this height. */
  maxBodyHeight?: number;
  /** The URL parameter holding the search text. Defaults to `search`, which Stock items and Prep history already use. */
  searchParam?: string;
  /**
   * `cards` draws each row with `renderCard` instead of a table row, for phones (the Attendant's views). The toolbar, pager,
   * URL state and states are the same. The caller picks the layout (e.g. from `useMediaQuery`).
   */
  layout?: 'table' | 'cards';
  renderCard?: (row: Row, ctx: { term: string }) => React.ReactNode;
  className?: string;
}

const SKELETON_ROWS = 8;

type Load<Row> = { status: 'loading' | 'ready' | 'error'; result: TableResult<Row> | null };

function useTableData<Row>(fetchRows: DataTableProps<Row>['fetchRows'], query: TableQuery, enabled: boolean, refreshToken: number) {
  const [state, setState] = React.useState<Load<Row>>({ status: 'loading', result: null });
  const [retryTick, setRetryTick] = React.useState(0);
  // Latest fetch function and query are read through refs, so an inline function never causes a refetch loop.
  const fetchRef = React.useRef(fetchRows);
  fetchRef.current = fetchRows;
  const queryRef = React.useRef(query);
  queryRef.current = query;
  const queryKey = JSON.stringify(query);

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState((s) => (s.status === 'loading' ? s : { status: 'loading', result: s.result }));
    fetchRef.current(queryRef.current, { signal: controller.signal }).then(
      (result) => {
        if (!controller.signal.aborted) setState({ status: 'ready', result });
      },
      () => {
        if (!controller.signal.aborted) setState((s) => ({ status: 'error', result: s.result }));
      }
    );
    return () => controller.abort();
    // queryKey stands for the query's content; the query object itself is read through queryRef.
  }, [queryKey, enabled, refreshToken, retryTick]);

  const retry = React.useCallback(() => setRetryTick((n) => n + 1), []);
  return { ...state, retry };
}

/**
 * The one table (UI_BUILD_RULES §4a): search and filters first, type-ahead with bold matches, numbered pager with
 * rows per page, state in the URL, and the states kit (loading, empty, filtered-empty, error, permission).
 * Features pass columns, filter definitions and a fetch function; they do not build a footer.
 */
export function DataTable<Row>({
  columns,
  getRowId,
  fetchRows,
  filters = [],
  copy,
  label,
  searchPlaceholder = 'Search',
  searchable = true,
  onRowActivate,
  rowClassName,
  counts,
  refreshToken = 0,
  enabled = true,
  permissionDenied = false,
  paged = true,
  maxBodyHeight = 480,
  searchParam,
  layout = 'table',
  renderCard,
  className,
}: DataTableProps<Row>) {
  const filterKeys = React.useMemo(() => filterKeysOf(filters), [filters]);
  const { query, patch, setPage, clear, searchText, setSearchText } = useTableUrlState({ filterKeys, searchParam, paged });
  const { status, result, retry } = useTableData(fetchRows, query, enabled && !permissionDenied, refreshToken);

  const pages = result ? totalPages(result.total, query.perPage) : 1;
  // A pasted or stale link can point past the last page (the list shrank): land on the last page instead of an empty one.
  React.useEffect(() => {
    if (paged && status === 'ready' && result && result.total > 0 && result.rows.length === 0 && query.page > pages) setPage(pages);
  }, [paged, status, result, query.page, pages, setPage]);

  const onFilterChange = React.useCallback((key: string, value: string) => patch({ filters: { [key]: value } }), [patch]);
  const onFiltersChange = React.useCallback((changes: Record<string, string>) => patch({ filters: changes }), [patch]);
  const narrowed = hasActiveNarrowing(query);
  const showToolbar = searchable || filters.length > 0;

  if (permissionDenied) {
    return <PermissionDeniedState description={copy.permissionDescription ?? 'This page is not available for your role.'} />;
  }

  const term = query.search;
  const rows = result?.rows ?? [];
  const firstLoad = result === null && status !== 'error';
  const stale = status === 'loading' && result !== null;

  const clearButton = (
    <Button variant="secondary" size="sm" onClick={clear}>
      Clear filters
    </Button>
  );

  let body: React.ReactNode;
  if (status === 'error' && result === null) {
    body = <ErrorState title={copy.errorTitle} description={copy.errorDescription ?? 'Check your connection and try again.'} onRetry={retry} className="my-8" />;
  } else if (status === 'ready' && result && result.total === 0) {
    body = narrowed ? (
      <EmptyState title={copy.filteredEmptyTitle} description={copy.filteredEmptyDescription} action={clearButton} className="my-8" />
    ) : (
      <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} className="my-8" />
    );
  } else if (layout === 'cards' && renderCard) {
    body = (
      <div className={cn('flex flex-col transition-opacity duration-150', stale && 'opacity-60')} aria-busy={status === 'loading'} role="list" aria-label={label}>
        {firstLoad
          ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <div key={`sk-${i}`} aria-hidden className="flex flex-col gap-2 border-b border-wds-neutral-100 px-4 py-3.5">
                <Skeleton className="h-3 w-[55%]" />
                <Skeleton className="h-3 w-[35%]" />
              </div>
            ))
          : rows.map((row) => (
              <div key={getRowId(row)} role="listitem">
                {renderCard(row, { term })}
              </div>
            ))}
      </div>
    );
  } else {
    body = (
      <div className={cn(!paged && 'overflow-y-auto')} style={paged ? undefined : { maxHeight: maxBodyHeight }}>
        <div className="w-full overflow-x-auto">
          <table aria-label={label} aria-busy={status === 'loading'} className="w-full caption-bottom font-wds-sans text-wds-body-sm">
            <TableHeader>
              <TableRow className="h-[30px] hover:bg-transparent">
                {columns.map((c) => (
                  <TableHead key={c.id} style={c.width ? { width: c.width } : undefined} className={cn(c.align === 'right' && 'text-right', c.className)}>
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className={cn('transition-opacity duration-150', stale && 'opacity-60')}>
              {firstLoad
                ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                    <TableRow key={`sk-${i}`} className="hover:bg-transparent" aria-hidden>
                      {columns.map((c) => (
                        <TableCell key={c.id} className={cn(c.align === 'right' && 'text-right', c.className)}>
                          <Skeleton className={cn('h-3', c.align === 'right' ? 'ml-auto w-12' : 'w-[70%]')} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((row) => {
                    const interactive = onRowActivate !== undefined;
                    return (
                      <TableRow
                        key={getRowId(row)}
                        tabIndex={interactive ? 0 : undefined}
                        onClick={interactive ? () => onRowActivate(row) : undefined}
                        onKeyDown={
                          interactive
                            ? (e) => {
                                if (e.target !== e.currentTarget) return; // a button inside the row keeps its own Enter and Space
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onRowActivate(row);
                                }
                              }
                            : undefined
                        }
                        className={cn(interactive && 'cursor-pointer outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]', rowClassName?.(row))}
                      >
                        {columns.map((c) => (
                          <TableCell key={c.id} className={cn(c.align === 'right' && 'text-right', c.className)}>
                            {c.cell(row, { term })}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
            </TableBody>
          </table>
        </div>
        {status === 'error' ? (
          <div className="px-4 py-3">
            <ErrorState title={copy.errorTitle} description={copy.errorDescription ?? 'Check your connection and try again.'} onRetry={retry} className="h-auto w-full max-w-none flex-row justify-between p-3" />
          </div>
        ) : null}
      </div>
    );
  }

  const showMatchLine = term !== '' && status === 'ready' && result !== null && result.total > 0;
  const showPager = paged && result !== null && result.total > 0;

  return (
    <div className={cn('flex flex-col border border-wds-border bg-wds-surface', className)}>
      {showToolbar ? (
        <TableToolbar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder={searchPlaceholder}
          searchLabel={`Search ${label.toLowerCase()}`}
          filters={filters}
          values={query.filters}
          counts={counts ?? result?.counts}
          onFilterChange={onFilterChange}
          onFiltersChange={onFiltersChange}
          className={searchable ? undefined : '[&>label]:hidden'}
        />
      ) : null}
      <p
        className={cn('m-0 px-4 font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted', showMatchLine ? 'pb-2' : 'sr-only')}
        aria-live="polite"
      >
        {showMatchLine && result ? matchSummary(result.total, term) : ''}
      </p>
      {body}
      {showPager && result ? (
        <TablePager
          page={query.page}
          perPage={query.perPage === UNPAGED ? rows.length : query.perPage}
          shown={rows.length}
          total={result.total}
          onPageChange={setPage}
          onPerPageChange={(perPage) => patch({ perPage })}
          className="border-t border-wds-border"
        />
      ) : null}
    </div>
  );
}
