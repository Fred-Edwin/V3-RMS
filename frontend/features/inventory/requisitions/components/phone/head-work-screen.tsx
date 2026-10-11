'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { PhoneErrorNote } from '../../../_shared/components/phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { REQUISITIONS_KIT_COPY } from '../../_shared/lib/states-copy';
import { ADD_ITEM_COPY, changeSummary, headErrorMessage, SECTION_COPY, WORK_COPY } from '../../_shared/lib/phone-words';
import type { AddableItem, RequisitionCycle } from '../../_shared/types/requisitions-contract';
import { groupByCategory, isChanged, useSectionDraft, type DraftLine } from '../../hooks/use-section-draft';
import { formatQty } from '../../lib/qty';
import { reqHomeFor } from '../../lib/routes';
import { requisitionsApi } from '../../services/requisitions-phone-api';
import { CategoryHeading, CycleSwitcher, HeadFooter, HeadPhoneHeader, HeadPrimaryButton, RowLink, SearchField, Stepper, UrgentRow } from './head-phone-parts';
import { SendSheet } from './send-sheet';

const OBVIOUS_UNITS = new Set(['pcs', 'portion', 'portions']);
const changedFromText = (line: DraftLine): string =>
  SECTION_COPY.changedFrom(formatQty(line.suggestedQty ?? ''), OBVIOUS_UNITS.has(line.unit) ? null : line.unit);

export interface HeadWorkScreenProps {
  requisitionId: string;
  departmentId: string;
  departmentName: string;
  reference: string;
  cycle: RequisitionCycle;
  cycleWord: string;
  branchName: string;
  urgent: { on: boolean; busy: boolean; onToggle: () => void; disabled: boolean };
  /** Called after the list is signed and sent, so the file reloads into its sent view. */
  onSent: () => Promise<void> | void;
}

type Draft = ReturnType<typeof useSectionDraft>;

/**
 * The head's one working screen (owner decision, 11 Oct 2026, replacing Paper steps 1 to 4): the cycle switcher on top, then the
 * list already filled in from the restock levels, a search box, and every other item of the department below it. Quantities are
 * steppers (typing allowed), changes autosave, and one sticky button signs and sends. There is no Start, Change lines or Add an
 * item screen to pass through.
 */
