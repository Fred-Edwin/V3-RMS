'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Banner, B2Header, B2Tracker, Chip, ItemsTable, RefLink, SectionLabel } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { couldNotLoad, personDot } from '../../../_shared/lib/block2-words';
import { formatQty } from '../../../requisitions/lib/qty';
import { dateTimeText, shortDateText, timeText } from '../../../requisitions/lib/time';
import { COUNT_REASON_TEXT, type DispatchDocument, type DispatchFile } from '../../_shared/types/dispatch-contract';
import { useDispatchFile } from '../../hooks/use-phone-dispatch';
import { attendantFileChip, dispatchTrackerRows, firstDiscrepancy, gapText, recordedFinding, whenText } from '../../lib/file-logic';
import { DISPATCH_HOME } from '../../lib/phone-routes';

const printHref = (id: string, copy: 'store' | 'branch'): string => `/app/branch/dispatch-print/${id}?copy=${copy}`;

/** The dispatch file on the phone (Block 2 gaps N1 and N1b): read only, no money. Opens from the DSP- links on D6, the On the way tab and Done. */
export function DispatchFileScreen({ id }: { id: string }) {
  const router = useRouter();
  const file = useDispatchFile(id);
  const data = file.data;
  const back = (): void => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(DISPATCH_HOME);
  };

  if (file.status === 'error' && !data) {
    return (
      <PhoneColumn>
        <B2Header title="Dispatch" subtitle="" leading="back" onBack={back} place="CENTRAL STORE" />
        <div role="alert" className="p-5">
          <MobileErrorState title="Could not load this dispatch" description={couldNotLoad('this dispatch')} onRetry={() => void file.reload()} />
        </div>
      </PhoneColumn>
    );
  }
  if (!data) {
    return (
      <PhoneColumn>
        <B2Header title="Dispatch" subtitle="" leading="back" onBack={back} place="CENTRAL STORE" />
        <LoadingAnnouncer text="Loading this dispatch" />
        <div className="flex flex-1 flex-col gap-4 bg-wds-canvas p-5" aria-hidden="true">
          <Skeleton className="h-6 w-56" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-5 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3.5 w-48" />
              </div>
            </div>
          ))}
        </div>
      </PhoneColumn>
    );
  }
  return <FileBody file={data} onBack={back} />;
}

