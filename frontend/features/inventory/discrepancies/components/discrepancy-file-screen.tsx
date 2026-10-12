'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ErrorState } from '@/components/app/shell/shell-states';
import { Topbar } from '@/components/app/shell/topbar';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { cn } from '@/lib/cn';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { LoadingAnnouncer } from '../../_shared/components/scw-states';
import { useLoader } from '../../_shared/hooks/use-async';
import { DocLink, MonoLabel } from '../../requisitions/components/req-parts';
import { clock, dayAndClock, dayLabel, kes } from '../../requisitions/_shared/lib/requisitions-words';
import { COUNT_REASON_TEXT } from '../../dispatch/_shared/types/dispatch-contract';
import { FileHeader, NextStepCard, RuledBlock, RuledRow } from '../../dispatch/components/desktop/file-parts';
import { PhotoStrip } from '../../dispatch/components/desktop/photo-strip';
import { useRecordNudge } from '../../dispatch/hooks/use-record-nudge';
import { discrepancyChip, discrepancyNextWords, discrepancyTitle, nameAndTitle, recordedBody } from '../../dispatch/lib/dispatch-words';
import { discrepanciesApi } from '../../dispatch/services/branch-side-api';
import { FINDINGS, FINDING_PROFILE, FINDING_TEXT, type DiscrepancyFile, type Finding } from '../_shared/types/discrepancies-contract';
import { FindingDrawer } from './finding-drawer';
import { ReverseDialog } from './reverse-dialog';

function FileSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-4 w-[460px]" />
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-2 gap-8"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
    </div>
  );
}

/** What a finding does to stock, in one line (the "Stock effect" column of E2 and cell of E1). */
function effectText(finding: Finding, file: DiscrepancyFile, reversed: boolean): string {
  const n = Math.abs(Number(file.gapQty));
  const item = file.item.name;
  const short = file.direction === 'SHORT';
  const sign = (positive: boolean): string => (positive !== reversed ? '+' : '−');
  switch (finding) {
    case 'PACKED_SHORT':
      return reversed ? `−${n} ${item} out of store stock again · ledger entry` : `+${n} ${item} into Central Store stock · ledger entry`;
    case 'PACKED_MORE':
      return reversed ? `+${n} ${item} back into store stock · ledger entry` : `−${n} ${item} out of Central Store stock · ledger entry`;
    case 'LOST_OR_DAMAGED':
      return reversed ? `${n} ${item} put back from the write-off · ledger entry` : `${n} ${item} written off at cost · ledger entry`;
    case 'BRANCH_COUNTED_WRONG':
      return `${sign(short)}${n} ${item} ${short !== reversed ? 'into' : 'out of'} ${file.department.name} stock · ledger entry`;
    case 'CANT_TELL':
      return reversed ? `${n} ${item} put back from the write-off · ledger entry` : short ? `${n} ${item} written off at cost, unexplained · ledger entry` : `${n} extra ${item} recorded as unexplained · ledger entry`;
  }
}

const findingFromSentence = (sentence: string): Finding | null => {
  const lower = sentence.toLowerCase();
  return FINDINGS.find((f) => lower.includes(FINDING_TEXT[f].toLowerCase()) || lower.includes(f.toLowerCase().replace(/_/g, ' '))) ?? null;
};

const heldRow = (file: DiscrepancyFile): { label: string; value: string; tone: 'amber' | 'green' } => {
  const n = Math.abs(Number(file.gapQty));
  if (file.status !== 'RECORDED' || !file.finding) return { label: 'Held as unaccounted', value: String(n), tone: 'amber' };
  const words: Record<Finding, string> = {
    PACKED_SHORT: `the ${n} went back to stock`,
    PACKED_MORE: `store stock was corrected by ${n}`,
    LOST_OR_DAMAGED: `the ${n} were written off`,
    BRANCH_COUNTED_WRONG: 'the department was corrected',
    CANT_TELL: `the ${n} were recorded as unexplained`,
  };
  return { label: 'Held as unaccounted now', value: `0 · ${words[file.finding.finding]}`, tone: 'green' };
};

