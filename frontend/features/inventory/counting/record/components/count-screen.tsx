'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Skeleton } from '@/components/ui2/skeleton';
import { PhoneColumn, ScwPhoneHeader } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { useLoader } from '../../../_shared/hooks/use-async';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import { CountShelfScreen } from './count-shelf-screen';
import { ManagerCountScreen } from './manager-count-screen';

const COUNTS = '/app/inventory/stock/counts';

/**
 * `/stock/counts/[id]/count`. The detail response decides which screen this is, never a role name: no stock-figure keys ⇒ the
 * phone-width centred column (Paper steps 2 to 4); figures present ⇒ the desktop count table (step 13). A count that is not open
 * any more goes to where it belongs (submitted, or its review).
 */
export function CountScreen({ countId }: { countId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const focusLine = params.get('line');
  const detail = useLoader(`count:${countId}`, () => countingApi.detail(countId), COUNTING_STATES_COPY.countShelf.error);
  const count = detail.data;

  React.useEffect(() => {
    if (!count || count.status === 'OPEN') return;
    router.replace(count.figures ? `${COUNTS}/${count.id}` : `${COUNTS}/${count.id}/submitted`);
  }, [count, router]);

  if (detail.status === 'error') {
    return (
      <PhoneColumn>
        <ScwPhoneHeader leading="back" onBack={() => router.push(COUNTS)} title="Count" subtitle="" />
        <ScwStatePanel kind="error" phone text={COUNTING_STATES_COPY.reviewCount.error} onRetry={() => void detail.reload()} />
      </PhoneColumn>
    );
  }
  if (!count || count.status !== 'OPEN') {
    return (
      <PhoneColumn>
        <ScwPhoneHeader leading="back" onBack={() => router.push(COUNTS)} title={COUNTING_STATES_COPY.countShelf.loading.replace('{section}', 'your count')} subtitle="" />
        <LoadingAnnouncer text={COUNTING_STATES_COPY.countShelf.loading.replace('{section}', 'your count')} />
        <div aria-hidden className="flex flex-col">
          <div className="flex flex-col gap-2.5 border-b border-wds-border bg-wds-surface px-4 py-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-1 w-full" />
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex h-15 items-center gap-3 border-b border-wds-border bg-wds-surface px-4">
              <Skeleton className="size-5 rounded-full" />
              <div className="flex grow flex-col gap-1.5">
                <Skeleton className="h-3.5 w-[45%]" />
                <Skeleton className="h-2.5 w-8" />
              </div>
              <Skeleton className="h-11 w-24" />
            </div>
          ))}
        </div>
      </PhoneColumn>
    );
  }
  if (!count.can.count) {
    return (
      <PhoneColumn>
        <ScwPhoneHeader leading="back" onBack={() => router.push(COUNTS)} title="Count" subtitle="" />
        <ScwStatePanel kind="permission" phone text={COUNTING_STATES_COPY.countShelf.permission} />
      </PhoneColumn>
    );
  }
  // Stock figures present means this person counts with expected stock in view (the desktop table); absent means the phone column.
  if (count.figures || count.lines.some((l) => l.expectedQty !== undefined)) return <ManagerCountScreen initial={count} />;
  return <CountShelfScreen initial={count} focusLineId={focusLine} />;
}