function FileBody({ file, onBack }: { file: DispatchFile; onBack: () => void }) {
  const cancelled = file.cancelled !== null;
  const tracker = dispatchTrackerRows(file);
  const chip = attendantFileChip(file);
  const discrepancy = firstDiscrepancy(file);
  const finding = recordedFinding(file);
  const counted = file.counted !== null;

  const rows = file.items.map((item) => {
    const note = item.countReason && item.discrepancy ? COUNT_REASON_TEXT[item.countReason] : null;
    const gap = counted && !cancelled ? gapText(item.gapQty) : undefined;
    return {
      key: item.lineId,
      name: item.itemName,
      note,
      cells: cancelled ? [item.sentQty !== undefined ? formatQty(item.sentQty) : null] : [item.sentQty !== undefined ? formatQty(item.sentQty) : null, item.countedQty !== null ? formatQty(item.countedQty) : null],
      gap,
      flagged: item.discrepancy !== null,
    };
  });

  return (
    <PhoneColumn>
      <B2Header title={`${file.department.name} · ${file.branch.name}`} subtitle={`${file.reference} · ${file.lineCount} ${file.lineCount === 1 ? 'line' : 'lines'}`} mono leading="back" onBack={onBack} place="CENTRAL STORE" />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto bg-wds-canvas p-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip spec={chip} />
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{cancelled ? `was ${file.carrier.name}` : file.carrier.name}</span>
          </div>
          <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
            from <RefLink reference={file.requisition.reference} className="text-[13px] leading-[18px]" /> · {shortDateText(file.packedAt)}
          </p>
        </div>

        {file.cancelled ? (
          <B2Banner tone="error" title={`Cancelled at ${timeText(file.cancelled.at)}`} smallFootnote footnote={`${personDot(file.cancelled.by)} · the stock came back to the Central Store as a linked entry, and the lines are back in To pack.`} role="alert">
            {file.cancelled.reason}
          </B2Banner>
        ) : null}

        <B2Tracker rows={tracker.rows} heading={tracker.heading} currentTone={tracker.tone} />

        <dl className="border border-wds-border bg-wds-surface">
          <FactRow label="Packed by" value={personDot(file.packed.by)} />
          <FactRow label="Signed by" value={personDot(file.signed.by)} />
          <FactRow label="Carried by" value={file.carrier.name} />
          {file.counted ? <FactRow label="Counted by" value={`${personDot(file.counted.by)}${file.onBehalf ? ' (on behalf)' : ''}`} /> : null}
        </dl>

        <ItemsTable heading="Items" labelId="dispatch-items" columns={cancelled ? ['Sent'] : ['Sent', 'Counted']} rows={rows} />
        {cancelled ? <p className="-mt-2.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Not counted: the branch never received this delivery.</p> : null}

        {discrepancy && !cancelled ? (
          <section aria-label="What happened to the gap" className="flex flex-col gap-1.5 border border-wds-warning-border bg-wds-warning-bg px-4 py-3.5">
            <h2 className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-warning-fg">{finding && discrepancy.status !== 'OPEN' ? finding.text : `${discrepancy.itemName} is short by ${formatQty(Math.abs(Number(discrepancy.gapQty ?? 0)))}`}</h2>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
              {discrepancy.status === 'OPEN' ? 'Still open. The Store Manager has been told and will say what happened.' : 'The Store Manager recorded what happened to the gap.'}
            </p>
            <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              Opened as <span className="font-wds-mono text-[#1F5BAE] underline underline-offset-2">{discrepancy.reference}</span>
              {finding && discrepancy.status !== 'OPEN' ? (
                <>
                  <br />
                  Recorded by {finding.actor}, {finding.roleLabel} · {whenText(finding.at)}
                </>
              ) : null}
            </p>
          </section>
        ) : null}

        <section aria-labelledby="dispatch-documents" className="flex flex-col gap-2">
          <SectionLabel id="dispatch-documents" className="text-[10px] leading-3">Documents</SectionLabel>
          <ul className="border border-wds-border bg-wds-surface">
            {file.documents.length === 0 ? <li className="px-4 py-[11px] font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">The delivery notes appear when it is signed.</li> : null}
            {file.documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} fileId={file.id} canPrint={file.can.print} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="dispatch-activity" className="flex flex-col gap-2">
          <SectionLabel id="dispatch-activity" className="text-[10px] leading-3">Activity</SectionLabel>
          <ol className="border border-wds-border bg-wds-surface">
            {file.activity.map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 border-b border-wds-border px-4 py-2.5 last:border-b-0">
                <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{event.sentence}</p>
                <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{dateTimeText(event.at)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PhoneColumn>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-wds-border px-4 py-2.5 last:border-b-0">
      <dt className="shrink-0 whitespace-nowrap font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{label}</dt>
      <dd className="text-right font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{value}</dd>
    </div>
  );
}

function DocumentRow({ doc, fileId, canPrint }: { doc: DispatchDocument; fileId: string; canPrint: boolean }) {
  const store = doc.kind === 'DELIVERY_NOTE_STORE';
  const title = store ? 'Delivery note · store copy' : 'Delivery note · branch copy';
  return (
    <li className="flex items-center justify-between gap-3 border-b border-wds-border px-4 py-[11px] last:border-b-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn('font-wds-sans text-[14px] leading-[18px]', doc.voided ? 'text-wds-text-secondary line-through' : 'text-wds-text-ink')}>{title}</span>
        {doc.voided ? (
          <span className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">Void · cancelled {shortDateText(doc.at).split(' ').slice(1).join(' ')}</span>
        ) : (
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{store ? 'With the quantities sent' : 'With a blank count column'}</span>
        )}
      </div>
      {canPrint ? (
        <a
          href={printHref(fileId, store ? 'store' : 'branch')}
          target="_blank"
          rel="noopener"
          aria-label={`Print ${title}`}
          className="-my-3 flex min-h-11 shrink-0 items-center rounded-wds-sm px-1 font-wds-sans text-[13px] font-medium leading-[18px] text-[var(--wds-primary-btn-start)] outline-none hover:bg-wds-caramel-100 focus-visible:shadow-wds-ring"
        >
          Print
        </a>
      ) : null}
    </li>
  );
}