/** Paper D14 (open), E1 (after a finding), E2 (after a reversal, gap held again): the discrepancy file. */
export function DiscrepancyFileScreen({ id, base, section: crumb }: { id: string; base: string; section: 'Branch' | 'Central Store' }) {
  const router = useRouter();
  const params = useSearchParams();
  const file = useLoader(`discrepancy:${id}`, () => discrepanciesApi.file(id), 'Could not load this discrepancy.');
  const reverseRef = React.useRef<HTMLButtonElement>(null);
  const data = file.data;
  const reload = file.reload;
  // After a finding is recorded or reversed, the button that opened the drawer or dialog is gone: put focus on the file's heading
  // once the new state has loaded, so a keyboard user does not lose their place.
  const refocus = React.useRef(false);
  React.useEffect(() => {
    if (!refocus.current || !data) return;
    refocus.current = false;
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [data]);
  const drawer = params.get('drawer') === 'finding';
  const reversing = params.get('dialog') === 'reverse';

  useRecordNudge(() => void reload());

  const setParam = React.useCallback(
    (changes: Record<string, string | null>): void => {
      const q = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) q.delete(key);
        else q.set(key, value);
      }
      router.replace(`${base}/discrepancies/${id}${q.toString() ? `?${q}` : ''}`, { scroll: false });
    },
    [params, router, base, id],
  );
  const toast = (title: string, description?: string): void => {
    useWdsToastStore.getState().addToast({ variant: 'success', title, description });
  };

  const money = data?.valueKes !== undefined;
  const words = data ? discrepancyNextWords(data) : null;
  const held = data ? heldRow(data) : null;
  const showWho = data ? data.status === 'OPEN' && data.reversal === null : false;
  const entries = React.useMemo(() => {
    if (!data) return [];
    const list = data.events.filter((e) => e.type === 'FINDING_RECORDED' || e.type === 'FINDING_REVERSED');
    let last: Finding | null = data.finding?.finding ?? null;
    // Oldest first, so a reversal inherits the finding it undoes.
    return [...list].reverse().map((e) => {
      const reversed = e.type === 'FINDING_REVERSED';
      const found = reversed ? last : (findingFromSentence(e.sentence) ?? data.finding?.finding ?? null);
      if (!reversed) last = found;
      return { event: e, reversed, finding: found };
    }).reverse();
  }, [data]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar hideSearch breadcrumb={{ root: crumb, section: 'Requisitions', sectionHref: base, screen: data?.reference ?? 'Discrepancy' }} />
      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-8 py-7">
        {file.status === 'error' ? (
          <ErrorState title="Couldn't load this discrepancy" description="Check your connection and try again." onRetry={() => void reload()} />
        ) : !data || !words || !held ? (
          <>
            <LoadingAnnouncer text="Getting the discrepancy" />
            <FileSkeleton />
          </>
        ) : (
          <>
            <FileHeader
              title={discrepancyTitle(data)}
              chip={discrepancyChip(data)}
              subline={
                <>
                  <DocLink className="text-[13px] !underline">{data.reference}</DocLink>
                  <span>on</span>
                  <DocLink className="text-[13px]" href={`${base}/dispatch/${data.dispatch.id}`}>{data.dispatch.reference}</DocLink>
                  <span>
                    · {data.department.name}, {data.branch.name} · opened {clock(data.openedAt)}
                    {data.reversal && data.status === 'OPEN' ? ` · reopened ${clock(data.reversal.reversed.at)}` : ''}
                    {data.status === 'RECORDED' && data.finding ? ` · closed ${clock(data.finding.recorded.at)}` : ''}
                  </span>
                </>
              }
            />

            {data.status === 'RECORDED' && data.finding ? (
              <section aria-label="The finding" className="flex items-start justify-between gap-6 border border-wds-border-strong border-l-[3px] border-l-wds-success-fg bg-wds-surface py-5 pl-6 pr-6">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <MonoLabel className="text-[11px] leading-[14px]">The finding</MonoLabel>
                    <h2 className="font-wds-sans text-[18px] font-semibold leading-6 tracking-[-0.01em] text-wds-text-ink">{FINDING_TEXT[data.finding.finding]}</h2>
                    <p className="max-w-[760px] font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{recordedBody(data.finding.finding, { sent: data.sentQty, counted: data.countedQty, gap: Math.abs(Number(data.gapQty)), item: data.item.name })}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
                    <div className="flex flex-col gap-1"><dt><MonoLabel>Recorded by</MonoLabel></dt><dd className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{nameAndTitle(data.finding.recorded.by)}</dd></div>
                    <div className="flex flex-col gap-1"><dt><MonoLabel>When</MonoLabel></dt><dd className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{dayAndClock(data.finding.recorded.at)}</dd></div>
                    <div className="flex flex-col gap-1">
                      <dt><MonoLabel>Recorded against</MonoLabel></dt>
                      <dd className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">
                        {FINDING_PROFILE[data.finding.finding].against === 'STORE' ? `The store · ${data.packed.by.name} packed and signed` : FINDING_PROFILE[data.finding.finding].against === 'CARRIER' ? `The carrier · ${data.carrier.name}` : FINDING_PROFILE[data.finding.finding].against === 'RECEIVER' ? `The receiver · ${nameAndTitle(data.counted.by)}` : 'Unexplained, its own bucket'}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1"><dt><MonoLabel>Stock effect</MonoLabel></dt><dd className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{effectText(data.finding.finding, data, false).replace(' · ledger entry', '')}</dd></div>
                    {data.finding.note ? <div className="col-span-2 flex flex-col gap-1"><dt><MonoLabel>Note</MonoLabel></dt><dd className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{data.finding.note}</dd></div> : null}
                    <div className="col-span-2 flex flex-col gap-1">
                      <dt><MonoLabel>Stock ledger</MonoLabel></dt>
                      <dd className="font-wds-mono text-[13px] leading-[18px] text-[#1F5BAE] underline underline-offset-2">Entry carrying {data.reference} · {effectText(data.finding.finding, data, false).replace(' · ledger entry', '')}</dd>
                    </div>
                    {data.finding.lossValueKes !== undefined ? <div className="flex flex-col gap-1"><dt><MonoLabel>Written off at cost</MonoLabel></dt><dd className="font-wds-mono text-[15px] text-wds-text-ink">KES {kes(data.finding.lossValueKes)}</dd></div> : null}
                  </dl>
                </div>
                {data.can.reverse ? (
                  <Button ref={reverseRef} variant="secondary" size="lg" className="h-10 shrink-0 px-[18px] text-[14px] leading-[18px]" onClick={() => setParam({ dialog: 'reverse' })}>
                    Reverse this finding
                  </Button>
                ) : null}
              </section>
            ) : (
              <NextStepCard
                title={words.title}
                body={words.body}
                tone="amber"
                action={data.can.recordFinding && data.allowedFindings.length > 0 ? <Button size="lg" className="h-10 px-[18px] text-[14px] leading-[18px]" onClick={() => setParam({ drawer: 'finding' })}>Record a finding</Button> : null}
              />
            )}

            {data.reversal || entries.length > 1 ? (
              <RuledBlock label="Every entry on this gap">
                <div role="table" aria-label="Every entry on this gap">
                  <div role="row" className="grid h-[34px] grid-cols-[300px_240px_200px_1fr] items-center border-b border-wds-border">
                    <MonoLabel>Entry</MonoLabel><MonoLabel>By</MonoLabel><MonoLabel>When</MonoLabel><MonoLabel>Stock effect</MonoLabel>
                  </div>
                  {entries.map(({ event, reversed, finding }) => (
                    <div key={event.id} role="row" className={cn('grid grid-cols-[300px_240px_200px_1fr] items-center border-b border-wds-border py-[11px]', reversed && 'bg-wds-neutral-50')}>
                      <div role="cell" className="flex flex-col gap-0.5"><span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{reversed ? 'Finding reversed' : 'Finding recorded'}</span><span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{reversed ? (event.reason ?? data.reversal?.reason ?? '') : finding ? FINDING_TEXT[finding] : ''}</span></div>
                      <span role="cell" className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{nameAndTitle(event.actor)}</span>
                      <span role="cell" className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{dayAndClock(event.at)}</span>
                      <span role="cell" className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{finding ? effectText(finding, data, reversed) : '—'}</span>
                    </div>
                  ))}
                </div>
              </RuledBlock>
            ) : null}

            <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-2">
              <RuledBlock label="The gap">
                <RuledRow label="Sent from the Central Store">{data.sentQty}</RuledRow>
                <RuledRow label={`Counted at the branch (${data.countedTwice ? 'twice' : 'once'})`}>{data.countedQty}</RuledRow>
                <RuledRow label={held.label} tone={held.tone}>{held.value}</RuledRow>
                <RuledRow label="Reason the branch gave">{data.branchReason ? COUNT_REASON_TEXT[data.branchReason] : 'None given'}{data.branchReasonNote ? ` · ${data.branchReasonNote}` : ''}</RuledRow>
                <RuledRow label="Photo">{data.photos.length > 0 ? <PhotoStrip photos={data.photos} /> : <span className="text-wds-text-faint">None added</span>}</RuledRow>
                {money ? <RuledRow label="Value of the gap at frozen cost (KES)"><span className="font-wds-mono">{kes(data.valueKes ?? '0')}</span></RuledRow> : null}
              </RuledBlock>

              {showWho ? (
                <RuledBlock label="Who handled it">
                  <RuledRow label="Packed by">{nameAndTitle(data.packed.by)} · {clock(data.packed.at)}</RuledRow>
                  <RuledRow label="Signed by">{nameAndTitle(data.signed.by)} · {clock(data.signed.at)}</RuledRow>
                  <RuledRow label="Carried by">{data.carrier.name}</RuledRow>
                  <RuledRow label="Counted by">{nameAndTitle(data.counted.by)} · {clock(data.counted.at)}</RuledRow>
                  <RuledRow label="Assigned to">{data.assignedTo}</RuledRow>
                </RuledBlock>
              ) : (
                <RuledBlock label="Activity">
                  <ol aria-label="Activity">
                    {data.events.map((event) => (
                      <li key={event.id} className="flex flex-col gap-0.5 border-b border-wds-border py-3">
                        <p className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{event.sentence}</p>
                        <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                          {dayAndClock(event.at)}
                          {event.type === 'FINDING_RECORDED' || event.type === 'FINDING_REVERSED' ? ' · stock ledger entry written' : ''}
                          {event.reason && event.type !== 'FINDING_REVERSED' ? ` · ${event.reason}` : ''}
                        </p>
                      </li>
                    ))}
                  </ol>
                </RuledBlock>
              )}
            </div>

            {showWho ? (
              <section aria-label="Once a finding is recorded" className="flex flex-col gap-2">
                <MonoLabel className="text-[11px] leading-[14px]">Once a finding is recorded</MonoLabel>
                <p className="max-w-[900px] font-wds-sans text-[14px] leading-5 text-wds-text-secondary">The finding moves the stock and is written to the stock ledger as a new linked entry carrying this number. Nothing is edited or deleted; a wrong finding is reversed with a reason and a PIN.</p>
              </section>
            ) : null}
          </>
        )}
      </main>

      {data ? (
        <FindingDrawer
          file={data}
          open={drawer && data.can.recordFinding && data.allowedFindings.length > 0}
          onOpenChange={(open) => setParam({ drawer: open ? 'finding' : null })}
          onRecorded={(result) => {
            refocus.current = true;
            setParam({ drawer: null });
            toast(`Finding recorded: ${FINDING_TEXT[result.finding.finding].toLowerCase()}`, 'A new entry linked to this number is in the stock ledger.');
            void reload();
          }}
        />
      ) : null}
      {data ? (
        <ReverseDialog
          file={data}
          open={reversing && data.can.reverse}
          onOpenChange={(open) => setParam({ dialog: open ? 'reverse' : null })}
          returnFocus={() => reverseRef.current}
          onReversed={() => {
            refocus.current = true;
            setParam({ dialog: null });
            toast('Finding reversed', 'The gap is held as unaccounted again. Both entries stay on file.');
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}

export { dayLabel };
