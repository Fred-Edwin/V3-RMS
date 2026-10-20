'use client';

import Link from 'next/link';

import { Callout, DialogButton } from '../../../_shared';
import { shortDay, shortDayTime } from '../../_shared/lib/conduct-dates';
import { plural } from '../../_shared/lib/conduct-words';
import { deskDocumentHref } from '../../_shared/lib/routes';
import type { DeskDetail } from '../../_shared/types/conduct-types';
import { FactsTable } from './facts-table';

/**
 * HR's appeal (spec S12; Paper 1GYE-0 right): who appeals which notice, the timesheet facts on the left, the reason given on the right,
 * and "Checked for you" computed by the server. Names carry their role. "Decide this appeal" appears only when the server says this reader
 * may decide it (HR; the Director for notices HR issued). An overdue appeal wears an amber tag.
 */
export function AppealPanel({ detail, onDecide }: { detail: DeskDetail; onDecide: () => void }) {
  const appeal = detail.appeal;
  if (!appeal) return null;
  const overdue = appeal.overdueDays > 0;
  return (
    <div className="flex flex-col gap-5 p-[22px]">
      <header className="flex flex-col gap-1.5">
        <h2 className="m-0 font-wds-sans text-[20px] font-semibold leading-[26px] tracking-[-0.02em] text-wds-text-ink">
          {detail.personName}, {detail.jobLabel} appeals {detail.number ?? detail.aboutLabel}
        </h2>
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
          {detail.title.split(' · ')[1] ?? ''} for {detail.aboutLabel.toLowerCase()}, issued {shortDay(detail.issuedAt)} by {detail.issuerLabel} · {detail.signedLine} · appeal {shortDayTime(appeal.appealedAt)}
        </p>
        {overdue ? (
          <span className="w-fit border border-wds-warning-border bg-wds-warning-bg px-2 py-0.5 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">Overdue by {plural(appeal.overdueDays, 'day')}</span>
        ) : null}
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="facts-heading" className="flex min-w-0 flex-col gap-2">
          <h3 id="facts-heading" className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">
            WHAT THE TIMESHEETS SAY
          </h3>
          {detail.facts ? <FactsTable rows={detail.facts.rows} totalMinutes={detail.facts.minutes} kind={detail.facts.kind} /> : <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">This notice carries no timesheet facts. The manager's own line: {detail.ownLine}</p>}
        </section>
        <section aria-labelledby="reason-heading" className="flex min-w-0 flex-col gap-2.5">
          <h3 id="reason-heading" className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">
            THE REASON GIVEN
          </h3>
          <div className="flex flex-col gap-1.5 border border-wds-border bg-wds-surface p-3.5">
            <p className="m-0 font-wds-sans text-[13px] font-semibold leading-[18px] text-wds-text-ink">{appeal.reasonLabel}</p>
            <blockquote className="m-0 whitespace-pre-wrap break-words font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{appeal.text}</blockquote>
          </div>
          {detail.checkedForYou.length > 0 ? (
            <Callout tone="warning" kicker="CHECKED FOR YOU">
              {detail.checkedForYou.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </Callout>
          ) : null}
        </section>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {detail.actions.canDecide ? (
          <DialogButton kind="primary" size="lg" onClick={onDecide}>
            Decide this appeal
          </DialogButton>
        ) : null}
        <Link
          href={deskDocumentHref(detail.id)}
          className="inline-flex h-[38px] items-center border border-wds-border-strong px-5 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring [@media(hover:hover)_and_(pointer:fine)]:hover:bg-wds-neutral-50"
        >
          Open the notice
        </Link>
      </div>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        Appeal waiting since {shortDayTime(appeal.appealedAt)} · a decision is due by {shortDay(appeal.dueBy)}
        {detail.actions.canDecide ? '' : ' · with HR to decide'}
      </p>
    </div>
  );
}
