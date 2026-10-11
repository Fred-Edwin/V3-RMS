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
import { ADDITION_COPY, headErrorMessage, headTracker, SECTION_COPY, SENT_COPY, statusBanner, type Banner } from '../../_shared/lib/phone-words';
import type { RequisitionFile, RequisitionLine, SectionDetail } from '../../_shared/types/requisitions-contract';
import { useHeadFile } from '../../hooks/use-head-requisitions';
import { formatQty } from '../../lib/qty';
import { REQ_HOME, reqAddMore } from '../../lib/routes';
import { timeText } from '../../lib/time';
import { requisitionsApi } from '../../services/requisitions-phone-api';
import { groupByCategory } from '../../hooks/use-section-draft';
import { CategoryHeading, HeadFooter, HeadFooterHint, HeadPhoneHeader, HeadPrimaryButton, HeadRail, HeadSecondaryButton, StatusBanner, UrgentAsk } from './head-phone-parts';
import { HeadWorkScreen } from './head-work-screen';

const CYCLE_WORD = (cycleLabel: string): string => cycleLabel.split(' · ')[0] ?? cycleLabel;

/**
 * What the head sees of one requisition. While the list is being filled in it is the working screen (list, search, send). Once
 * sent it is the status view: the banner, then the items with their quantities, then where it is (sent, approved with the
 * changes the Branch Manager made, closed, cancelled, skipped).
 */
export function HeadFileScreen({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const file = useHeadFile(requisitionId);
  const [busy, setBusy] = React.useState<'recall' | 'urgent' | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  const data = file.data;
  const section = data?.sections[0] ?? null;

  const back = React.useCallback(() => router.push(REQ_HOME), [router]);
  const reloadFile = React.useCallback(async (): Promise<void> => {
    await file.reload();
  }, [file]);

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
        <HeadPhoneHeader leading="menu" title="Requisition" subtitle="" />
        <div className="flex flex-1 flex-col bg-wds-canvas px-5 py-8">
          <div role="alert">
            <MobileErrorState title={REQUISITIONS_KIT_COPY.couldNotLoad.title} description={REQUISITIONS_KIT_COPY.couldNotLoad.line} onRetry={() => void file.reload()} />
          </div>
        </div>
      </PhoneColumn>
    );
  }

  if (!data || !section) return <FileSkeleton />;

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

  // The list is still being filled in: the one working screen (the list, the search, the other items and the send button).
  if (sectionOpen && data.status === 'OPEN') {
    return (
      <HeadWorkScreen
        requisitionId={data.id}
        departmentId={section.departmentId}
        departmentName={section.departmentName}
        reference={data.reference}
        startedAt={data.openedAt}
        cycle={data.cycle}
        cycleWord={cycleWord}
        branchName={data.branch.name}
        urgent={{ on: data.urgent, busy: busy === 'urgent', onToggle: () => void toggleUrgent(), disabled: !data.can.setUrgent }}
        onSent={reloadFile}
      />
    );
  }

  let banner: Banner | null = statusBanner({
    requisitionStatus: data.status,
    sectionStatus: section.status,
    sentAt: sentAtText,
    lineCount: section.lineCount,
    cancelReason: data.cancelled?.reason ?? null,
    changedByManagerLines: changedByManager.map((l) => ({ itemName: l.itemName, asked: formatQty(l.requestedQty), approved: formatQty(l.approvedQty ?? l.requestedQty), unit: l.unit, reason: l.changeReason })),
  });
  if (additionPending && data.status === 'APPROVED') banner = { tone: 'warning', title: ADDITION_COPY.pendingTitle, body: ADDITION_COPY.pendingBody };

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

  const canRecall = section.can.recall && beforeApproval;
  const cancelled = data.status === 'CANCELLED';
  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="back" onBack={back} title={title} subtitle={subtitle} mono>
        {data.urgent ? <span className="self-start border border-wds-error-border bg-wds-error-bg px-2 py-0.5 font-wds-sans text-[12px] font-medium leading-4 text-wds-error-fg">{SECTION_COPY.urgentTag}</span> : null}
      </HeadPhoneHeader>
      <div key={data.status} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-wds-canvas px-5 py-5">
        {banner ? <StatusBanner banner={banner} /> : null}
        {failure ? <PhoneErrorNote>{failure}</PhoneErrorNote> : null}
        <ItemsCard section={section} file={data} />
        {data.additions.map((addition) => (
          <AdditionBlock key={addition.id} lines={addition.lines} pending={addition.status === 'PENDING'} />
        ))}
        {beforeApproval ? <UrgentAsk on={data.urgent} busy={busy === 'urgent'} onToggle={() => void toggleUrgent()} disabled={!data.can.setUrgent} inline /> : null}
        {!cancelled ? <HeadRail steps={rail} currentTone={approved ? 'info' : 'warning'} /> : null}
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

/**
 * What the head asked for, always open (no "See lines" tap): every line with its quantity, grouped by category. When the Branch
 * Manager changed a line it reads "14 kg" in bold with "You asked for 20 kg" under it. After approval every line shows what was
 * approved.
 */
function ItemsCard({ section, file }: { section: SectionDetail; file: RequisitionFile }) {
  const lines = section.lines.filter((l) => l.additionId === null);
  const byManager = lines.filter((l) => l.changedByManager).length;
  const second = byManager > 0 ? SENT_COPY.changedByManager(byManager) : section.changedCount > 0 ? SENT_COPY.changedFromSuggestion(section.changedCount) : null;
  const groups = groupByCategory(lines);
  return (
    <section className="flex flex-col border border-wds-border bg-wds-surface" aria-label="Your items">
      <div className="flex flex-col gap-0.5 px-4 py-3.5">
        <h2 className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{file.status === 'CANCELLED' ? 'What you asked for' : `Your items · ${SECTION_COPY.lines(lines.length)}`}</h2>
        {second ? <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{second}</p> : null}
      </div>
      <div className="border-t border-wds-border">
        {groups.map((group) => (
          <div key={group.heading}>
            <CategoryHeading heading={group.heading} trailing={SECTION_COPY.lines(group.lines.length)} />
            <ul>
              {group.lines.map((l) => {
                const asked = formatQty(l.requestedQty);
                const final = l.approvedQty !== null ? formatQty(l.approvedQty) : null;
                const edited = l.changedByManager && final !== null && final !== asked;
                return (
                  <li
                    key={l.id}
                    className={cn(
                      'flex items-center justify-between gap-3 border-b border-wds-border px-4 py-2.5 last:border-b-0',
                      edited && 'bg-wds-caramel-100 shadow-[inset_3px_0_0_0_var(--wds-caramel-500)]',
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-[2px]">
                      <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{l.itemName}</span>
                      {edited ? (
                        <span className="font-wds-sans text-[13px] leading-4 text-wds-warning-fg">
                          You asked for {asked} {l.unit}
                          {l.changeReason ? ` · ${l.changeReason}` : ''}
                        </span>
                      ) : null}
                    </div>
                    <span className="flex shrink-0 items-baseline gap-[5px]">
                      <span className={cn('font-wds-mono text-[16px] leading-5 text-wds-text-ink', edited && 'font-semibold')}>{edited && final ? final : asked}</span>
                      <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{l.unit}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
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

function FileSkeleton() {
  return (
    <PhoneColumn>
      <HeadPhoneHeader leading="menu" title="Requisition" subtitle="Opening" />
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
