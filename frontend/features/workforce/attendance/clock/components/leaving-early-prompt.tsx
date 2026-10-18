'use client';

import * as React from 'react';

import { Callout, OptionList, PhoneButton, PhonePrompt } from '../../../_shared';
import { hmOf } from '../../_shared/lib/nairobi-clock';
import type { MyEntry } from '../../_shared/types/attendance-types';
import { EARLY_LEAVE_OPTIONS } from '../lib/clock-copy';

/** "2 H 40 MIN" for the kicker, from minutes. */
const kickerSpan = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} H ${m} MIN` : `${m} MIN`;
};

/**
 * Leaving early asks why (Paper Chapter 6 step 4): a clock-out before the scheduled end needs one of the four reasons. "Clocked out by
 * mistake" is not a request here (slice 4): the Undo banner and the closing line say where to go.
 */
export function LeavingEarlyPrompt({
  entry,
  nowMs,
  busy,
  error,
  onClockOut,
  onBack,
}: {
  entry: MyEntry;
  nowMs: number;
  busy: boolean;
  error: string | null;
  onClockOut: (reasonCode: string) => void;
  onBack: () => void;
}) {
  const [reason, setReason] = React.useState<string | null>(null);
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    root.current?.querySelector<HTMLElement>('input')?.focus();
  }, []);
  const minutesLeft = Math.max(1, Math.ceil((Date.parse(entry.endsAt) - nowMs) / 60000));
  return (
    <div ref={root} role="dialog" aria-modal="true" aria-label="Leaving early" className="fixed inset-0 z-50 overflow-y-auto bg-wds-surface">
      <PhonePrompt
        kicker={`${hmOf(nowMs)} · ${kickerSpan(minutesLeft)} BEFORE YOUR SHIFT ENDS`}
        title="Leaving early?"
        body={`Your shift runs to ${entry.endTime}. Tell us why and we will let your manager know.`}
        actions={
          <>
            <PhoneButton size="lg" disabled={busy || reason === null} onClick={() => reason && onClockOut(reason)}>
              Clock out
            </PhoneButton>
            <PhoneButton kind="outlined" size="sm" onClick={onBack} disabled={busy}>
              Back to work
            </PhoneButton>
          </>
        }
      >
        <OptionList legend="Why are you leaving early?" options={EARLY_LEAVE_OPTIONS} value={reason} onChange={setReason} />
        {error ? <Callout tone="error">{error}</Callout> : null}
      </PhonePrompt>
    </div>
  );
}
