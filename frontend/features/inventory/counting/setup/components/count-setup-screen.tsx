'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import { Skeleton } from '@/components/ui2/skeleton';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { cn } from '@/lib/cn';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { useSortableList } from '../../../_shared/hooks/use-sortable-list';
import { useUnsavedChangesGuard } from '../../../_shared/hooks/use-unsaved-changes-guard';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { scwErrorCode, scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { itemsLabel } from '../../_shared/lib/count-format';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { SectionItems, SetupView } from '../../_shared/types/counting-contract';
import { AddItemsDrawer } from './add-items-drawer';
import { CountSettingsDrawer } from './count-settings-drawer';

const COUNTS = '/app/inventory/stock/counts';
const UNSECTIONED = 'unsectioned';
type Item = SectionItems['items'][number];

interface Draft {
  order: string[];
  items: Record<string, Item[]>;
}

const sameDraft = (a: Draft, b: Draft): boolean => JSON.stringify([a.order, Object.fromEntries(Object.entries(a.items).map(([k, v]) => [k, v.map((i) => i.itemId)]))]) === JSON.stringify([b.order, Object.fromEntries(Object.entries(b.items).map(([k, v]) => [k, v.map((i) => i.itemId)]))]);

/**
 * Count setup (Paper step 24 `21MC-0`): the sections in shelf order and one section's items on a single scrollable list. Drag the
 * sections or the items (or focus a handle and use the arrow keys), move an item to another section from its "Section" menu, add a
 * section, undo an Attendant's move, and "Save order" writes the whole layout at once. Read only for a person who may not edit:
 * no handles, no buttons. A stale layout (409) keeps the local order and asks to reload. The drawers (`?drawer=add-items`,
 * `?drawer=settings`) are the Add items and Count settings steps.
 */
export function CountSetupScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { can, ready } = usePermissions();
  const [view, setView] = React.useState<SetupView | null>(null);
  const [saved, setSaved] = React.useState<Draft | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [selected, setSelected] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [failure, setFailure] = React.useState<{ text: string; stale: boolean } | null>(null);
  const [addingSection, setAddingSection] = React.useState(false);
  const [sectionName, setSectionName] = React.useState('');
  const [sectionError, setSectionError] = React.useState<string | null>(null);
  const [busyMove, setBusyMove] = React.useState<string | null>(null);
  const drawer = params.get('drawer');

  const load = React.useCallback(async (keepLocal: Draft | null): Promise<void> => {
    try {
      const v = await countingApi.setup();
      const ids = [...v.sections.map((s) => s.id), UNSECTIONED];
      const lists = await Promise.all(ids.map((id) => countingApi.sectionItems(id)));
      const items: Record<string, Item[]> = {};
      ids.forEach((id, i) => {
        items[id] = lists[i]?.items ?? [];
      });
      const server: Draft = { order: v.sections.map((s) => s.id), items };
      setView(v);
      setSaved(server);
      // After a stale-layout reload the person's own order is kept for another try, as far as it still fits what the server has.
      if (keepLocal) {
        const known = new Set(Object.values(items).flat().map((i) => i.itemId));
        const order = [...keepLocal.order.filter((id) => v.sections.some((s) => s.id === id)), ...v.sections.map((s) => s.id).filter((id) => !keepLocal.order.includes(id))];
        const merged: Record<string, Item[]> = {};
        for (const id of ids) merged[id] = (keepLocal.items[id] ?? items[id] ?? []).filter((i) => known.has(i.itemId));
        setDraft({ order, items: merged });
      } else {
        setDraft(server);
      }
      setSelected((cur) => (cur && ids.includes(cur) ? cur : (v.sections[0]?.id ?? null)));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  React.useEffect(() => {
    if (ready && can('counts.read')) void load(null);
  }, [ready, can, load]);

  const canEdit = Boolean(view?.can.edit);
  const dirty = Boolean(draft && saved && !sameDraft(draft, saved));
  const guard = useUnsavedChangesGuard(dirty);

  const sectionById = React.useMemo(() => new Map((view?.sections ?? []).map((s) => [s.id, s])), [view]);
  const orderedSections = (draft?.order ?? []).map((id) => sectionById.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const sections = useSortableList(orderedSections, (s) => s.id, (s) => s.name, (next) => setDraft((d) => (d ? { ...d, order: next.map((s) => s.id) } : d)));
  const currentItems = (selected && draft?.items[selected]) || [];
  const itemSort = useSortableList(currentItems, (i) => i.itemId, (i) => i.name, (next) => setDraft((d) => (d && selected ? { ...d, items: { ...d.items, [selected]: next } } : d)));

  const moveItem = (item: Item, toId: string): void => {
    setDraft((d) => {
      if (!d || !selected) return d;
      return { ...d, items: { ...d.items, [selected]: (d.items[selected] ?? []).filter((i) => i.itemId !== item.itemId), [toId]: [...(d.items[toId] ?? []), { ...item, movedHere: null }] } };
    });
  };

  const save = async (): Promise<void> => {
    if (!draft || !view || saving) return;
    setSaving(true);
    setFailure(null);
    try {
      const next = await countingApi.saveLayout({
        version: view.version,
        sections: [...draft.order, UNSECTIONED].map((id) => ({ id, itemIds: (draft.items[id] ?? []).map((i) => i.itemId) })),
      });
      setView(next);
      await load(null);
      useWdsToastStore.getState().addToast({ variant: 'success', title: 'Order saved', description: 'Applies from the next count.' });
    } catch (err) {
      setFailure({ text: scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.countSetup.error), stale: scwErrorCode(err) === 'LAYOUT_CHANGED' });
    } finally {
      setSaving(false);
    }
  };

  const undo = async (moveId: string): Promise<void> => {
    if (busyMove) return;
    setBusyMove(moveId);
    try {
      await countingApi.undoMove(moveId);
      await load(dirty ? draft : null);
    } catch (err) {
      setFailure({ text: scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.countSetup.error), stale: false });
    } finally {
      setBusyMove(null);
    }
  };

  const addSection = async (): Promise<void> => {
    const name = sectionName.trim();
    if (!name) return;
    setSectionError(null);
    try {
      await countingApi.addSection(name);
      setAddingSection(false);
      setSectionName('');
      await load(dirty ? draft : null);
    } catch (err) {
      setSectionError(scwErrorMessage(err, COUNT_ERROR_COPY, 'Could not add the section. Try again.'));
    }
  };

  const setDrawer = (value: string | null): void => {
    const q = new URLSearchParams(params.toString());
    if (value) q.set('drawer', value);
    else q.delete('drawer');
    router.replace(`${COUNTS}/setup${q.toString() ? `?${q}` : ''}`, { scroll: false });
  };

  const topbar = (
    <ScwTopbar
      search={false}
      breadcrumb={{ root: 'Central Store', section: 'Counts', sectionHref: COUNTS, screen: 'Setup' }}
      actions={
        <>
          <Button variant="secondary" asChild>
            <a href="/app/inventory/count-print/blank" target="_blank" rel="noreferrer">
              Print blank sheet<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Button>
          <Button variant="secondary" onClick={() => setDrawer('settings')}>
            Count settings
          </Button>
          {view && view.unsectioned.count > 0 ? (
            <button
              type="button"
              onClick={() => setSelected(UNSECTIONED)}
              className="flex h-8 items-center border border-wds-warning-border bg-wds-warning-bg px-3.5 font-wds-sans text-[13px] leading-4 text-wds-warning-fg outline-none transition-colors hover:bg-wds-caramel-100 focus-visible:shadow-wds-ring"
            >
              Unsectioned {view.unsectioned.count}
            </button>
          ) : null}
        </>
      }
    />
  );

  if (ready && !can('counts.read')) return <ScwStatePanel kind="permission" text={COUNTING_STATES_COPY.countSetup.permission} className="m-8" />;
  if (status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topbar}
        <ScwStatePanel kind="error" text={COUNTING_STATES_COPY.countSetup.error} onRetry={() => { setStatus('loading'); void load(null); }} className="m-8" />
      </div>
    );
  }
  if (status === 'loading' || !view || !draft) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topbar}
        <LoadingAnnouncer text={COUNTING_STATES_COPY.countSetup.loading} />
        <div className="flex flex-col gap-[18px] px-8 pt-7" aria-hidden>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-3.5 w-[520px]" />
          </div>
          <div className="flex gap-7">
            <div className="flex w-[340px] flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[62px] w-full" />
              ))}
            </div>
            <div className="flex grow flex-col gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedSection = selected === UNSECTIONED ? null : sectionById.get(selected ?? '');
  const selectedName = selected === UNSECTIONED ? 'Not in any section' : (selectedSection?.name ?? '');
  const empty = view.sections.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {topbar}
      <main className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-8 pt-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">Count setup</h1>
          <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">Sections follow the supplier. Drag to change the order the Attendant sees. Changes apply from the next count.</p>
        </div>
        {failure ? (
          <div className="flex items-start justify-between gap-3 border border-wds-error-border bg-wds-error-bg px-3.5 py-3" role="alert">
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{failure.text}</span>
            {failure.stale ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFailure(null);
                  void load(draft);
                }}
              >
                Reload
              </Button>
            ) : null}
          </div>
        ) : null}
        {empty ? (
          <ScwStatePanel kind="empty" text={COUNTING_STATES_COPY.countSetup.empty} actionLabel={canEdit ? 'Add a section' : undefined} onAction={() => setAddingSection(true)} />
        ) : null}

        <div className="flex flex-wrap items-start gap-7">
          <div className="flex w-[340px] shrink-0 flex-col gap-2">
            <h2 className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Sections · shelf order</h2>
            <ol className="flex flex-col gap-2">
              {orderedSections.map((s, i) => {
                const on = selected === s.id;
                return (
                  <li
                    key={s.id}
                    ref={sections.rowRef(s.id)}
                    className={cn('flex items-center gap-3 p-3.5 transition-[background-color,border-color] duration-150', on ? 'border-[1.5px] border-wds-selected-edge bg-wds-espresso-50' : 'border border-wds-border bg-wds-surface [@media(hover:hover)]:hover:bg-wds-neutral-50')}
                  >
                    {canEdit ? (
                      <button
                        {...sections.handleProps(s.id, `${s.name}, section ${i + 1} of ${orderedSections.length}`)}
                        className={cn('-m-4 flex size-11 shrink-0 cursor-grab items-center justify-center outline-none focus-visible:shadow-wds-ring active:cursor-grabbing', on ? 'text-wds-selected-edge' : 'text-wds-neutral-400')}
                      >
                        <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true" fill="currentColor">
                          {[3, 8, 13].flatMap((y) => [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />))}
                        </svg>
                      </button>
                    ) : null}
                    <button type="button" onClick={() => setSelected(s.id)} aria-current={on ? 'true' : undefined} className="flex min-w-0 grow flex-col text-left outline-none focus-visible:shadow-wds-ring">
                      <span className="truncate font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">
                        {i + 1} · {s.name}
                      </span>
                      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                        {itemsLabel(draft.items[s.id]?.length ?? s.itemCount)}
                        {s.tagText ? ` · ${s.tagText}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setSelected(UNSECTIONED)}
                  className={cn('flex w-full flex-col border border-dashed border-wds-warning-border bg-wds-warning-bg p-3.5 text-left outline-none transition-colors focus-visible:shadow-wds-ring hover:bg-wds-caramel-100', selected === UNSECTIONED && 'border-[1.5px] border-solid')}
                >
                  <span className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-warning-fg">Not in any section</span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{view.unsectioned.text}</span>
                </button>
              </li>
            </ol>
            <div role="status" aria-live="polite" className="sr-only">
              {sections.announcement}
            </div>
            {canEdit ? (
              addingSection ? (
                <form
                  className="flex flex-col gap-1.5 pt-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addSection();
                  }}
                >
                  <label htmlFor="new-section" className="sr-only">
                    Name of the new section
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="new-section"
                      autoFocus
                      value={sectionName}
                      onChange={(e) => setSectionName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setAddingSection(false)}
                      placeholder="Section name"
                      maxLength={60}
                      className="h-9 min-w-0 grow border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[13px] outline-none focus:border-wds-selected-edge focus:shadow-wds-ring"
                    />
                    <Button type="submit" size="sm" className="h-9" disabled={sectionName.trim() === ''}>
                      Add
                    </Button>
                    <Button type="button" variant="secondary" size="sm" className="h-9" onClick={() => { setAddingSection(false); setSectionError(null); }}>
                      Cancel
                    </Button>
                  </div>
                  {sectionError ? (
                    <p role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
                      {sectionError}
                    </p>
                  ) : null}
                </form>
              ) : (
                <div className="pt-1">
                  <button type="button" onClick={() => setAddingSection(true)} className="font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring">
                    + Add a section
                  </button>
                </div>
              )
            ) : null}
          </div>

          <section className="flex min-w-[420px] grow basis-0 flex-col" aria-labelledby="items-title">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
              <h2 id="items-title" className="font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
                {selectedName} · {currentItems.length} items
              </h2>
              <div className="flex items-center gap-3.5">
                {canEdit ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Drag an item to reorder it, or move it to another section</span> : null}
                {canEdit && selected && selected !== UNSECTIONED ? (
                  <Button variant="secondary" onClick={() => setDrawer('add-items')} className="h-[30px] px-3">
                    Add items
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex h-8 shrink-0 items-center border-b border-t border-b-wds-border border-t-wds-text-ink bg-wds-surface px-3.5 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">
              <span className="grow">Item</span>
              <span className="w-[90px] shrink-0">Unit</span>
              <span className="w-[130px] shrink-0">Last counted</span>
              <span className="w-[130px] shrink-0 text-right">Move to</span>
            </div>
            <ul className="max-h-[420px] overflow-y-auto" aria-label={`Items in ${selectedName}`}>
              {currentItems.length === 0 ? (
                <li className="border-b border-wds-neutral-100 bg-wds-surface px-3.5 py-6 font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
                  {selected === UNSECTIONED ? 'Every item is in a section.' : 'No items in this section yet.'}
                </li>
              ) : (
                currentItems.map((item, index) => (
                  <li
                    key={item.itemId}
                    ref={itemSort.rowRef(item.itemId)}
                    className={cn('group relative flex items-center border-b border-wds-neutral-100 px-3.5 transition-colors duration-150', item.movedHere ? 'h-14 bg-wds-warning-bg' : 'h-12 bg-wds-surface', itemSort.draggingId === item.itemId && 'bg-wds-espresso-50 shadow-wds-md')}
                  >
                    {canEdit ? (
                      <button
                        {...itemSort.handleProps(item.itemId, `${item.name}, item ${index + 1} of ${currentItems.length}`)}
                        className="absolute left-0 top-1/2 flex size-11 -translate-y-1/2 cursor-grab items-center justify-center text-wds-neutral-400 opacity-0 outline-none transition-opacity focus-visible:opacity-100 focus-visible:shadow-wds-ring group-hover:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100"
                      >
                        <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true" fill="currentColor">
                          {[3, 8, 13].flatMap((y) => [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />))}
                        </svg>
                      </button>
                    ) : null}
                    <span className="flex min-w-0 grow flex-col">
                      <span className="truncate font-wds-sans text-[14px] leading-5 text-wds-text-ink">{item.name}</span>
                      {item.movedHere ? <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-warning-fg">{item.movedHere.text}</span> : null}
                    </span>
                    <span className="w-[90px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{item.unit}</span>
                    <span className={cn('w-[130px] shrink-0 font-wds-mono text-[12px] leading-4', item.stale ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{item.lastCountedText}</span>
                    <span className="flex w-[130px] shrink-0 justify-end">
                      {item.movedHere?.can.undo ? (
                        <button type="button" disabled={busyMove === item.movedHere.id} onClick={() => void undo(item.movedHere?.id ?? '')} className="font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring disabled:opacity-50">
                          Undo move<span className="sr-only"> of {item.name}</span>
                        </button>
                      ) : canEdit ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring">
                              Section<span className="sr-only"> for {item.name}: move to another section</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Move {item.name} to</DropdownMenuLabel>
                            {[...orderedSections.map((s) => ({ id: s.id, name: s.name })), { id: UNSECTIONED, name: 'Not in any section' }]
                              .filter((s) => s.id !== selected)
                              .map((s) => (
                                <DropdownMenuItem key={s.id} onSelect={() => moveItem(item, s.id)}>
                                  {s.name}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </span>
                  </li>
                ))
              )}
            </ul>
            <div role="status" aria-live="polite" className="sr-only">
              {itemSort.announcement}
            </div>
            {currentItems.length > 8 ? <p className="px-3.5 py-2.5 font-wds-sans text-[12px] leading-4 text-wds-text-faint">Scroll this list. The whole section stays on one page so you can drag items anywhere in it.</p> : null}
          </section>
        </div>

        <div className="grow" />
        <div className="sticky bottom-0 -mx-8 flex min-h-[60px] shrink-0 items-center justify-between gap-4 border-t border-wds-border-strong bg-wds-canvas px-8 py-3">
          <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary" role="status" aria-live="polite">
            {dirty ? 'You have changes that are not saved yet. ' : ''}
            {view.movedText ? `${view.movedText} ` : ''}Every change appears in the Audit log.
          </p>
          {canEdit ? (
            <button
              type="button"
              disabled={!dirty || saving}
              title={!dirty ? 'Nothing has changed' : undefined}
              onClick={() => void save()}
              className="flex h-9 items-center bg-wds-gradient-primary px-[18px] font-wds-sans text-[13px] font-semibold leading-4 text-wds-primary-fg outline-none transition-[filter,transform,box-shadow] duration-100 focus-visible:shadow-wds-ring enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted motion-safe:enabled:active:scale-[0.99]"
            >
              {saving ? 'Saving…' : 'Save order'}
            </button>
          ) : null}
        </div>
      </main>

      <AddItemsDrawer
        open={drawer === 'add-items'}
        onOpenChange={(open) => !open && setDrawer(null)}
        section={selected && selected !== UNSECTIONED ? { id: selected, name: selectedName } : (view.sections[0] ? { id: view.sections[0].id, name: view.sections[0].name } : null)}
        onAdded={() => void load(dirty ? draft : null)}
      />
      <CountSettingsDrawer open={drawer === 'settings'} onOpenChange={(open) => !open && setDrawer(null)} />
      <ConfirmDialog
        open={guard.pendingHref !== null}
        onOpenChange={(open) => !open && guard.stay()}
        title="Leave without saving?"
        description="You changed the order or moved items, but have not saved. Leaving will lose those changes."
        confirmLabel="Leave"
        cancelLabel="Keep editing"
        onConfirm={guard.confirmLeave}
      />
    </div>
  );
}
