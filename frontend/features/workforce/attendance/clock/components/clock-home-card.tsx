'use client';

import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { Callout, ClockCard, PhoneButton } from '../../../_shared';
import { dateOf, dayWords, hmOf } from '../../_shared/lib/nairobi-clock';
import type { MyDay } from '../../_shared/types/attendance-types';
import { useClockActions } from '../hooks/use-clock-actions';
import { useServerNow } from '../hooks/use-my-day';
import { CLOCK_COPY } from '../lib/clock-copy';
import { clockCardModel } from '../lib/clock-view';
import { ClosedNotices, HeadsUpNote, ReportProblemLink, UndoNote, WaitingToSend } from './clock-notes';
import { LeavingEarlyPrompt } from './leaving-early-prompt';
import { ShiftEndPrompt } from './shift-end-prompt';

/**
 * The clock card on the staff phone Home (Paper Chapter 6, card 01): one tap in and out, the two-minute Undo, the heads-up before the
 * end, and the two full-screen questions (leaving early, and the shift-end prompt). It only exists for a person on a branch whose new
 * clock is switched on (the card's data hook says so); everything it shows comes from "my day" and the server's own clock.
 */

export function ClockHomeCard({ day, reload }: { day: MyDay; reload: () => void }) {
  const user = useAuthStore((s) => s.user);
  const nowMs = useServerNow(Date.parse(day.serverNow) - Date.now(), true);
  const actions = useClockActions(reload);
  const [leaving, setLeaving] = React.useState(false);
  const entry = day.current;
  const firstName = (user?.name ?? '').split(/\s+/)[0] ?? '';
  const site = day.organizationName ?? 'your branch';

  // The prompt shows the moment the end passes; ask the server at once so the leftovers and the real state arrive without the 30 s wait.
  const promptAhead = entry?.state === 'ON_SHIFT' && nowMs >= Date.parse(entry.endsAt);
  React.useEffect(() => {
    if (promptAhead) reload();
  }, [promptAhead, reload]);

  if (!entry) {
    return (
      <div className="flex flex-col gap-3.5">
        <WaitingToSend queued={actions.queued} site={site} notSaved={actions.notSaved} />
        <ClosedNotices notices={day.notices} />
      </div>
    );
  }

  const model = clockCardModel(entry, day, nowMs);
  const workedMinutes = Math.floor((entry.clockedInAt ? entry.secondsOnShift + Math.max(0, (nowMs - Date.parse(day.serverNow)) / 1000) : 0) / 60);
  const headsUpMinutes = Math.max(1, Math.ceil((Date.parse(entry.endsAt) - nowMs) / 60000));
  const next = model.phase === 'DONE' || model.phase === 'AUTO_CLOSED' || model.phase === 'MISSED' ? day.next : null;

  const clockOut = (): void => {
    if (model.phase === 'ON' || model.phase === 'HEADS_UP') setLeaving(true);
    else void actions.clockOut(entry.entryId);
  };

  const buttons =
    model.action === 'CLOCK_IN' ? (
      <PhoneButton disabled={actions.busy || model.clockInWaits} onClick={() => void actions.clockIn(entry.entryId)}>
        Clock in
      </PhoneButton>
    ) : model.action === 'CLOCK_OUT' ? (
      <PhoneButton kind="brownOutline" disabled={actions.busy} onClick={clockOut}>
        Clock out
      </PhoneButton>
    ) : undefined;

  return (
    <div className="flex flex-col gap-3.5">
      <WaitingToSend queued={actions.queued} site={site} notSaved={actions.notSaved} />
      <ClockCard
        shiftLabel={model.shiftLabel}
        statusLabel={model.statusLabel}
        statusTone={model.statusTone}
        timer={model.timer}
        caption={model.caption}
        progress={model.progress}
        actions={buttons}
        helper={model.action === 'CLOCK_IN' ? CLOCK_COPY.locationNote(site) : next ? `Next shift: ${dayWords(next.date)} · ${next.templateName} ${next.startTime} to ${next.endTime}.` : undefined}
      />
      {actions.error && !leaving && model.phase !== 'PROMPT' ? <Callout tone="error">{actions.error}</Callout> : null}
      <UndoNote entry={entry} nowMs={nowMs} busy={actions.busy} onUndo={() => void actions.undo()} />
      {model.phase === 'HEADS_UP' ? <HeadsUpNote entry={entry} minutes={headsUpMinutes} /> : null}
      <ClosedNotices notices={day.notices} />
      {entry.clockedOutAt && model.phase === 'DONE' ? (
        <p className="m-0 px-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          Clocked out at {hmOf(entry.clockedOutAt)} by mistake?{' '}
          <ReportProblemLink date={dateOf(entry.clockedOutAt)} className="font-medium text-wds-primary underline underline-offset-2">
            Report a problem
          </ReportProblemLink>
        </p>
      ) : null}

      {leaving ? (
        <LeavingEarlyPrompt
          entry={entry}
          nowMs={nowMs}
          busy={actions.busy}
          error={actions.error}
          onBack={() => setLeaving(false)}
          onClockOut={(reason) => void actions.clockOut(entry.entryId, reason).then((ok) => ok && setLeaving(false))}
        />
      ) : null}
      {model.phase === 'PROMPT' ? (
        <ShiftEndPrompt
          entry={entry}
          firstName={firstName}
          workedMinutes={workedMinutes}
          leftovers={day.leftovers}
          autoCloseMinutes={day.rules?.autoCloseAfterMinutes ?? 15}
          busy={actions.busy}
          error={actions.error}
          onFinish={() => void actions.clockOut(entry.entryId)}
          onStayOn={(reasonCode, estimateMinutes) => void actions.stayOn({ rotaEntryId: entry.entryId, answer: 'STAY_ON', reasonCode, ...(estimateMinutes ? { estimateMinutes } : {}) })}
        />
      ) : null}
    </div>
  );
}
