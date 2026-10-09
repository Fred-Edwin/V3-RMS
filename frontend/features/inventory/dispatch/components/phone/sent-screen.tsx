'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Banner, B2Header, B2PrimaryButton, B2SecondaryButton, RefLink } from '../../../_shared/components/block2-phone-parts';
import { SectionLabel } from '../../../_shared/components/block2-phone-parts';
import { timeText } from '../../../requisitions/lib/time';
import type { SignDispatchResult } from '../../_shared/types/dispatch-contract';
import { deliveryNotesText, stillToPackText, wentOutText } from '../../lib/pack-logic';
import { recallSent } from '../../lib/pack-session';
import { dispatchFile, dispatchPrintBatch, dispatchTab } from '../../lib/phone-routes';

/** On the way (Paper D6, and chapter 10's partial send). Shown right after the signature; kept on the device so a reload still shows it. */
export function SentScreen({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const [result, setResult] = React.useState<SignDispatchResult | null | undefined>(undefined);
  React.useEffect(() => {
    setResult(recallSent(requisitionId));
  }, [requisitionId]);

  // Nothing remembered (a new device, cleared storage): the sent dispatches are on the On the way tab.
  React.useEffect(() => {
    if (result === null) router.replace(dispatchTab('on-the-way'));
  }, [result, router]);
  if (!result) return <PhoneColumn><B2Header title="On the way" subtitle="" leading="menu" place="CENTRAL STORE" /></PhoneColumn>;

  const rows: { key: string; reference: string | null; id: string | null; name: string; right: string; pending: boolean }[] = [
    ...result.dispatches.map((d) => ({ key: d.id, reference: d.reference, id: d.id, name: d.departmentName, right: `${d.lineCount} ${d.lineCount === 1 ? 'line' : 'lines'}`, pending: false })),
    ...result.leftOut.map((d) => ({ key: d.id, reference: null, id: null, name: d.name, right: 'Still to pack', pending: true })),
  ];
  const partial = result.leftOut.length > 0;
  const still = stillToPackText(result.leftOut.map((d) => d.name));
  const sentCount = result.dispatches.length;
  const notes = deliveryNotesText(sentCount);
  const printLabel = sentCount === 1 ? 'Print the delivery note' : `Print the ${notes.charAt(0).toLowerCase()}${notes.slice(1)}`;

  return (
    <PhoneColumn>
      <B2Header title={`${result.branch.name} is on the way`} subtitle={result.reference} mono leading="menu" place="CENTRAL STORE" />
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto bg-wds-canvas p-5">
        <B2Banner tone="success" title="Signed and sent">
          {wentOutText(result.lineCount, result.shortCount, timeText(result.signedAt))} The stock has left the Central Store.
        </B2Banner>
        {partial && still ? (
          <B2Banner tone="warning" title={`${result.sentDepartments} of ${result.totalDepartments} departments sent`} dot={false} compact>
            {still.line}
          </B2Banner>
        ) : null}
        <section aria-label="Who signed and carried it" className="border border-wds-border bg-wds-surface">
          <div className="grid grid-cols-2 border-b border-wds-border">
            <div className="flex flex-col gap-[3px] border-r border-wds-border px-4 py-2.5">
              <SectionLabel className="text-[10px] leading-3">Signed by</SectionLabel>
              <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{result.signedBy.roleLabel}</p>
            </div>
            <div className="flex flex-col gap-[3px] px-4 py-2.5">
              <SectionLabel className="text-[10px] leading-3">Carried by</SectionLabel>
              <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{result.carrier.name}</p>
            </div>
          </div>
          <ul>
            {rows.map((row) => (
              <li key={row.key} className={row.pending ? 'flex items-center gap-2.5 border-b border-wds-border bg-wds-neutral-50 px-4 py-[11px] last:border-b-0' : 'flex items-center gap-2.5 border-b border-wds-border px-4 py-[11px] last:border-b-0'}>
                {row.reference && row.id ? <RefLink reference={row.reference} href={dispatchFile(row.id)} className="shrink-0" /> : <span className="shrink-0 font-wds-mono text-[13px] leading-[18px] text-wds-text-secondary">Not numbered yet</span>}
                <span className={row.pending ? 'grow font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary' : 'grow font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary'}>{row.name}</span>
                <span className={row.pending ? 'font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg' : 'font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary'}>{row.right}</span>
              </li>
            ))}
          </ul>
        </section>
        <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Each department counts its own delivery when it arrives.</p>
        <B2SecondaryButton onClick={() => window.open(dispatchPrintBatch(result.dispatches.map((d) => d.id)), '_blank', 'noopener')} className="h-11 text-[14px] font-medium leading-[18px]">
          {printLabel}
        </B2SecondaryButton>
        {/* Paper D6: the main button sits at the foot of the content (no bordered footer bar). */}
        <div className="mt-auto">
          <B2PrimaryButton onClick={() => router.push(dispatchTab('to-pack'))}>Back to To pack</B2PrimaryButton>
        </div>
      </div>
    </PhoneColumn>
  );
}
