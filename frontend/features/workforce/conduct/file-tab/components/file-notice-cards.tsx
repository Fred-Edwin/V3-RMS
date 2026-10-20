import Link from 'next/link';

import { cn } from '@/lib/cn';

import { StatusText } from '../../../_shared';
import { dayMonthYear } from '../../_shared/lib/conduct-dates';
import { deskTone } from '../../_shared/lib/conduct-words';
import { deskDocumentHref, deskNoticeHref } from '../../_shared/lib/routes';
import type { FileTab } from '../../_shared/types/conduct-types';

/**
 * One card per notice on the file (spec S14; Paper 1HGH-0): a 3 px bar (amber for the live one, grey for the rest), the level and what it
 * was about, its status word, a mono line with the dates and who issued it, and a link to the letter where one exists. Nothing is deleted:
 * a replaced or ended notice stays here, marked. The people who read this tab are allowed to see who issued it, so the role is in the line.
 */
export function FileNoticeCards({ notices }: { notices: FileTab['notices'] }) {
  return (
    <ul aria-label="Notices on this file" className="m-0 flex list-none flex-col gap-3 p-0">
      {notices.map((n) => (
        <li key={n.id} className={cn('flex flex-col gap-1.5 border border-wds-border border-l-[3px] bg-wds-surface px-4 py-3.5', n.live ? 'border-l-wds-caramel-600' : 'border-l-wds-border-strong bg-wds-neutral-50')}>
          <div className="flex items-baseline justify-between gap-3">
            <Link href={deskNoticeHref(n.id)} className="font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-wds-ring">
              {n.title} · {n.aboutLabel}
            </Link>
            <StatusText tone={deskTone(n.status)}>
              <span className="sr-only">Status: </span>
              {n.statusWord}
            </StatusText>
          </div>
          <p className="m-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">
            {dayMonthYear(n.issuedAt)} · issued by {n.issuerLabel} · ends {dayMonthYear(n.validUntil)}
          </p>
          {n.hasLetter ? (
            <Link href={deskDocumentHref(n.id)} className="w-fit font-wds-sans text-[13px] font-medium leading-4 text-wds-primary underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-wds-ring">
              Open the letter
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
