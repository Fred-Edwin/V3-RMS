'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { REQUISITIONS_KIT_COPY } from '../../_shared/lib/states-copy';
import { ADD_ITEM_COPY, changeSummary, headErrorMessage, SECTION_COPY } from '../../_shared/lib/phone-words';
import type { AddableItem } from '../../_shared/types/requisitions-contract';
import { groupByCategory, isChanged, useSectionDraft, type DraftLine } from '../../hooks/use-section-draft';
import { useHeadFile } from '../../hooks/use-head-requisitions';
import { formatQty } from '../../lib/qty';
import { reqEdit, reqEditAdd, reqFile } from '../../lib/routes';
import { requisitionsApi } from '../../services/requisitions-phone-api';
import { CategoryHeading, HeadFooter, HeadPhoneHeader, HeadPrimaryButton, RowLink, Stepper } from './head-phone-parts';
import { SendSheet } from './send-sheet';

const OBVIOUS_UNITS = new Set(['pcs', 'portion', 'portions']);
const changedFromText = (line: DraftLine): string =>
  SECTION_COPY.changedFrom(formatQty(line.suggestedQty ?? ''), OBVIOUS_UNITS.has(line.unit) ? null : line.unit);

/** Change lines (Paper step 3) and Add an item (step 4). The route knows only the requisition, so the department comes from the file. */
export function HeadEditScreen({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const file = useHeadFile(requisitionId);
  const data = file.data;
  const section = data?.sections[0] ?? null;
  const editable = Boolean(data && section && data.status === 'OPEN' && (section.status === 'DRAFT' || section.status === 'NOT_STARTED'));

  // A sent or approved list cannot be edited here: it is recalled first, on the file screen.
  React.useEffect(() => {
    if (data && section && !editable) router.replace(reqFile(requisitionId));
  }, [data, section, editable, router, requisitionId]);

  if (file.status === 'error') {
    return (
      <PhoneColumn>
        <HeadPhoneHeader leading="back" onBack={() => router.push(reqFile(requisitionId))} title="Change lines" subtitle="" />
        <div className="flex flex-1 flex-col bg-wds-canvas px-5 py-8">
          <div role="alert">
            <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => void file.reload()} />
          </div>
        </div>
      </PhoneColumn>
    );
  }
  if (!data || !section || !editable) return <EditSkeleton onBack={() => router.push(reqFile(requisitionId))} />;

  return (
    <DraftEditor
      requisitionId={requisitionId}
      departmentId={section.departmentId}
      departmentName={section.departmentName}
      reference={data.reference}
      cycleWord={data.cycleLabel.split(' · ')[0] ?? ''}
      branchName={data.branch.name}
    />
  );
}

interface DraftEditorProps {
  requisitionId: string;
  departmentId: string;
  departmentName: string;
  reference: string;
  cycleWord: string;
  branchName: string;
}

