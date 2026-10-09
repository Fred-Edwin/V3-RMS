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
import {
  ADDITION_COPY,
  headErrorMessage,
  headTracker,
  SECTION_COPY,
  SENT_COPY,
  statusBanner,
  URGENT_SWITCH,
  type Banner,
} from '../../_shared/lib/phone-words';
import type { RequisitionFile, RequisitionLine, SectionDetail } from '../../_shared/types/requisitions-contract';
import { useHeadFile } from '../../hooks/use-head-requisitions';
import { formatQty } from '../../lib/qty';
import { REQ_HOME, reqAddMore, reqEdit } from '../../lib/routes';
import { timeText } from '../../lib/time';
import { requisitionsApi } from '../../services/requisitions-phone-api';
import { groupByCategory } from '../../hooks/use-section-draft';
import { CategoryHeading, HeadFooter, HeadFooterHint, HeadPhoneHeader, HeadPrimaryButton, HeadRail, HeadSecondaryButton, RowLink, StatusBanner } from './head-phone-parts';
import { SendSheet } from './send-sheet';

const CYCLE_WORD = (cycleLabel: string): string => cycleLabel.split(' · ')[0] ?? cycleLabel;

/** What the head sees of one requisition: step 2 (suggested lines), 6 (sent), 10 (the manager changed a line), 14 (approved), and the closed, cancelled and skipped cases. */
export function HeadFileScreen({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const file = useHeadFile(requisitionId);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState<'recall' | 'urgent' | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [showLines, setShowLines] = React.useState(false);

  const data = file.data;
  const section = data?.sections[0] ?? null;

  const back = React.useCallback(() => router.push(REQ_HOME), [router]);

  const send = React.useCallback(
    async (pin: string, key: string): Promise<string | null> => {
      if (!data || !section) return SECTION_COPY.saveFailed;
      try {
        // The note travels with the draft (R12); the send itself is only the PIN (R13).
        if (note.trim()) {
          await requisitionsApi.saveLines(data.id, section.departmentId, {
            lines: section.lines.filter((l) => l.additionId === null).map((l) => ({ itemId: l.itemId, requestedQty: l.requestedQty })),
            noteForManager: note.trim(),
          });
        }
        await requisitionsApi.send(data.id, section.departmentId, pin, key);
        setSendOpen(false);
        await file.reload();
        return null;
      } catch (err) {
        return headErrorMessage(err);
      }
    },
    [data, section, note, file],
  );

  const recall = React.useCallback(async (): Promise<void> => {
    if (!data || !section || busy) return;
    setBusy('recall');
    setFailure(null);
    try {
      await requisitionsApi.recall(data.id, section.departmentId);
      await file.reload();
    } catch (err) {
      setFailure(headErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [data, section, busy, file]);

  const toggleUrgent = React.useCallback(async (): Promise<void> => {
    if (!data || busy) return;
    setBusy('urgent');
    setFailure(null);
    try {
      await requisitionsApi.setUrgent(data.id, { urgent: !data.urgent });
      await file.reload();
    } catch (err) {
      setFailure(headErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [data, busy, file]);

  if (file.status === 'error') {
    return (
      <PhoneColumn>
        <HeadPhoneHeader leading="back" onBack={back} title="Requisition" subtitle="" />
        <div className="flex flex-1 flex-col bg-wds-canvas px-5 py-8">
          <div role="alert">
            <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => void file.reload()} />
          </div>
        </div>
      </PhoneColumn>
    );
  }

  if (!data || !section) return <FileSkeleton onBack={back} />;

  const sentAtText = section.sentAt ? timeText(section.sentAt) : null;
  const cycleWord = CYCLE_WORD(data.cycleLabel);
  const title = `${section.departmentName} · ${cycleWord}`;
  const sectionOpen = section.status === 'NOT_STARTED' || section.status === 'DRAFT';
  const beforeApproval = data.status === 'OPEN' || data.status === 'PENDING_APPROVAL';
  const approved = data.status === 'APPROVED' || data.status === 'CLOSED';
  const changedByManager = section.lines.filter((l) => l.changedByManager);
  const additionPending = data.additions.some((a) => a.status === 'PENDING');

  const subtitle = approved && data.approvedAt
    ? `${data.reference} · approved ${timeText(data.approvedAt)}`
    : section.status === 'SUBMITTED' && sentAtText
      ? `${data.reference} · sent ${sentAtText}`
      : `${data.reference} · started ${timeText(data.openedAt)}`;

  let banner: Banner | null = null;
  if (!(sectionOpen && data.status === 'OPEN')) {
    banner = statusBanner({
      requisitionStatus: data.status,
      sectionStatus: section.status,
      sentAt: sentAtText,
      lineCount: section.lineCount,
      cancelReason: data.cancelled?.reason ?? null,
      changedByManagerLines: changedByManager.map((l) => ({ itemName: l.itemName, asked: formatQty(l.requestedQty), approved: formatQty(l.approvedQty ?? l.requestedQty), unit: l.unit, reason: l.changeReason })),
    });
    if (additionPending && data.status === 'APPROVED') banner = { tone: 'warning', title: ADDITION_COPY.pendingTitle, body: ADDITION_COPY.pendingBody };
  }

  const rail = headTracker({
    departmentName: section.departmentName,
    requisitionStatus: data.status,
    sectionStatus: section.status,
    sentAtText,
    tracker: data.tracker,
    approvedAtText: data.approvedAt ? timeText(data.approvedAt) : null,
    approvedByLabel: data.approvedBy?.roleLabel ?? null,
    sectionsIn: data.nextStep.facts.sectionsIn,
    sectionsTotal: data.nextStep.facts.sectionsTotal,
  });

  const heading = (
    <HeadPhoneHeader leading="back" onBack={back} title={title} subtitle={subtitle} mono>
      {data.urgent ? <span className="self-start border border-wds-error-border bg-wds-error-bg px-2 py-0.5 font-wds-sans text-[12px] font-medium leading-4 text-wds-error-fg">{SECTION_COPY.urgentTag}</span> : null}
    </HeadPhoneHeader>
  );

  // Step 2: the suggested list, ready to send as it is.
  if (sectionOpen && data.status === 'OPEN') {
    const groups = groupByCategory(section.lines);
    const changed = section.changedCount;
    return (
      <PhoneColumn>
        {heading}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-wds-canvas">
          <div className="flex items-center justify-between gap-3 border-b border-wds-border bg-wds-surface px-5 py-3.5">
            <p className="w-[230px] shrink-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">{section.lineCount > 0 ? SECTION_COPY.filledIn(section.lineCount) : SECTION_COPY.filledInNone}</p>
            <RowLink onClick={() => router.push(reqEdit(data.id))}>{SECTION_COPY.changeLines}</RowLink>
          </div>
          <UrgentRow on={data.urgent} busy={busy === 'urgent'} onToggle={() => void toggleUrgent()} disabled={!data.can.setUrgent} />
          {failure ? <PhoneErrorNote>{failure}</PhoneErrorNote> : null}
          {section.lineCount === 0 ? <p className="px-5 py-6 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{SECTION_COPY.noLines}</p> : null}
          {groups.map((group) => (
            <section key={group.heading} aria-label={group.heading}>
              <CategoryHeading heading={group.heading} trailing={SECTION_COPY.lines(group.lines.length)} />
              <ul>
                {group.lines.map((line) => (
                  <li key={line.id} className="flex items-center gap-3 border-b border-wds-border bg-wds-surface px-5 py-3">
                    <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
                      <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{line.itemName}</p>
                      <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{lineSub(line)}</p>
                    </div>
                    <p className="flex w-[92px] shrink-0 items-baseline justify-end gap-[5px]">
                      <span className="w-8 shrink-0 text-right font-wds-mono text-[16px] leading-5 text-wds-text-ink">{formatQty(line.requestedQty)}</span>
                      <span className="w-12 shrink-0 truncate font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{line.unit}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <HeadFooter summary={changed === 0 ? SECTION_COPY.footerNothingChanged(section.lineCount) : `${SECTION_COPY.lines(section.lineCount)} · ${changed} changed`} aside={SECTION_COPY.toTheManager}>
          <HeadPrimaryButton onClick={() => setSendOpen(true)} disabled={section.lineCount === 0}>
            {SECTION_COPY.sendAsSuggested}
          </HeadPrimaryButton>
        </HeadFooter>
        <SendSheet
          open={sendOpen}
          onOpenChange={setSendOpen}
          departmentName={section.departmentName}
          reference={data.reference}
          cycleLabel={cycleWord}
          branchName={data.branch.name}
          lines={section.lines.map((l) => ({ itemId: l.itemId, itemName: l.itemName, unit: l.unit, qty: l.requestedQty, categoryPath: l.categoryPath }))}
          changes={changed}
          note={note}
          onNote={setNote}
          onSend={send}
        />
      </PhoneColumn>
    );
  }

  // Steps 6, 10, 14 and the closed, cancelled and skipped cases.
  const canRecall = section.can.recall && beforeApproval;
  const cancelled = data.status === 'CANCELLED';
  return (
    <PhoneColumn>
      {heading}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-wds-canvas px-5 py-5">
        {banner ? <StatusBanner banner={banner} /> : null}
        {failure ? <PhoneErrorNote>{failure}</PhoneErrorNote> : null}
        {changedByManager.length > 0 && beforeApproval ? <ChangedCards lines={changedByManager} /> : null}
        {beforeApproval ? <UrgentRow on={data.urgent} busy={busy === 'urgent'} onToggle={() => void toggleUrgent()} disabled={!data.can.setUrgent} inline /> : null}
        {!cancelled ? <HeadRail steps={rail} currentTone={approved ? 'info' : 'warning'} /> : null}
        <LinesCard section={section} file={data} expanded={showLines} onToggle={() => setShowLines((v) => !v)} />
        {data.additions.map((addition) => (
          <AdditionBlock key={addition.id} lines={addition.lines} pending={addition.status === 'PENDING'} />
        ))}
      </div>
      {canRecall ? (
        <HeadFooter>
          <HeadSecondaryButton onClick={() => void recall()} disabled={busy === 'recall'} aria-busy={busy === 'recall'}>
            {busy === 'recall' ? SENT_COPY.recalling : SENT_COPY.recall}
          </HeadSecondaryButton>
          <HeadFooterHint>{beforeApproval && data.status === 'PENDING_APPROVAL' ? SENT_COPY.recallHint : SENT_COPY.recallHintShort}</HeadFooterHint>
        </HeadFooter>
      ) : data.can.addToIt && !additionPending ? (
        <HeadFooter>
          <HeadSecondaryButton onClick={() => router.push(reqAddMore(data.id))}>{ADDITION_COPY.button}</HeadSecondaryButton>
          <HeadFooterHint>{ADDITION_COPY.hint}</HeadFooterHint>
        </HeadFooter>
      ) : cancelled ? (
        <HeadFooter>
          <HeadPrimaryButton onClick={back}>Start a new one</HeadPrimaryButton>
        </HeadFooter>
      ) : null}
    </PhoneColumn>
  );
}

function lineSub(line: RequisitionLine): string {
  return line.onHand !== undefined && line.level !== undefined ? SECTION_COPY.onHandLevel(formatQty(line.onHand), formatQty(line.level), true) : line.unit;
}

/**
 * The after-start Urgent switch. Paper draws Urgent only at start (step 18); the contract lets a head set or clear it on their own
 * section before approval (R15), so this row is designed in the same style and reported to the owner.
 */
function UrgentRow({ on, busy, onToggle, disabled, inline = false }: { on: boolean; busy: boolean; onToggle: () => void; disabled: boolean; inline?: boolean }) {
  if (disabled && !on) return null;
  return (
    <div className={cn('flex items-center justify-between gap-4 border-b border-wds-border px-5 py-3', inline ? 'border border-wds-border bg-wds-surface' : 'bg-wds-surface', on && 'bg-wds-error-bg')}>
      <p id="req-urgent-row" className={cn('font-wds-sans text-[14px] font-medium leading-[18px]', on ? 'text-wds-error-fg' : 'text-wds-text-ink')}>
        {URGENT_SWITCH.title}
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="req-urgent-row"
        disabled={disabled || busy}
        onClick={onToggle}
        className={cn('relative -my-1 h-7 w-12 shrink-0 rounded-full p-1 outline-none before:absolute before:-inset-y-2 before:inset-x-0 before:content-[""] transition-[background-color,filter] duration-150 hover:brightness-95 focus-visible:shadow-wds-ring active:brightness-90 disabled:opacity-60', on ? 'bg-wds-error-fg' : 'bg-wds-border-strong')}
      >
        <span aria-hidden="true" className={cn('block size-5 rounded-full bg-wds-surface transition-transform duration-150 motion-reduce:transition-none', on ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </div>
  );
}

/** Step 10: each line the Branch Manager changed, with what the head asked and what was approved. */
function ChangedCards({ lines }: { lines: RequisitionLine[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {lines.map((l) => (
        <li key={l.id} className="flex items-center gap-3 border border-wds-warning-border bg-wds-caramel-100 py-3.5 pl-[19px] pr-4 shadow-[inset_3px_0_0_0_var(--wds-caramel-500)]">
          <div className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
            <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{l.itemName}</p>
            <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
              You asked for {formatQty(l.requestedQty)} {l.unit}
            </p>
          </div>
          <p className="flex shrink-0 items-baseline gap-[5px]">
            <span className="font-wds-mono text-[18px] font-semibold leading-[22px] text-wds-text-ink">{formatQty(l.approvedQty ?? l.requestedQty)}</span>
            <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{l.unit} approved</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** "12 lines · 4 changed from the suggestion" with See lines, which opens the lines read-only. */
function LinesCard({ section, file, expanded, onToggle }: { section: SectionDetail; file: RequisitionFile; expanded: boolean; onToggle: () => void }) {
  const lines = section.lines.filter((l) => l.additionId === null);
  const byManager = lines.filter((l) => l.changedByManager).length;
  const second = byManager > 0 ? SENT_COPY.changedByManager(byManager) : section.changedCount > 0 ? SENT_COPY.changedFromSuggestion(section.changedCount) : null;
  const approved = file.status === 'APPROVED' || file.status === 'CLOSED';
  const groups = groupByCategory(lines);
  return (
    <section className="flex flex-col border border-wds-border bg-wds-surface" aria-label="Your lines">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex flex-col gap-0.5">
          <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{SECTION_COPY.lines(lines.length)}</p>
          {second ? <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{second}</p> : null}
        </div>
        <RowLink onClick={onToggle}>{expanded ? 'Hide lines' : SENT_COPY.seeLines}</RowLink>
      </div>
      {expanded ? (
        <div className="border-t border-wds-border">
          {groups.map((group) => (
            <div key={group.heading}>
              <CategoryHeading heading={group.heading} trailing={SECTION_COPY.lines(group.lines.length)} />
              <ul>
                {group.lines.map((l) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-3 border-b border-wds-border px-4 py-2.5 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">
                    <span>{l.itemName}</span>
                    <span className="font-wds-mono text-[13px]">
                      {formatQty(approved && l.approvedQty ? l.approvedQty : l.requestedQty)} {l.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** The "Added after approval" block (Paper step 15, as it reads on the file after the head has sent it). */
function AdditionBlock({ lines, pending }: { lines: RequisitionLine[]; pending: boolean }) {
  return (
    <section aria-label={ADDITION_COPY.addedBlock} className="flex flex-col border border-wds-warning-border bg-wds-warning-bg">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-warning-fg">{ADDITION_COPY.addedBlock}</h2>
        <p className="font-wds-sans text-[13px] leading-4 text-wds-warning-fg">{pending ? ADDITION_COPY.waitingForApproval : 'Approved'}</p>
      </div>
      <ul className="border-t border-wds-warning-border">
        {lines.map((l) => (
          <li key={l.id} className="flex items-baseline justify-between gap-3 border-b border-wds-warning-border px-4 py-2.5 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink last:border-b-0">
            <span>{l.itemName}</span>
            <span className="font-wds-mono text-[13px]">
              {formatQty(l.requestedQty)} {l.unit}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FileSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="back" onBack={onBack} title="Requisition" subtitle="Opening" />
      <LoadingAnnouncer text={SECTION_COPY.loading} />
      <div className="flex min-h-0 flex-1 flex-col bg-wds-canvas" aria-hidden="true">
        <div className="border-b border-wds-border bg-wds-surface px-5 py-4">
          <Skeleton className="h-4 w-[70%]" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-wds-border bg-wds-surface px-5 py-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-14" />
          </div>
        ))}
      </div>
    </PhoneColumn>
  );
}
