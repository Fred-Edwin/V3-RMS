'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { useLoader } from '../../../_shared/hooks/use-async';
import { REQUISITIONS_KIT_COPY } from '../../_shared/lib/states-copy';
import { ADD_ITEM_COPY, ADDITION_COPY, headErrorMessage, SECTION_COPY } from '../../_shared/lib/phone-words';
import type { AddableItem, SectionEdit } from '../../_shared/types/requisitions-contract';
import { groupByCategory } from '../../hooks/use-section-draft';
import { useHeadFile } from '../../hooks/use-head-requisitions';
import { useRestoreFocus } from '../../hooks/use-restore-focus';
import { cleanTyped, formatQty, isValidQty, stepQty, toNumber } from '../../lib/qty';
import { reqAddMore, reqFile } from '../../lib/routes';
import { timeText } from '../../lib/time';
import { requisitionsApi } from '../../services/requisitions-phone-api';
import { CategoryHeading, HeadFooter, HeadPhoneHeader, HeadPrimaryButton, RowLink, Stepper } from './head-phone-parts';

interface AddedLine {
  item: AddableItem;
  qty: string;
}

/** Add to an approved requisition (Paper step 15): the approved lines stay as they are, the new ones wait for the Branch Manager. */
export function HeadAdditionScreen({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const picking = useSearchParams().get('pick') === '1';
  const file = useHeadFile(requisitionId);
  const data = file.data;
  const section = data?.sections[0] ?? null;
  const departmentId = section?.departmentId ?? null;
  const edit = useLoader<SectionEdit>(departmentId ? `req-add:${requisitionId}:${departmentId}` : null, () => requisitionsApi.sectionEdit(requisitionId, departmentId ?? ''), 'Could not open your list.');
  const idem = useIdempotencyKey();

  const [sendOpen, setSendOpen] = React.useState(false);
  useRestoreFocus(sendOpen);
  const [added, setAdded] = React.useState<AddedLine[]>([]);
  const [query, setQuery] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const back = React.useCallback(() => router.push(reqFile(requisitionId)), [router, requisitionId]);

  // Only an approved requisition whose department can still add; anything else goes back to the file.
  React.useEffect(() => {
    if (data && !data.can.addToIt) router.replace(reqFile(requisitionId));
  }, [data, router, requisitionId]);

  const sectionData = edit.data;
  const approvedLines = sectionData?.section.lines.filter((l) => l.additionId === null) ?? [];

  const setQty = React.useCallback((itemId: string, raw: string) => setAdded((prev) => prev.map((a) => (a.item.itemId === itemId ? { ...a, qty: cleanTyped(raw) } : a))), []);
  const commitQty = React.useCallback((itemId: string) => setAdded((prev) => prev.map((a) => (a.item.itemId === itemId && !isValidQty(a.qty) ? { ...a, qty: '1' } : a))), []);
  const step = React.useCallback((itemId: string, delta: 1 | -1) => setAdded((prev) => prev.map((a) => (a.item.itemId === itemId ? { ...a, qty: stepQty(a.qty, delta) } : a))), []);
  const remove = React.useCallback((itemId: string) => setAdded((prev) => prev.filter((a) => a.item.itemId !== itemId)), []);
  const add = React.useCallback(
    (item: AddableItem) => setAdded((prev) => (prev.some((a) => a.item.itemId === item.itemId) ? prev : [...prev, { item, qty: toNumber(item.suggestedQty) > 0 ? item.suggestedQty : '1' }])),
    [],
  );

  const send = React.useCallback(
    async (pin: string): Promise<void> => {
      setSubmitting(true);
      setError(undefined);
      try {
        await requisitionsApi.addAddition(requisitionId, { lines: added.map((a) => ({ itemId: a.item.itemId, requestedQty: a.qty })), pin }, idem.key());
        router.replace(reqFile(requisitionId));
      } catch (err) {
        setError(headErrorMessage(err));
        setSubmitting(false);
      }
    },
    [requisitionId, added, idem, router],
  );

  if (file.status === 'error' || edit.status === 'error') {
    return (
      <PhoneColumn>
        <HeadPhoneHeader leading="back" onBack={back} title="Add to this requisition" subtitle="" />
        <div className="flex flex-1 flex-col bg-wds-canvas px-5 py-8">
          <div role="alert">
            <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => { void file.reload(); void edit.reload(); }} />
          </div>
        </div>
      </PhoneColumn>
    );
  }
  if (!data || !section || !sectionData) {
    return (
      <PhoneColumn>
        <HeadPhoneHeader leading="back" onBack={back} title="Add to this requisition" subtitle="Opening" />
        <LoadingAnnouncer text={SECTION_COPY.loading} />
        <div className="flex flex-1 flex-col gap-px bg-wds-canvas" aria-hidden="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </PhoneColumn>
    );
  }

  const subtitle = `${data.reference} · approved ${data.approvedAt ? timeText(data.approvedAt) : ''}`;
  const header = <HeadPhoneHeader leading="back" onBack={picking ? () => router.push(reqAddMore(requisitionId)) : back} title={picking ? 'Add an item' : ADDITION_COPY.headerTitle(section.departmentName)} subtitle={picking ? ADD_ITEM_COPY.subtitle(section.departmentName) : subtitle} mono={!picking} />;

  if (picking) {
    const term = query.trim().toLowerCase();
    const matches = sectionData.addable.filter((i) => !term || i.itemName.toLowerCase().includes(term));
    const groups = groupByCategory(matches);
    return (
      <PhoneColumn>
        {header}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
          <div className="border-b border-wds-border bg-wds-surface px-5 py-3">
            <label className="flex h-11 items-center gap-2.5 border border-wds-border-strong bg-wds-surface px-3 focus-within:border-wds-selected-edge focus-within:shadow-wds-ring">
              <span className="sr-only">{ADD_ITEM_COPY.placeholder}</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ADD_ITEM_COPY.placeholder} autoComplete="off" className="min-w-0 grow bg-transparent font-wds-sans text-[16px] leading-5 text-wds-text-ink outline-none placeholder:text-wds-text-secondary" />
            </label>
          </div>
          {matches.length === 0 ? <p role="status" className="px-5 py-6 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{ADD_ITEM_COPY.none}</p> : null}
          {groups.map((group) => (
            <section key={group.heading} aria-label={group.heading}>
              <CategoryHeading heading={group.heading} trailing={ADD_ITEM_COPY.found(group.lines.length)} />
              <ul>
                {group.lines.map((item) => {
                  const on = added.some((a) => a.item.itemId === item.itemId);
                  return (
                    <li key={item.itemId} className={cn('flex items-center gap-2.5 border-b border-wds-border py-2.5 pl-5 pr-4', on ? 'bg-wds-caramel-100 shadow-[inset_3px_0_0_0_var(--wds-caramel-500)]' : 'bg-wds-surface')}>
                      <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
                        <p className="font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink">{item.itemName}</p>
                        <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{item.inSection ? ADDITION_COPY.moreOf(formatQty(approvedLines.find((l) => l.itemId === item.itemId)?.requestedQty ?? '0')) : ADDITION_COPY.newItem(item.onHand === undefined ? undefined : formatQty(item.onHand), item.unit)}</p>
                      </div>
                      {on ? (
                        <button type="button" onClick={() => remove(item.itemId)} className="flex h-10 min-w-[76px] shrink-0 items-center justify-center border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[16px] leading-5 text-wds-text-ink outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring active:bg-wds-neutral-100">
                          Remove
                        </button>
                      ) : (
                        <button type="button" onClick={() => add(item)} aria-label={`Add ${item.itemName}`} className="flex h-10 min-w-[76px] shrink-0 items-center justify-center border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[16px] font-medium leading-5 text-wds-text-ink outline-none hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring active:bg-wds-neutral-100">
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
        <HeadFooter summary={`${ADDITION_COPY.linesAdded(added.length)}`}>
          <HeadPrimaryButton onClick={() => router.push(reqAddMore(requisitionId))}>{ADD_ITEM_COPY.back}</HeadPrimaryButton>
        </HeadFooter>
      </PhoneColumn>
    );
  }

  const valid = added.length > 0 && added.every((a) => isValidQty(a.qty));
  return (
    <PhoneColumn>
      {header}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
        <div className="flex items-center justify-between gap-3 border-b border-wds-border bg-wds-neutral-50 px-5 py-3">
          <p className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">{ADDITION_COPY.approvedBlock(approvedLines.length)}</p>
          <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{ADDITION_COPY.staysApproved}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-wds-warning-border bg-wds-caramel-100 px-5 py-3">
          <p className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-warning-fg">{ADDITION_COPY.addedBlock}</p>
          <div className="flex items-center gap-3">
            <p className="font-wds-sans text-[13px] leading-4 text-wds-warning-fg">{SECTION_COPY.lines(added.length)}</p>
            <RowLink onClick={() => router.push(`${reqAddMore(requisitionId)}?pick=1`)}>{SECTION_COPY.addAnItem}</RowLink>
          </div>
        </div>
        {added.length === 0 ? <p className="px-5 py-6 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Add the items you still need. They wait for the Branch Manager before they go to the store.</p> : null}
        <ul>
          {added.map((a) => (
            <li key={a.item.itemId} className="flex items-center gap-2.5 border-b border-wds-warning-border bg-wds-caramel-100 py-2.5 pl-5 pr-3">
              <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
                <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{a.item.itemName}</p>
                <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{a.item.inSection ? ADDITION_COPY.moreOf(formatQty(approvedLines.find((l) => l.itemId === a.item.itemId)?.requestedQty ?? '0')) : ADDITION_COPY.newItem(a.item.onHand === undefined ? undefined : formatQty(a.item.onHand), a.item.unit)}</p>
              </div>
              <Stepper itemName={a.item.itemName} value={a.qty} changed onChange={(raw) => setQty(a.item.itemId, raw)} onCommit={() => commitQty(a.item.itemId)} onStep={(d) => step(a.item.itemId, d)} />
              <button type="button" onClick={() => remove(a.item.itemId)} aria-label={`Remove ${a.item.itemName}`} className="-my-2 flex h-11 w-9 shrink-0 items-center justify-center rounded-wds-sm outline-none transition-colors duration-100 hover:bg-wds-neutral-100 focus-visible:shadow-wds-ring active:bg-wds-neutral-200">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2L12 12M12 2L2 12" fill="none" stroke="var(--wds-text-faint)" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <HeadFooter summary={ADDITION_COPY.linesAdded(added.length)}>
        <HeadPrimaryButton onClick={() => { setError(undefined); setSendOpen(true); }} disabled={!valid}>
          {SECTION_COPY.reviewAndSend}
        </HeadPrimaryButton>
      </HeadFooter>
      <SignSheetDialog
        layout="sheet"
        open={sendOpen}
        onOpenChange={setSendOpen}
        title={ADDITION_COPY.sheetTitle(added.length)}
        subtitle={ADDITION_COPY.sheetBody}
        helperText=""
        pinLabel={ADDITION_COPY.pinLabel}
        confirmLabel={ADDITION_COPY.confirm}
        onSubmit={(pin) => void send(pin)}
        submitting={submitting}
        error={error}
      >
        <section aria-label={ADDITION_COPY.linesAdded(added.length)} className="flex flex-col border border-wds-border-strong">
          <div className="flex items-end justify-between gap-3 border-b border-wds-text-ink px-3.5 py-3">
            <p className="font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.02em] text-wds-text-ink">{ADDITION_COPY.linesAdded(added.length)}</p>
            <p className="font-wds-sans text-[13px] leading-4 text-wds-warning-fg">{ADDITION_COPY.waitingForApproval}</p>
          </div>
          <ul>
            {added.map((a) => (
              <li key={a.item.itemId} className="flex justify-between gap-3 border-b border-wds-border px-3.5 py-2.5 last:border-b-0">
                <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{a.item.itemName}</span>
                <span className="font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{a.item.inSection ? '+' : ''}{formatQty(a.qty)} {a.item.unit}</span>
              </li>
            ))}
          </ul>
        </section>
      </SignSheetDialog>
    </PhoneColumn>
  );
}