function DraftEditor({ requisitionId, departmentId, departmentName, reference, cycleWord, branchName }: DraftEditorProps) {
  const router = useRouter();
  const adding = useSearchParams().get('add') === '1';
  const draft = useSectionDraft(requisitionId, departmentId);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [flushFailed, setFlushFailed] = React.useState<string | null>(null);
  const undoRef = React.useRef<HTMLButtonElement>(null);
  const undoItem = draft.undo?.itemId ?? null;
  // The removed row's own buttons are gone, so keyboard focus goes to Undo rather than falling to the page.
  React.useEffect(() => {
    if (undoItem) undoRef.current?.focus();
  }, [undoItem]);

  const leave = React.useCallback(
    async (to: string): Promise<void> => {
      const ok = await draft.flush();
      if (ok) router.push(to);
      else setFlushFailed(draft.saveError ?? SECTION_COPY.saveFailed);
    },
    [draft, router],
  );

  const openSend = React.useCallback(async (): Promise<void> => {
    const ok = await draft.flush();
    if (ok) setSendOpen(true);
    else setFlushFailed(draft.saveError ?? SECTION_COPY.saveFailed);
  }, [draft]);

  const send = React.useCallback(
    async (pin: string, key: string): Promise<string | null> => {
      try {
        const saved = await draft.flush();
        if (!saved) return draft.saveError ?? SECTION_COPY.saveFailed;
        await requisitionsApi.send(requisitionId, departmentId, pin, key);
        router.replace(reqFile(requisitionId));
        return null;
      } catch (err) {
        return headErrorMessage(err);
      }
    },
    [draft, requisitionId, departmentId, router],
  );

  if (draft.edit.status === 'error') {
    return (
      <PhoneColumn>
        <HeadPhoneHeader leading="back" onBack={() => router.push(reqFile(requisitionId))} title="Change lines" subtitle={`${reference} · ${departmentName} · ${cycleWord}`} mono />
        <div className="flex flex-1 flex-col bg-wds-canvas px-5 py-8">
          <div role="alert">
            <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => void draft.edit.reload()} />
          </div>
        </div>
      </PhoneColumn>
    );
  }
  if (!draft.ready) return <EditSkeleton onBack={() => router.push(reqFile(requisitionId))} />;

  const saveText = draft.saveState === 'saving' ? SECTION_COPY.saving : draft.saveState === 'saved' ? SECTION_COPY.saved : null;
  const failure = flushFailed ?? (draft.saveState === 'error' ? draft.saveError : null);

  if (adding) {
    return (
      <PhoneColumn>
        <HeadPhoneHeader leading="back" onBack={() => void leave(reqEdit(requisitionId))} title="Add an item" subtitle={ADD_ITEM_COPY.subtitle(departmentName)} />
        <AddItemList draft={draft} addable={draft.data?.addable ?? []} query={query} onQuery={setQuery} />
        <HeadFooter summary={ADD_ITEM_COPY.summary(draft.counts.lineCount, draft.counts.added)} aside={failure ?? saveText ?? undefined}>
          <HeadPrimaryButton onClick={() => void leave(reqEdit(requisitionId))}>{ADD_ITEM_COPY.back}</HeadPrimaryButton>
        </HeadFooter>
      </PhoneColumn>
    );
  }

  const groups = groupByCategory(draft.lines);
  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="back" onBack={() => void leave(reqFile(requisitionId))} title="Change lines" subtitle={`${reference} · ${departmentName} · ${cycleWord}`} mono />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
          <div className="flex items-center justify-between gap-3 border-b border-wds-border bg-wds-surface px-5 py-3.5">
            <p className="w-[210px] shrink-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">{SECTION_COPY.changeIntro}</p>
            <RowLink onClick={() => void leave(reqEditAdd(requisitionId))}>{SECTION_COPY.addAnItem}</RowLink>
          </div>
          {draft.lines.length === 0 ? <p className="px-5 py-6 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{SECTION_COPY.noLines}</p> : null}
          {groups.map((group) => (
            <section key={group.heading} aria-label={group.heading}>
              <CategoryHeading heading={group.heading} trailing={SECTION_COPY.lines(group.lines.length)} />
              <ul>
                {group.lines.map((line) => (
                  <EditRow key={line.itemId} line={line} draft={draft} />
                ))}
              </ul>
            </section>
          ))}
        </div>
        {draft.undo ? (
          <div role="status" className="absolute inset-x-4 bottom-3 flex h-12 items-center justify-between rounded-[2px] bg-wds-neutral-800 px-4 shadow-lg">
            <p className="font-wds-sans text-[14px] leading-[18px] text-wds-neutral-0">{SECTION_COPY.removed(draft.undo.itemName)}</p>
            <button
              ref={undoRef}
              type="button"
              onClick={draft.undoRemove}
              className="-mr-2 flex min-h-11 items-center rounded-wds-sm px-2 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-caramel-300 outline-none transition-colors duration-100 hover:bg-white/10 focus-visible:shadow-wds-ring active:bg-white/20"
            >
              {SECTION_COPY.undo}
            </button>
          </div>
        ) : null}
      </div>
      <HeadFooter summary={changeSummary(draft.counts.lineCount, draft.counts.changed, draft.counts.removed)} aside={failure ?? saveText ?? undefined}>
        <HeadPrimaryButton onClick={() => void openSend()} disabled={draft.lines.length === 0 || draft.anyInvalid}>
          {SECTION_COPY.reviewAndSend}
        </HeadPrimaryButton>
      </HeadFooter>
      <SendSheet
        open={sendOpen}
        onOpenChange={setSendOpen}
        departmentName={departmentName}
        reference={reference}
        cycleLabel={cycleWord}
        branchName={branchName}
        lines={draft.lines.map((l) => ({ itemId: l.itemId, itemName: l.itemName, unit: l.unit, qty: l.qty, categoryPath: l.categoryPath }))}
        changes={draft.counts.changes}
        note={draft.note}
        onNote={draft.setNote}
        onSend={send}
      />
    </PhoneColumn>
  );
}

