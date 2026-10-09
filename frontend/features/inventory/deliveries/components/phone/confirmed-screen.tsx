'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { PhoneColumn } from '../../../_shared/components/phone-column';
import { B2Banner, B2Header, B2PrimaryButton, B2Tracker, RefLink } from '../../../_shared/components/block2-phone-parts';
import { formatQty } from '../../../requisitions/lib/qty';
import { timeText } from '../../../requisitions/lib/time';
import type { ConfirmDeliveryResult } from '../../_shared/types/deliveries-contract';
import { recallConfirmed } from '../../lib/confirm-session';
import { DELIVERIES_HOME, deliveryFile } from '../../lib/delivery-routes';

/** Delivery confirmed (Paper D12): the branch's part is done; a gap opens one DSC- for the Store Manager. */
export function ConfirmedScreen({ id }: { id: string }) {
  const router = useRouter();
  const orgName = useAuthStore((s) => s.user?.organizationName ?? '');
  const [result, setResult] = React.useState<ConfirmDeliveryResult | null | undefined>(undefined);
  React.useEffect(() => setResult(recallConfirmed(id)), [id]);
  // Nothing remembered (reload on another device): the delivery file tells the same story.
  React.useEffect(() => {
    if (result === null) router.replace(deliveryFile(id));
  }, [result, id, router]);

  if (!result) return <PhoneColumn><B2Header title="Delivery confirmed" subtitle="" leading="menu" place={orgName} /></PhoneColumn>;

  const gaps = result.discrepancies;
  const first = gaps[0];
  const gapTitle = gaps.length === 1 && first ? `${first.itemName} is short by ${formatQty(Math.abs(Number(first.gapQty)))}` : `${gaps.length} lines differ`;
  const rows = [
    { key: 'p', title: 'Packed and signed', line: timeText(result.signedAt), state: 'DONE' as const },
    ...(result.arrivedAt ? [{ key: 'a', title: 'Arrived', line: timeText(result.arrivedAt), state: 'DONE' as const }] : []),
    { key: 'c', title: 'Counted and signed', line: timeText(result.confirmedAt), state: 'DONE' as const },
    ...(gaps.length > 0 ? [{ key: 's', title: 'Store Manager records what happened', line: null, state: 'TODO' as const }] : []),
  ];

  return (
    <PhoneColumn>
      <B2Header title="Delivery confirmed" subtitle={`${result.reference}`} mono leading="menu" place={orgName} />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto bg-wds-canvas p-5">
        <B2Banner tone="success" title={`Counted and signed at ${timeText(result.confirmedAt)}`}>
          {result.matchedCount === result.lineCount ? `All ${result.lineCount} lines matched. What you counted is now in your stock.` : `${result.matchedCount} ${result.matchedCount === 1 ? 'line' : 'lines'} matched. What you counted is now in your stock.`}
        </B2Banner>
        {gaps.length > 0 ? (
          <B2Banner tone="warning" title={gapTitle} dot={false} footnote={<span className="flex flex-wrap items-center gap-x-2">Opened as {gaps.map((g) => <RefLink key={g.id} reference={g.reference} href={deliveryFile(id)} />)}</span>}>
            The Store Manager has been told and will say what happened. You do not need to do anything more.
          </B2Banner>
        ) : null}
        <B2Tracker heading="Where it is" rows={rows} currentTone="warning" />
        {/* Paper D12: the main button sits at the foot of the content (no bordered footer bar). */}
        <div className="mt-auto">
          <B2PrimaryButton onClick={() => router.push(DELIVERIES_HOME)}>Back to Deliveries</B2PrimaryButton>
        </div>
      </div>
    </PhoneColumn>
  );
}
