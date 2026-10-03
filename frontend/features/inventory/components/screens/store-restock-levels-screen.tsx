'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { Skeleton } from '@/components/ui2/skeleton';
import { Topbar } from '@/components/app/shell/topbar';
import { LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthStore } from '@/store/authStore';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { useRestockBranches } from '../../hooks/use-restock-branches';
import { useRestockLevelsPage } from '../../hooks/use-restock-levels-page';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard';
import type { RestockLevelRow, RestockScope } from '../../types';
import { matchesStripFilter, rowsForTab, sortLowAndOutFirst, type RestockTab, type StripFilter } from '../../lib/restock-logic';
import { CatalogKpiStrip, type CatalogKpiCell } from '../catalog/catalog-kpi-strip';
import { RestockHistoryDrawer, type HistoryRequest } from '../restock/history-drawer';
import { RestockTable } from '../restock/restock-table';
import { ReviewDialog } from '../restock/review-dialog';
import { UnsavedBar } from '../restock/unsaved-bar';
import { WhoseLevelsSwitch, scopeLabel } from '../restock/whose-levels-switch';
import { SkeletonRows, StockEmptyCard, StockErrorCard, TableRowSkeleton } from '../stock/stock-states';

const SEARCH_DEBOUNCE_MS = 250;

/** A value that follows `value` after it has been still for `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const chipBase =
  'inline-flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-wds-sm px-3 font-wds-sans text-[13px] leading-4 transition-[background-color,border-color,transform] duration-150 focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]';

function TabChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        chipBase,
        active ? 'bg-wds-text-ink font-medium text-white' : 'border border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50'
      )}
    >
      {children}
    </button>
  );
}

const TabCount = ({ children, active }: { children: React.ReactNode; active: boolean }) => (
  <span className={cn('font-wds-mono text-[11px] leading-[14px]', active ? 'text-[#B5AEA5]' : 'text-wds-text-secondary')}>{children}</span>
);

/** Per-screen copy for the shared states kit: what an empty list says depends on what is filtering it. */
function emptyCopy(opts: { search: string; strip: StripFilter | null; tab: RestockTab; whose: string }): { title: string; description: string } {
  if (opts.search) return { title: 'No item matches', description: `Nothing under ${opts.whose} matches “${opts.search}”.` };
  if (opts.strip === 'OUT') return { title: 'Nothing is out', description: 'Every item with a level has some on hand.' };
  if (opts.strip === 'LOW') return { title: 'Nothing is low', description: 'Every item with a level is at or above it.' };
  if (opts.strip === 'NO_LEVEL' || opts.tab === 'NO_LEVEL') return { title: 'Every item has a level', description: 'No item is waiting for a level.' };
  if (opts.strip === 'DIFFER') return { title: 'Levels and suggestions agree', description: 'No level is more than 20% from its suggestion.' };
  if (opts.tab === 'LOW_OUT_FIRST') return { title: 'No levels set yet', description: 'Set a level on an item and it will show here. Items without a level are under No level set.' };
  return { title: 'No items here', description: `No item is set up for ${opts.whose} yet.` };
}

/**
 * Restock levels — Paper "Chapter 3 · Restock levels", steps 11 (the page), 12 (Review level changes)
 * and 13 (Level history). The Store Manager sets levels for the Central Store, or for any department
 * at a branch; edits stay local until Review → Save, which sends only the changed levels in one request.
 * No phone layout is drawn for the Store Manager; the Department Head's phone screen is separate.
 */