type Draft = ReturnType<typeof useSectionDraft>;

function EditRow({ line, draft }: { line: DraftLine; draft: Draft }) {
  const changed = isChanged(line);
  const added = line.suggestedQty === null;
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 border-b border-wds-border py-2.5 pl-5 pr-3',
        changed ? 'bg-wds-caramel-100 shadow-[inset_3px_0_0_0_var(--wds-caramel-500)]' : 'bg-wds-surface',
      )}
    >
      <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
        <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{line.itemName}</p>
        <p className={cn('font-wds-sans text-[13px] leading-4', changed ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>
          {added ? `${SECTION_COPY.addedLine} · ${line.unit}` : changed ? changedFromText(line) : line.onHand !== undefined && line.level !== undefined ? SECTION_COPY.onHandLevel(formatQty(line.onHand), formatQty(line.level), false) : line.unit}
        </p>
      </div>
      <Stepper
        itemName={line.itemName}
        value={line.qty}
        changed={changed}
        onChange={(raw) => draft.setQty(line.itemId, raw)}
        onCommit={() => draft.commitQty(line.itemId)}
        onStep={(delta) => draft.step(line.itemId, delta)}
      />
      <button
        type="button"
        onClick={() => draft.remove(line.itemId)}
        aria-label={`Remove ${line.itemName}`}
        className="-my-2 flex h-11 w-9 shrink-0 items-center justify-center rounded-wds-sm outline-none transition-colors duration-100 hover:bg-wds-neutral-100 focus-visible:shadow-wds-ring active:bg-wds-neutral-200"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M2 2L12 12M12 2L2 12" fill="none" stroke="var(--wds-text-faint)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

/** Step 4: only this department's items, searched locally (R8 returns them all), grouped by category. */
function AddItemList({ draft, addable, query, onQuery }: { draft: Draft; addable: AddableItem[]; query: string; onQuery: (q: string) => void }) {
  const term = query.trim().toLowerCase();
  const matches = React.useMemo(() => addable.filter((i) => !term || i.itemName.toLowerCase().includes(term)), [addable, term]);
  const groups = React.useMemo(() => groupByCategory(matches), [matches]);
  const lineFor = (itemId: string): DraftLine | undefined => draft.lines.find((l) => l.itemId === itemId);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
      <div className="border-b border-wds-border bg-wds-surface px-5 py-3">
        <label className="flex h-11 items-center gap-2.5 border border-wds-border-strong bg-wds-surface px-3 transition-shadow duration-150 focus-within:border-wds-selected-edge focus-within:shadow-wds-ring">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-wds-text-secondary">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="sr-only">{ADD_ITEM_COPY.placeholder}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={ADD_ITEM_COPY.placeholder}
            autoComplete="off"
            className="min-w-0 grow bg-transparent font-wds-sans text-[15px] leading-5 text-wds-text-ink outline-none placeholder:text-wds-text-secondary [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button type="button" onClick={() => onQuery('')} aria-label={ADD_ITEM_COPY.clear} className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-wds-sm outline-none focus-visible:shadow-wds-ring">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 2L12 12M12 2L2 12" fill="none" stroke="var(--wds-text-faint)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </label>
      </div>
      {matches.length === 0 ? (
        <p role="status" className="px-5 py-6 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">
          {ADD_ITEM_COPY.none}
        </p>
      ) : null}
      {groups.map((group) => (
        <section key={group.heading} aria-label={group.heading}>
          <CategoryHeading heading={group.heading} trailing={ADD_ITEM_COPY.found(group.lines.length)} />
          <ul>
            {/* Paper step 4 lists the items already on the list last in their group. */}
            {[...group.lines].sort((a, b) => Number(Boolean(lineFor(a.itemId)?.suggestedQty)) - Number(Boolean(lineFor(b.itemId)?.suggestedQty))).map((item) => {
              const line = lineFor(item.itemId);
              const onList = Boolean(line && line.suggestedQty !== null);
              const addedNow = Boolean(line && line.suggestedQty === null);
              return (
                <li
                  key={item.itemId}
                  className={cn(
                    'flex items-center border-b border-wds-border px-5',
                    addedNow ? 'gap-2.5 bg-wds-caramel-100 py-2.5 shadow-[inset_3px_0_0_0_var(--wds-caramel-500)]' : 'gap-3 bg-wds-surface py-3',
                  )}
                >
                  <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
                    <p className={cn('font-wds-sans text-[14px] font-medium leading-[18px]', onList ? 'text-wds-text-secondary' : 'text-wds-text-ink')}>{item.itemName}</p>
                    <p className={cn('font-wds-sans text-[13px] leading-4', addedNow ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>
                      {onList && line
                        ? ADD_ITEM_COPY.alreadyOnList(formatQty(line.qty), item.unit)
                        : addedNow
                          ? ADD_ITEM_COPY.addedToList(item.unit)
                          : ADD_ITEM_COPY.onHandLevel(item.onHand === undefined ? undefined : formatQty(item.onHand), item.level === undefined ? undefined : formatQty(item.level), item.unit)}
                    </p>
                  </div>
                  {onList ? (
                    <span className="flex w-[76px] shrink-0 items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 18 18" role="img" aria-label="Already on your list" className="text-wds-success-fg">
                        <path d="M3 9.5L7 13.5L15 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : addedNow && line ? (
                    <Stepper
                      itemName={item.itemName}
                      value={line.qty}
                      changed
                      onChange={(raw) => draft.setQty(item.itemId, raw)}
                      onCommit={() => draft.commitQty(item.itemId)}
                      onStep={(delta) => draft.step(item.itemId, delta)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => draft.add(item)}
                      aria-label={`Add ${item.itemName}`}
                      className="flex h-10 w-[76px] shrink-0 items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink outline-none transition-[background-color,transform] duration-100 focus-visible:shadow-wds-ring hover:bg-wds-neutral-50 active:bg-wds-neutral-100 motion-safe:active:scale-[0.98]"
                    >
                      {ADD_ITEM_COPY.add}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EditSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="back" onBack={onBack} title="Change lines" subtitle="Opening" />
      <LoadingAnnouncer text={SECTION_COPY.loading} />
      <div className="flex min-h-0 flex-1 flex-col bg-wds-canvas" aria-hidden="true">
        <div className="border-b border-wds-border bg-wds-surface px-5 py-4">
          <Skeleton className="h-4 w-[70%]" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 border-b border-wds-border bg-wds-surface py-2.5 pl-5 pr-3">
            <div className="flex grow flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-10 w-[116px]" />
          </div>
        ))}
      </div>
    </PhoneColumn>
  );
}