export function HeadWorkScreen({ requisitionId, departmentId, departmentName, reference, cycle, cycleWord, branchName, urgent, onSent }: HeadWorkScreenProps) {
  const router = useRouter();
  const draft = useSectionDraft(requisitionId, departmentId);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [showOthers, setShowOthers] = React.useState(false);
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
      if (!ok) {
        setFlushFailed(draft.saveError ?? SECTION_COPY.saveFailed);
        return;
      }
      router.push(to);
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
        setSendOpen(false);
        await onSent();
        return null;
      } catch (err) {
        return headErrorMessage(err);
      }
    },
    [draft, requisitionId, departmentId, onSent],
  );

  const term = query.trim().toLowerCase();
  const matches = React.useCallback((name: string): boolean => !term || name.toLowerCase().includes(term), [term]);
  const listLines = React.useMemo(() => draft.lines.filter((l) => matches(l.itemName)), [draft.lines, matches]);
  const onList = React.useMemo(() => new Set(draft.lines.map((l) => l.itemId)), [draft.lines]);
  const others = React.useMemo(() => (draft.data?.addable ?? []).filter((i) => !onList.has(i.itemId)), [draft.data, onList]);
  const otherMatches = React.useMemo(() => others.filter((i) => matches(i.itemName)), [others, matches]);

  if (draft.edit.status === 'error') {
    return (
      <PhoneColumn>
        <HeadPhoneHeader leading="menu" title={`${departmentName} · ${cycleWord}`} subtitle={reference} mono />
        <div className="flex flex-1 flex-col bg-wds-canvas px-5 py-8">
          <div role="alert">
            <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => void draft.edit.reload()} />
          </div>
        </div>
      </PhoneColumn>
    );
  }
  if (!draft.ready) return <WorkSkeleton />;

  const saveText = draft.saveState === 'saving' ? SECTION_COPY.saving : draft.saveState === 'saved' ? SECTION_COPY.saved : null;
  const failure = flushFailed ?? (draft.saveState === 'error' ? draft.saveError : null);
  const groups = groupByCategory(listLines);
  const emptyList = draft.lines.length === 0;
  // The other items open by themselves when the list is empty or a search is running.
  const othersOpen = showOthers || Boolean(term) || emptyList;
  const otherGroups = groupByCategory(otherMatches);

  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="menu" title={`${departmentName} · ${cycleWord}`} subtitle={reference} mono />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
          <div className="flex flex-col gap-2 border-b border-wds-border bg-wds-surface px-5 py-3">
            <p id="req-switch" className="sr-only">
              {WORK_COPY.switchTo}
            </p>
            <CycleSwitcher compact value={cycle} labelledBy="req-switch" open={{ [cycle]: true }} onChange={(c) => void leave(reqHomeFor(c))} />
          </div>
          <UrgentRow on={urgent.on} busy={urgent.busy} onToggle={urgent.onToggle} disabled={urgent.disabled} />
          <div className="sticky top-0 z-10 border-b border-wds-border bg-wds-surface px-5 py-3">
            <SearchField value={query} onChange={setQuery} placeholder={WORK_COPY.searchPlaceholder(departmentName)} clearLabel={ADD_ITEM_COPY.clear} />
          </div>
          {failure ? <PhoneErrorNote>{failure}</PhoneErrorNote> : null}

          {emptyList ? (
            <p className="border-b border-wds-border bg-wds-surface px-5 py-4 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{WORK_COPY.nothingBelowLevel(departmentName)}</p>
          ) : (
            <p className="border-b border-wds-border bg-wds-surface px-5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{WORK_COPY.suggestedIntro}</p>
          )}

          {groups.map((group) => (
            <section key={group.heading} aria-label={group.heading}>
              <CategoryHeading heading={group.heading} trailing={SECTION_COPY.lines(group.lines.length)} />
              <ul>
                {group.lines.map((line) => (
                  <WorkRow key={line.itemId} line={line} draft={draft} />
                ))}
              </ul>
            </section>
          ))}

          {term && listLines.length === 0 && otherMatches.length === 0 ? (
            <p role="status" className="px-5 py-6 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">
              {WORK_COPY.noMatch}
            </p>
          ) : null}

          {others.length > 0 ? (
            <div className="flex items-center justify-between gap-3 border-b border-wds-border bg-wds-surface px-5 py-3">
              <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{WORK_COPY.otherItems(others.length)}</p>
              {!term && !emptyList ? (
                <RowLink onClick={() => setShowOthers((v) => !v)}>{showOthers ? WORK_COPY.hideOthers : WORK_COPY.showOthers}</RowLink>
              ) : null}
            </div>
          ) : null}
          {othersOpen
            ? otherGroups.map((group) => (
                <section key={`o-${group.heading}`} aria-label={group.heading}>
                  <CategoryHeading heading={group.heading} trailing={ADD_ITEM_COPY.found(group.lines.length)} />
                  <ul>
                    {group.lines.map((item) => (
                      <OtherRow key={item.itemId} item={item} draft={draft} />
                    ))}
                  </ul>
                </section>
              ))
            : null}
          {/* Room so the undo toast never covers the last row. */}
          <div className="h-16 shrink-0" aria-hidden="true" />
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
      <HeadFooter summary={changeSummary(draft.counts.lineCount, draft.counts.changed, draft.counts.removed)} aside={failure ?? saveText ?? SECTION_COPY.toTheManager}>
        <HeadPrimaryButton onClick={() => void openSend()} disabled={draft.lines.length === 0 || draft.anyInvalid}>
          {WORK_COPY.sendItems(draft.lines.length)}
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

/** One line of the head's list: name, the stock facts, the stepper and a remove button. */
function WorkRow({ line, draft }: { line: DraftLine; draft: Draft }) {
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

/** An item of the department that is not on the list yet: its stock facts and one Add button. */
function OtherRow({ item, draft }: { item: AddableItem; draft: Draft }) {
  return (
    <li className="flex items-center gap-3 border-b border-wds-border bg-wds-surface px-5 py-3">
      <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
        <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{item.itemName}</p>
        <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
          {ADD_ITEM_COPY.onHandLevel(item.onHand === undefined ? undefined : formatQty(item.onHand), item.level === undefined ? undefined : formatQty(item.level), item.unit)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => draft.add(item)}
        aria-label={`Add ${item.itemName}`}
        className="flex h-10 w-[76px] shrink-0 items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink outline-none transition-[background-color,transform] duration-100 focus-visible:shadow-wds-ring hover:bg-wds-neutral-50 active:bg-wds-neutral-100 motion-safe:active:scale-[0.98]"
      >
        {ADD_ITEM_COPY.add}
      </button>
    </li>
  );
}

export function WorkSkeleton() {
  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="menu" title="Requisition" subtitle={WORK_COPY.starting} />
      <LoadingAnnouncer text={WORK_COPY.starting} />
      <div className="flex min-h-0 flex-1 flex-col bg-wds-canvas" aria-hidden="true">
        <div className="border-b border-wds-border bg-wds-surface px-5 py-4">
          <Skeleton className="h-10 w-full" />
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
