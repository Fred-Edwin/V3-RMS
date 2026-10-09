'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MobileErrorState } from '@/components/app/shell/mobile-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Footer, B2Header, B2PrimaryButton, B2Tracker, Chip, ItemsTable, RefLink, SectionLabel } from '../../../_shared/components/block2-phone-parts';
import { LoadingAnnouncer } from '../../../_shared/components/scw-states';
import { couldNotLoad, personComma } from '../../../_shared/lib/block2-words';
import { COUNT_REASON_TEXT } from '../../../dispatch/_shared/types/dispatch-contract';
import { firstDiscrepancy, gapText, recordedFinding } from '../../../dispatch/lib/file-logic';
import { formatQty } from '../../../requisitions/lib/qty';
import { dateTimeText, shortDateText } from '../../../requisitions/lib/time';
import { useDeliveryFile } from '../../hooks/use-deliveries';
import { DELIVERIES_HOME } from '../../lib/delivery-routes';
import { deliveryFileChip, deliveryTrackerRows } from '../../lib/file-logic';
import { AuthedImage } from './authed-image';

/** My delivery (Block 2 gaps N3a and N3b): what you counted, what was sent, the gap and how it ended. Read only, no money. */
export function DeliveryFileScreen({ id }: { id: string }) {
  const router = useRouter();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const loader = useDeliveryFile(id);
  const file = loader.data;
  const back = (): void => (window.history.length > 1 ? router.back() : router.push(DELIVERIES_HOME));

  if (loader.status === 'error' && !file) {
    return (
      <PhoneColumn>
        <B2Header title="Delivery" subtitle="" leading="back" onBack={back} place={orgName} />
        <div role="alert" className="p-5">
          <MobileErrorState title="Could not load this delivery" description={loader.error ?? couldNotLoad('this delivery')} onRetry={() => void loader.reload()} />
        </div>
      </PhoneColumn>
    );
  }
  if (!file) {
    return (
      <PhoneColumn>
        <B2Header title="Delivery" subtitle="" leading="back" onBack={back} place={orgName} />
        <LoadingAnnouncer text="Loading this delivery" />
        <div className="flex flex-1 flex-col gap-4 bg-wds-canvas p-5" aria-hidden="true">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </PhoneColumn>
    );
  }

  const chip = deliveryFileChip(file);
  const rows = file.items.map((item) => ({
    key: item.lineId,
    name: item.itemName,
    note: item.discrepancy && item.countReason ? `You said: ${COUNT_REASON_TEXT[item.countReason].toLowerCase()}` : null,
    cells: [item.countedQty !== null ? formatQty(item.countedQty) : null, item.sentQty !== undefined ? formatQty(item.sentQty) : null],
    gap: gapText(item.gapQty) ?? undefined,
    flagged: item.discrepancy !== null,
  }));
  const gapItem = file.items.find((i) => i.discrepancy !== null && (i.photos.length > 0 || i.countReason));
  const discrepancy = firstDiscrepancy(file);
  const finding = recordedFinding(file);
  const open = discrepancy?.status === 'OPEN' || discrepancy?.status === 'REVERSED';
  const history = file.activity.filter((e) => e.type === 'FINDING_RECORDED' || e.type === 'FINDING_REVERSED');

  return (
    <PhoneColumn>
      <B2Header title="Delivery" subtitle={`${file.reference} · ${file.department.name}`} leading="back" onBack={back} place={orgName} />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-wds-canvas px-5 pb-6 pt-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            {chip ? <Chip spec={chip} /> : null}
            <span className="font-wds-sans text-[15px] leading-5 text-wds-text-muted">
              {file.lineCount} {file.lineCount === 1 ? 'line' : 'lines'} · from the Central Store
            </span>
          </div>
          <p className="font-wds-sans text-[15px] leading-5 text-wds-text-muted">
            Asked for on <RefLink reference={file.requisition.reference} className="text-[14px]" /> · {shortDateText(file.packedAt)}
          </p>
        </div>

        <B2Tracker heading="Where it is" rows={deliveryTrackerRows(file)} currentTone="warning" />

        {file.sentVisible ? (
          <ItemsTable heading="What you counted" labelId="delivery-items" columns={['Counted', 'Sent']} rows={rows} />
        ) : (
          <p className="font-wds-sans text-[14px] leading-5 text-wds-text-muted">The sent figures show after you count and sign.</p>
        )}

        {gapItem ? (
          <section aria-label={`What you added on ${gapItem.itemName}`} className="flex flex-col gap-2">
            <SectionLabel>What you added on {gapItem.itemName}</SectionLabel>
            <div className="border border-wds-border bg-wds-surface">
              {gapItem.countReason ? (
                <div className="flex items-center justify-between border-b border-wds-border px-3.5 py-3">
                  <span className="font-wds-sans text-[15px] leading-5 text-wds-text-muted">Reason</span>
                  <span className="font-wds-sans text-[15px] leading-5 text-wds-text-ink">{COUNT_REASON_TEXT[gapItem.countReason]}</span>
                </div>
              ) : null}
              {gapItem.photos.length > 0 ? (
                <div className="flex flex-col gap-2.5 px-3.5 py-3">
                  <span className="font-wds-sans text-[15px] leading-5 text-wds-text-muted">Photos · {gapItem.photos.length}</span>
                  <ul className="flex flex-wrap gap-2.5">
                    {gapItem.photos.map((p, i) => (
                      <li key={p.id} className="size-[72px] border border-wds-border bg-wds-neutral-100">
                        <AuthedImage url={p.url} alt={`Photo ${i + 1} of ${gapItem.itemName}`} className="flex size-full items-center object-cover" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {discrepancy ? (
          <section aria-label="The gap" className={open ? 'flex flex-col gap-1.5 border border-wds-warning-border bg-wds-warning-bg p-4' : 'flex flex-col gap-1.5 border border-wds-success-border bg-wds-success-bg p-4'}>
            <h2 className={open ? 'font-wds-sans text-[16px] font-semibold leading-5 text-wds-warning-fg' : 'font-wds-sans text-[16px] font-semibold leading-5 text-wds-success-fg'}>
              {open ? `${discrepancy.itemName} is short by ${formatQty(Math.abs(Number(discrepancy.gapQty ?? 0)))}` : (finding?.text ?? 'Settled')}
            </h2>
            <p className="font-wds-sans text-[14px] leading-5 text-wds-text-ink">
              {open ? 'Still open. The Store Manager has been told and will say what happened. You do not need to do anything more.' : 'The Store Manager recorded what happened. You do not need to do anything more.'}
            </p>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-muted">
              Opened as <span className="font-wds-mono text-[#1F5BAE] underline underline-offset-2">{discrepancy.reference}</span>
            </p>
          </section>
        ) : null}

        {history.length > 1 ? (
          <section aria-labelledby="every-entry" className="flex flex-col gap-2">
            <SectionLabel id="every-entry">Every entry on this gap</SectionLabel>
            <ol className="border border-wds-border bg-wds-surface">
              {history.map((e) => (
                <li key={e.id} className="flex flex-col gap-0.5 border-b border-wds-border px-3.5 py-3 last:border-b-0">
                  <p className="font-wds-sans text-[15px] leading-5 text-wds-text-ink">{e.type === 'FINDING_REVERSED' ? `Finding reversed${e.reason ? `: ${e.reason.toLowerCase()}` : ''}` : `Finding recorded: ${e.sentence.split(': ').slice(1).join(': ')}`}</p>
                  <p className="font-wds-sans text-[13px] leading-4 text-wds-text-muted">
                    {dateTimeText(e.at)} · {personComma(e.actor)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
      <B2Footer>
        <B2PrimaryButton onClick={() => router.push(DELIVERIES_HOME)}>Back to Deliveries</B2PrimaryButton>
      </B2Footer>
    </PhoneColumn>
  );
}
