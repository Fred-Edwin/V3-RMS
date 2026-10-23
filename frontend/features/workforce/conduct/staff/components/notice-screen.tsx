'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { Callout, CircleStepper, PhoneButton, PhoneScreen, useRemote } from '../../../_shared';
import { LoadingBlock, ProblemBlock } from '../../_shared/components/problem-block';
import { useLetterAction } from '../../_shared/hooks/use-letter-action';
import { useOnline } from '../../_shared/hooks/use-online';
import { shortDayTime } from '../../_shared/lib/conduct-dates';
import { appealHref, deskNoticeHref, signHref, staffDocumentHref, staffNoticeHref, STAFF_HOME } from '../../_shared/lib/routes';
import { conductFiles, conductReads } from '../../_shared/services/conduct-services';
import type { StaffDetail } from '../../_shared/types/conduct-types';
import { appealLine, decisionLine, fromLine, primaryAction, signStats, toCircleSteps } from '../lib/notice-view';
import { NoticesDesktop } from './notices-desktop';

const SMALL_PRINT =
  'Signing only shows you received the letter, not that you agree. You can appeal for {days} days from the day it was issued, signed or not. Talk to your manager first if you can; HR decides every appeal.';

function StatPair({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <dl aria-label="This notice at a glance" className="m-0 mt-3 flex gap-8 border-t border-[color-mix(in_oklab,var(--wds-sidebar-top)_70%,var(--wds-caramel-600))] pt-3">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-0.5">
          <dt className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-sidebar-fg-item">{s.label}</dt>
          <dd className="m-0 font-wds-mono text-[22px] leading-[26px] text-wds-sidebar-fg-active">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One notice for the person it is about (spec S2 and S4; Paper 2ZFG-0 right, 1GVP-0 right). The stepper comes from the server. While the
 * notice waits to be signed the page is the "before signing" layout: the header figures, the facts, the three buttons and the small print.
 * Afterwards it is the story with Download and, while the days last, Appeal. A verbal note has no letter, so it has no download.
 * A reader who is not the subject (a manager who followed an Inbox link) is sent to the desk view of the same notice.
 */
export function NoticeScreen({ id }: { id: string }) {
  const { matches: desktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  if (!hydrated) return null;
  // On a desktop a notice is not a page: the list with this notice chosen is (frame 13.11).
  return desktop ? <NoticesDesktop selectedId={id} /> : <PhoneNotice id={id} />;
}

function PhoneNotice({ id }: { id: string }) {
  const router = useRouter();
  const online = useOnline();
  const letter = useLetterAction();
  const notice = useRemote(() => conductReads.detail(id), `conduct-notice:${id}`);
  const detail = notice.data;

  React.useEffect(() => {
    if (detail && detail.view === 'DESK') router.replace(deskNoticeHref(id));
  }, [detail, id, router]);

  if (!detail || detail.view === 'DESK') {
    return (
      <PhoneScreen screen="Conduct" kicker="CONDUCT" back={STAFF_HOME} desktopTitle="Notice">
        {notice.status === 'error' ? <ProblemBlock error={notice.error} what="this notice" onRetry={notice.reload} /> : <LoadingBlock label="Loading the notice" />}
      </PhoneScreen>
    );
  }
  return <NoticeBody detail={detail} online={online} letter={letter} />;
}

function NoticeBody({ detail, online, letter }: { detail: StaffDetail; online: boolean; letter: ReturnType<typeof useLetterAction> }) {
  const router = useRouter();
  const toSign = detail.actions.canSign;
  const primary = primaryAction(detail);
  const tail = appealLine(detail);
  const decision = decisionLine(detail);
  const steps = toCircleSteps(detail).map((s) =>
    s.key === 'replaced' && detail.replacedById
      ? { ...s, action: <Link href={staffNoticeHref(detail.replacedById)} className="mt-0.5 font-wds-sans text-[12px] font-medium leading-4 text-wds-primary underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-wds-ring">See the new notice</Link> }
      : s
  );
  const download = () => letter.download(() => conductFiles.document(detail.id, 'latest', false), 'The notice could not be downloaded. Try again.');
  const kicker = `CONDUCT${detail.number ? ` · ${detail.number}` : ''}`;

  return (
    <PhoneScreen
      screen="Conduct"
      kicker={kicker}
      back={STAFF_HOME}
      title={toSign ? detail.title.split(' · ')[0] : detail.title}
      subtitle={toSign ? `From your ${detail.issuerRole} · ${shortDayTime(detail.issuedAt)}` : fromLine(detail)}
      aside={toSign ? <StatPair stats={signStats(detail)} /> : undefined}
      desktopTitle={detail.title}
    >
      {!online ? (
        <p role="status" className="m-0 border border-wds-warning-border bg-wds-warning-bg px-4 py-3 font-wds-sans text-[13px] leading-[19px] text-wds-warning-fg">
          No signal. Your notice needs a connection to open.
        </p>
      ) : null}
      {detail.factsLine || detail.verbalLine ? (
        <div className="flex flex-col gap-1 border border-wds-border bg-wds-neutral-100 p-4">
          <h2 className="m-0 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{detail.aboutLabel}</h2>
          <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{detail.verbalLine ?? detail.factsLine}</p>
        </div>
      ) : null}
      <CircleStepper steps={steps} label="Where this notice is" />
      {decision ? (
        <Callout tone="neutral" title={decision.title}>
          <span className="block">Reason: {decision.reason}</span>
          <span className="mt-1 block text-wds-text-secondary">{decision.by}</span>
        </Callout>
      ) : null}
      {letter.failed ? (
        <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {letter.failed}
        </p>
      ) : null}
      <div className="flex flex-col gap-2.5">
        {primary === 'sign' ? (
          <PhoneButton onClick={() => router.push(signHref(detail.id))} disabled={!online} aria-describedby={online ? undefined : 'offline-sign'}>
            Sign that I received it
          </PhoneButton>
        ) : null}
        {primary === 'download' ? (
          <PhoneButton onClick={download} disabled={letter.busy}>
            {letter.busy ? 'Preparing your notice' : 'Download signed notice'}
          </PhoneButton>
        ) : null}
        {toSign && detail.actions.canDownload ? (
          <PhoneButton kind="outlined" onClick={() => router.push(staffDocumentHref(detail.id))}>
            Read the full letter →
          </PhoneButton>
        ) : null}
        {!toSign && detail.actions.canDownload && primary === 'download' ? (
          <Link href={staffDocumentHref(detail.id)} className="self-center font-wds-sans text-[13px] font-medium leading-4 text-wds-primary underline underline-offset-2 focus-visible:outline-none focus-visible:shadow-wds-ring">
            Read the full letter
          </Link>
        ) : null}
        {detail.actions.canAppeal ? (
          <PhoneButton kind="outlined" className={toSign ? 'border-wds-error-fg text-wds-error-fg' : undefined} onClick={() => router.push(appealHref(detail.id))}>
            {toSign ? 'I do not agree · appeal to HR' : 'Appeal this notice'}
          </PhoneButton>
        ) : null}
        {!online && toSign ? (
          <p id="offline-sign" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">
            No signal. Your notice was not signed. Try again when you are back online.
          </p>
        ) : null}
        {tail ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{tail}</p> : null}
      </div>
      {toSign ? <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{SMALL_PRINT.replace('{days}', String(detail.appealDays))}</p> : null}
    </PhoneScreen>
  );
}
