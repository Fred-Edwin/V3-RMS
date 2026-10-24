'use client';

import Link from 'next/link';

import { EmptyState, ErrorBlock, ListSkeleton, PhoneScreen, useRemote, useWorkforcePermissions } from '../../../_shared';
import { CASUAL_COPY, dayShort, kes } from '../../_shared/lib/casual-words';
import { casualReads } from '../../_shared/services/casual-services';
import { ApprovalCard } from './approval-card';

/**
 * Casual pay for the approver (spec S8): sheets waiting for a decision, newest first, each with its department; and approved sheets where
 * a worker has not signed for 3 days (PD25). Reached from the menu; the Home "Needs you" card links here when Segment 6 draws it.
 */
export function ApproveScreen() {
  const permissions = useWorkforcePermissions();
  const waiting = useRemote(casualReads.waiting, 'waiting', permissions.ready && permissions.can('casual.approve'));

  let body: React.ReactNode;
  if (permissions.failed) body = <ErrorBlock title="We could not load this" line="Your permissions did not load. Nothing was changed." onRetry={permissions.retry} />;
  else if (!permissions.ready) body = <ListSkeleton rows={3} columns={['fill', 60]} label="Opening casual pay" />;
  else if (!permissions.can('casual.approve')) body = <EmptyState kind="nothingYet" title="You do not approve casual pay" line="Casual pay sheets appear here for the Branch Manager and the Director." />;
  else if (waiting.status === 'loading') body = <ListSkeleton rows={3} columns={['fill', 60]} label="Opening casual pay" />;
  else if (waiting.status === 'error') body = <ErrorBlock title="We could not load this" line={waiting.error.message} reference={waiting.error.code} onRetry={waiting.reload} />;
  else {
    const { toApprove, unsigned } = waiting.data;
    const newestFirst = [...toApprove].sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''));
    body = (
      <>
        {newestFirst.length === 0 ? <EmptyState kind="nothingYet" title="No casual pay is waiting" line="Sheets the heads send appear here and in the menu." /> : null}
        {newestFirst.map((c) => (
          <ApprovalCard key={c.id} card={c} onChanged={waiting.reload} />
        ))}
        {unsigned.length > 0 ? (
          <section aria-label="Workers still to sign" className="flex flex-col gap-2">
            <h2 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">STILL TO SIGN FOR THEIR CASH, 3 DAYS OR MORE</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {unsigned.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/workforce/casuals/${c.id}`} className="flex min-h-[56px] items-center justify-between gap-3 border border-wds-border bg-wds-surface px-3.5 py-3 focus-visible:outline-none focus-visible:shadow-wds-ring">
                    <span className="flex flex-col">
                      <span className="font-wds-sans text-[14px] font-semibold text-wds-text-ink">
                        {c.departmentName}, {dayShort(c.date)}
                      </span>
                      <span className="font-wds-sans text-[12px] text-wds-text-secondary">
                        {c.number ?? ''} · {c.unsigned} not signed
                      </span>
                    </span>
                    <span className="font-wds-mono text-[13px]">{kes(c.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </>
    );
  }
  return (
    <PhoneScreen screen={CASUAL_COPY.screen} kicker="CASUAL PAY" back="/app/workforce" title="Casual pay" subtitle="Sheets waiting for your decision">
      {body}
    </PhoneScreen>
  );
}