export function StoreRestockLevelsScreen() {
  const { hydrated } = useMediaQuery('(min-width: 1024px)');
  const role = useAuthStore((s) => s.role);
  const isManager = role === 'STORE_MANAGER';
  const addToast = useWdsToastStore((s) => s.addToast);

  const [scope, setScope] = React.useState<RestockScope>('CENTRAL_STORE');
  const [chosenBranchId, setChosenBranchId] = React.useState<string | null>(null);
  const { branches, status: branchesStatus, reload: reloadBranches } = useRestockBranches(isManager);
  const branchId = scope === 'CENTRAL_STORE' ? null : (chosenBranchId ?? branches[0]?.id ?? null);
  const whoseLabel =
    scope === 'CENTRAL_STORE' ? 'Central Store' : `${scopeLabel(scope)} · ${branches.find((b) => b.id === branchId)?.name ?? '…'}`;
  const whose = React.useMemo(() => ({ scope, branchId }), [scope, branchId]);

  const [searchInput, setSearchInput] = React.useState('');
  const search = useDebounced(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [tab, setTab] = React.useState<RestockTab>('LOW_OUT_FIRST');
  const [strip, setStrip] = React.useState<StripFilter | null>(null);

  const page = useRestockLevelsPage(whose, search, isManager);
  const { rows, summary, status, error, reload, refresh, edits, setLevelText, changes, invalid, dirty, discard, save, saving, saveError } = page;
  const invalidCount = Object.keys(invalid).length;

  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryRequest | null>(null);
  const [pendingWhose, setPendingWhose] = React.useState<{ scope: RestockScope; branchId: string | null } | null>(null);
  const guard = useUnsavedChangesGuard(dirty);

  // A different "whose levels" is a different list: ask first when edits would be lost.
  const requestWhose = (next: { scope: RestockScope; branchId: string | null }) => {
    if (dirty) setPendingWhose(next);
    else applyWhose(next);
  };
  const applyWhose = (next: { scope: RestockScope; branchId: string | null }) => {
    setScope(next.scope);
    setChosenBranchId(next.branchId);
    setStrip(null);
    setSearchInput('');
    setPendingWhose(null);
  };

  const rowsShown = React.useMemo(() => {
    if (strip) return sortLowAndOutFirst(rows.filter((r) => matchesStripFilter(r, strip)));
    return rowsForTab(rows, tab);
  }, [rows, tab, strip]);

  const openItemHistory = React.useCallback(
    (row: RestockLevelRow) => setHistory({ scope, branchId: branchId ?? undefined, inventoryItemId: row.inventoryItemId, itemName: row.itemName, whoseLabel }),
    [scope, branchId, whoseLabel]
  );
  const openRecentHistory = () => setHistory({ scope, branchId: branchId ?? undefined, whoseLabel });

  const handleSave = async (note: string) => {
    const count = changes.length;
    const ok = await save(note);
    if (ok) {
      setReviewOpen(false);
      addToast({ variant: 'success', title: 'Restock levels saved', description: `${count} ${count === 1 ? 'level' : 'levels'} updated for ${whoseLabel}.` });
    }
  };

  const toggleStrip = (next: StripFilter) => setStrip((current) => (current === next ? null : next));
  const chooseTab = (next: RestockTab) => {
    setStrip(null);
    setTab(next);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wds-canvas">
        <LoadingState />
      </div>
    );
  }

  const breadcrumb = { root: 'Central Store', section: 'Stock & counts', screen: 'Restock levels', sectionHref: '/app/inventory/stock' };

  if (!isManager) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar breadcrumb={breadcrumb} hideSearch className="shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <PermissionDeniedState description="Restock levels are set by the Store Manager. Department Heads set their own on their phones." />
        </div>
      </div>
    );
  }

  const cells: CatalogKpiCell[] = summary
    ? [
        { key: 'out', label: 'Out', value: String(summary.out), sub: 'nothing on hand', error: summary.out > 0, arrow: true, onSelect: () => toggleStrip('OUT'), active: strip === 'OUT' },
        { key: 'low', label: 'Low', value: String(summary.low), sub: 'below the restock level', attention: summary.low > 0, arrow: true, onSelect: () => toggleStrip('LOW'), active: strip === 'LOW' },
        { key: 'no-level', label: 'No level set', value: String(summary.noLevel), sub: 'items without a level', arrow: true, onSelect: () => toggleStrip('NO_LEVEL'), active: strip === 'NO_LEVEL' },
        { key: 'differ', label: 'Suggestions differ', value: String(summary.suggestionsDiffer), sub: 'level and suggestion disagree', arrow: true, onSelect: () => toggleStrip('DIFFER'), active: strip === 'DIFFER' },
      ]
    : [];

  const subtitle =
    scope === 'CENTRAL_STORE'
      ? 'How much to keep at the Central Store. Below the level an item shows as Low and is suggested for the next order. Departments set their own on their phones.'
      : `How much to keep in the ${scopeLabel(scope)} at ${branches.find((b) => b.id === branchId)?.name ?? 'the branch'}. Below the level an item shows as Low and is suggested for the next order.`;

  const copy = emptyCopy({ search, strip, tab, whose: whoseLabel });
  const filtered = Boolean(search) || strip !== null;

  const body =
    status === 'error' ? (
      <StockErrorCard title="Couldn’t load restock levels" description={error ?? 'Check your connection and try again.'} onRetry={() => void reload()} />
    ) : status === 'idle' || (status === 'loading' && rows.length === 0) ? (
      <SkeletonRows count={7} label="Loading restock levels">
        {(i) => <TableRowSkeleton key={i} widths={[64, 80, 64, 84, 150]} nameWidth={150} />}
      </SkeletonRows>
    ) : rowsShown.length === 0 ? (
      <StockEmptyCard
        title={copy.title}
        description={copy.description}
        actionLabel={filtered ? 'Clear filters' : tab === 'LOW_OUT_FIRST' ? 'Show all items' : undefined}
        onAction={
          filtered
            ? () => {
                setSearchInput('');
                setStrip(null);
              }
            : tab === 'LOW_OUT_FIRST'
              ? () => chooseTab('ALL')
              : undefined
        }
        className="mx-auto"
      />
    ) : (
      <RestockTable rows={rowsShown} edits={edits} onLevelChange={setLevelText} onOpenHistory={openItemHistory} />
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={breadcrumb}
        hideSearch
        actions={
          <Button variant="secondary" onClick={openRecentHistory}>
            Change history
          </Button>
        }
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-8 py-7">
        <div className="flex shrink-0 flex-col gap-1.5">
          <h1 className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">Restock levels</h1>
          <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{subtitle}</p>
        </div>
        <div className="shrink-0">
          <WhoseLevelsSwitch
            scope={scope}
            onScopeChange={(next) => requestWhose({ scope: next, branchId: null })}
            branches={branches}
            branchId={branchId}
            onBranchChange={(id) => requestWhose({ scope, branchId: id })}
            departmentsAvailable={branchesStatus === 'ready' && branches.length > 0}
          />
          {branchesStatus === 'error' ? (
            <p role="alert" className="mt-2 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
              Departments’ levels are unavailable because the branch list did not load.{' '}
              <button type="button" className="underline underline-offset-2" onClick={() => void reloadBranches()}>
                Try again
              </button>
            </p>
          ) : null}
        </div>
        {summary ? (
          <CatalogKpiStrip cells={cells} className="shrink-0" />
        ) : (
          <Skeleton className="h-[106px] w-full shrink-0" aria-hidden />
        )}
        <div className="flex shrink-0 items-center gap-2">
          <TabChip active={!strip && tab === 'LOW_OUT_FIRST'} onClick={() => chooseTab('LOW_OUT_FIRST')}>
            Low and Out first
          </TabChip>
          <TabChip active={!strip && tab === 'ALL'} onClick={() => chooseTab('ALL')}>
            All items
            {summary ? <TabCount active={!strip && tab === 'ALL'}>{summary.total}</TabCount> : null}
          </TabChip>
          <TabChip active={!strip && tab === 'NO_LEVEL'} onClick={() => chooseTab('NO_LEVEL')}>
            No level set
            {summary ? <TabCount active={!strip && tab === 'NO_LEVEL'}>{summary.noLevel}</TabCount> : null}
          </TabChip>
          <span className="grow" />
          <input
            type="text"
            name="search"
            autoComplete="off"
            aria-label="Search items"
            placeholder="Search items"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-[30px] w-[300px] shrink-0 rounded-wds-sm border border-wds-border-strong bg-white px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink placeholder:text-wds-text-faint focus-visible:outline-none focus-visible:border-wds-selected-edge focus-visible:shadow-[0_0_0_1px_var(--wds-selected-edge)]"
          />
        </div>
        <div className="shrink-0 overflow-x-auto">{body}</div>
      </div>
      {dirty ? (
        <div className="shrink-0 px-8 pb-6 pt-3">
          <UnsavedBar changeCount={changes.length} invalidCount={invalidCount} onDiscard={discard} onReview={() => setReviewOpen(true)} />
        </div>
      ) : null}

      <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} changes={changes} saving={saving} saveError={saveError} onSave={(note) => void handleSave(note)} />
      <RestockHistoryDrawer request={history} onClose={() => setHistory(null)} onPutBack={() => void refresh()} />

      <ConfirmDialog
        open={pendingWhose !== null}
        onOpenChange={(open) => (open ? undefined : setPendingWhose(null))}
        title="Discard unsaved changes?"
        description={`You have ${changes.length + invalidCount} unsaved ${changes.length + invalidCount === 1 ? 'change' : 'changes'}. Switching whose levels you are looking at drops them.`}
        confirmLabel="Discard and switch"
        cancelLabel="Keep editing"
        onConfirm={() => pendingWhose && applyWhose(pendingWhose)}
      />
      <ConfirmDialog
        open={guard.pendingHref !== null}
        onOpenChange={(open) => (open ? undefined : guard.stay())}
        title="Leave without saving?"
        description={`You have ${changes.length + invalidCount} unsaved ${changes.length + invalidCount === 1 ? 'change' : 'changes'} to restock levels. They will be lost.`}
        confirmLabel="Leave and discard"
        cancelLabel="Stay here"
        onConfirm={() => {
          discard();
          guard.confirmLeave();
        }}
      />
    </div>
  );
}
