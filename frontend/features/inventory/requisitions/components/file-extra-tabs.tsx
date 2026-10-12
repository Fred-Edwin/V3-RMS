'use client';

import * as React from 'react';
import Link from 'next/link';

import { Skeleton } from '@/components/ui2/skeleton';
import { ErrorState } from '@/components/app/shell/shell-states';
import { useLoader } from '../../_shared/hooks/use-async';
import { requisitionsApi } from '../_shared/services/requisitions-api';
import { dayAndClock } from '../_shared/lib/requisitions-words';
import { DocLink } from './req-parts';

const Loading = () => (
  <div aria-hidden className="flex flex-col gap-3 py-5">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
  </div>
);

const Empty = ({ title, line }: { title: string; line: string }) => (
  <div className="flex flex-col items-center gap-1 border-t border-wds-border py-14 text-center">
    <p className="font-wds-sans text-[16px] font-medium text-wds-text-ink">{title}</p>
    <p className="font-wds-sans text-[14px] text-wds-text-secondary">{line}</p>
  </div>
);

/** The file's Activity tab: every event with who, when and the plain-word sentence (R4). Names appear here because the record states who did it. */
export function ActivityTab({ requisitionId, recordHref }: { requisitionId: string; recordHref: (kind: 'REQUISITION' | 'DISPATCH' | 'DISCREPANCY', id: string) => string | null }) {
  const activity = useLoader(`activity:${requisitionId}`, () => requisitionsApi.activity(requisitionId), 'Could not load the activity.');
  if (activity.status === 'error') return <ErrorState title="Couldn't load the activity" description="Check your connection and try again." onRetry={() => void activity.reload()} />;
  if (!activity.data) return <Loading />;
  if (activity.data.events.length === 0) return <Empty title="Nothing has happened yet" line="Every start, send, change and signature is listed here." />;
  return (
    <ol aria-label="Activity" className="border-t border-wds-border">
      {activity.data.events.map((event) => {
        const link = event.link ? recordHref(event.link.kind, event.link.id) : null;
        return (
          <li key={event.id} className="grid grid-cols-[170px_1fr_220px] items-baseline gap-4 border-b border-wds-border px-1 py-3">
            <time dateTime={event.at} className="font-wds-mono text-[13px] text-wds-text-secondary">{dayAndClock(event.at)}</time>
            <p className="font-wds-sans text-[15px] leading-[22px] text-wds-text-ink">
              {event.sentence}
              {event.reason ? <span className="text-wds-text-secondary"> · {event.reason}</span> : null}
              {event.link ? <> · <DocLink href={link ?? undefined}>{event.link.reference}</DocLink></> : null}
            </p>
            <span className="text-right font-wds-sans text-[14px] text-wds-text-secondary">
              {event.actor.name} · {event.actor.roleLabel}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The file's Documents tab: the printed requisition, one version at approval and one after each approved addition (R5). */
export function DocumentsTab({ requisitionId, printHref, canPrint }: { requisitionId: string; printHref: string; canPrint: boolean }) {
  const docs = useLoader(`documents:${requisitionId}`, () => requisitionsApi.documents(requisitionId), 'Could not load the documents.');
  if (docs.status === 'error') return <ErrorState title="Couldn't load the documents" description="Check your connection and try again." onRetry={() => void docs.reload()} />;
  if (!docs.data) return <Loading />;
  if (docs.data.documents.length === 0) return <Empty title="No printed version yet" line="The requisition can be printed once it is approved." />;
  return (
    <ul aria-label="Documents" className="border-t border-wds-border">
      {docs.data.documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-4 border-b border-wds-border px-1 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-sans text-[15px] font-medium text-wds-text-ink">{doc.label}</span>
            <span className="font-wds-sans text-[14px] text-wds-text-secondary">
              Version {doc.version} · {dayAndClock(doc.at)} · {doc.by.name}
            </span>
          </div>
          {canPrint ? (
            <Link href={`${printHref}?version=${doc.version}`} target="_blank" className="font-wds-sans text-[14px] text-wds-text-ink underline underline-offset-2 outline-none focus-visible:shadow-wds-ring">
              Print<span className="sr-only"> version {doc.version}</span>
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
