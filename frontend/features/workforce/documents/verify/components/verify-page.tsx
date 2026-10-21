'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';

import { useReport, useVerify } from '../hooks/use-verify';
import { reportLabel, reportedLabel, validHash, viewOf } from '../lib/verify-view';
import type { SignedInAnswer, VerifyView } from '../types/verify-types';

const BAR: Record<VerifyView['tone'], string> = { success: 'border-l-wds-success-fg', warning: 'border-l-wds-caramel-500', error: 'border-l-wds-error-fg', neutral: 'border-l-wds-neutral-400' };
const KICKER: Record<VerifyView['tone'], string> = { success: 'text-wds-success-fg', warning: 'text-wds-warning-fg', error: 'text-wds-error-fg', neutral: 'text-wds-text-secondary' };
const BUTTON = 'flex h-12 w-full items-center justify-center font-wds-sans text-[15px] font-semibold leading-5 focus-visible:outline-none focus-visible:shadow-wds-ring';

/**
 * What the QR on a printed document opens (6c D3). Public: no shell, no sign-in, one column, phone first, works at 320 wide and 200 %
 * type. It shows the verdict and the facts already printed on the copy (type, number, period) plus role and date, and nothing else: no
 * name of an employee, no site, no figure, no head count. The kicker words carry the verdict, so colour is never the only signal.
 * It never echoes the query string and never shows the hash.
 */
export function VerifyPage({ kind, number }: { kind: string; number: string }) {
  const search = useSearchParams();
  const raw = search.get('h');
  const h = raw && raw.length <= 40 ? raw : null;
  const { state, retry, user } = useVerify(kind, number, h);
  const report = useReport(kind, number, validHash(h) ? h : null);
  const heading = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (state.status !== 'checking') heading.current?.focus();
  }, [state.status]);

  let card: React.ReactNode;
  if (state.status === 'checking') {
    card = (
      <div role="status" aria-busy="true" className="border border-wds-border border-l-[3px] border-l-wds-neutral-300 bg-wds-surface p-5">
        <p className="m-0 font-wds-sans text-[16px] leading-5 text-wds-text-secondary">Checking…</p>
      </div>
    );
  } else if (state.status !== 'done') {
    card = (
      <div role="alert" ref={heading} tabIndex={-1} className="flex flex-col gap-3 border border-wds-border border-l-[3px] border-l-wds-error-fg bg-wds-surface p-5 outline-none">
        <p className="m-0 font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-error-fg">{state.status === 'offline' ? 'NO SIGNAL' : 'COULD NOT CHECK'}</p>
        <p className="m-0 font-wds-sans text-[16px] leading-[22px] text-wds-text-ink">{state.status === 'offline' ? 'No signal. A check needs a connection.' : 'We could not check this copy just now. Nothing was changed.'}</p>
        <button type="button" onClick={retry} className={cn(BUTTON, 'bg-wds-primary text-wds-primary-fg')}>Try again</button>
      </div>
    );
  } else {
    const signedAnswer = 'canOpen' in state.answer ? (state.answer as SignedInAnswer) : null;
    const view = viewOf(state.answer, kind, user ? { name: user.name, role: user.role } : null);
    const documentLink = state.answer.number ? `/app/workforce/audit-log?tab=documents&doc=${state.answer.number}.${state.answer.version ?? 1}` : '/app/workforce';
    card = (
      <>
        <section ref={heading} tabIndex={-1} role="status" aria-label={view.title} className={cn('flex flex-col gap-2 border border-wds-border border-l-[3px] bg-wds-surface p-5 outline-none', BAR[view.tone])}>
          <p className={cn('m-0 font-wds-mono text-[10px] leading-3 tracking-[0.08em]', KICKER[view.tone])}>{view.kicker}</p>
          <h1 className="m-0 font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink">{view.title}</h1>
          <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">{view.text}</p>
        </section>
        {view.rows.length > 0 ? (
          <dl className="m-0 flex flex-col border border-wds-border bg-wds-surface px-5">
            {view.rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-wds-neutral-100 py-3 last:border-b-0">
                <dt className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{r.label}</dt>
                <dd className="m-0 text-right font-wds-sans text-[13px] leading-4 text-wds-text-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {view.action === 'signin' ? (
          <Link href={`/login?next=${encodeURIComponent(documentLink)}`} className={cn(BUTTON, 'bg-wds-primary text-wds-primary-fg')}>Sign in to open the document</Link>
        ) : null}
        {view.action === 'open' && signedAnswer?.canOpen ? <Link href={documentLink} className={cn(BUTTON, 'bg-wds-primary text-wds-primary-fg')}>Open the document</Link> : null}
        {view.action === 'home' ? <Link href="/app/workforce" className={cn(BUTTON, 'border border-wds-border-strong text-wds-text-ink')}>Go to Home</Link> : null}
        {view.action === 'report' && validHash(h) ? (
          report.status === 'told' ? (
            <p role="status" className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">{reportedLabel(kind)}</p>
          ) : (
            <>
              <button type="button" disabled={report.status === 'busy'} onClick={() => void report.send()} className={cn(BUTTON, 'border border-wds-border-strong text-wds-text-ink disabled:opacity-60')}>{reportLabel(kind)}</button>
              {report.status === 'failed' ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-5 text-wds-error-fg">We could not send that. Check your signal and try again.</p> : null}
            </>
          )
        ) : null}
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-wds-canvas">
      <header className="bg-wds-sidebar-top px-4 py-4">
        <p className="m-0 font-wds-sans text-[15px] font-semibold leading-5 text-white">Wendo RMS · Check a document</p>
      </header>
      <main className="mx-auto flex w-full max-w-[480px] flex-col gap-3 px-4 py-5">
        {card}
        <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">This page shows no amounts or personal details. Only people allowed to read the document can open it.</p>
      </main>
    </div>
  );
}
