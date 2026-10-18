'use client';

import * as React from 'react';
import Link from 'next/link';

import { Callout, ChoiceChips, OptionList, PhoneButton, PhonePrompt } from '../../../_shared';
import type { Leftover, MyEntry } from '../../_shared/types/attendance-types';
import { STAY_ON_ESTIMATES, STAY_ON_OPTIONS, leftoverWords } from '../lib/clock-copy';
import { hoursAndMinutes } from '../../_shared/lib/nairobi-clock';

/**
 * The shift-end prompt (Paper Chapter 6 steps 3 and 6): full screen once the scheduled end has passed. "Finish now" is the clock-out;
 * "Stay on" asks why in one tap. What is left in the person's own job is shown but never stops them finishing. Unanswered, the phone
 * closes the shift at its end after the rule's minutes (the card says so).
 */

export function ShiftEndPrompt({
  entry,
  firstName,
  workedMinutes,
  leftovers,
  autoCloseMinutes,
  busy,
  error,
  onFinish,
  onStayOn,
}: {
  entry: MyEntry;
  firstName: string;
  /** The rule's wait before an unanswered prompt closes the shift. */
  autoCloseMinutes: number;
  workedMinutes: number;
  leftovers: readonly Leftover[];
  busy: boolean;
  error: string | null;
  onFinish: () => void;
  onStayOn: (reasonCode: string, estimateMinutes: 15 | 30 | 60 | undefined) => void;
}) {
  const [step, setStep] = React.useState<'ask' | 'why'>('ask');
  const [reason, setReason] = React.useState<string | null>(null);
  const [estimate, setEstimate] = React.useState<string | null>(null);
  const first = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    first.current?.querySelector<HTMLElement>('button, input')?.focus();
  }, [step]);

  const words = leftovers.flatMap((l) => {
    const w = leftoverWords(l);
    return [w];
  });
  const handOver = words.find((w) => w.handOver)?.handOver;

  return (
    <div ref={first} role="dialog" aria-modal="true" aria-label="Your shift has ended" className="fixed inset-0 z-50 overflow-y-auto bg-wds-surface">
      {step === 'ask' ? (
        <PhonePrompt
          kicker={`${entry.endTime} · SHIFT END`}
          title={`Your shift has ended, ${firstName}`}
          body={`You worked ${hoursAndMinutes(workedMinutes)} today. Before you go:`}
          actions={
            <>
              {handOver ? (
                <>
                  <Link href={handOver.href} className="flex h-[52px] w-full items-center justify-center bg-wds-primary font-wds-sans text-[16px] font-semibold leading-5 text-wds-primary-fg">
                    {handOver.label}
                  </Link>
                  <PhoneButton kind="outlined" size="sm" onClick={onFinish} disabled={busy}>
                    Finish now anyway
                  </PhoneButton>
                </>
              ) : (
                <PhoneButton size="lg" onClick={onFinish} disabled={busy}>
                  Finish now
                </PhoneButton>
              )}
              <PhoneButton kind="outlined" onClick={() => setStep('why')} disabled={busy}>
                Stay on
              </PhoneButton>
            </>
          }
        >
          {words.map((w) => (
            <Callout key={w.title} tone="warning" title={w.title}>
              {w.detail}
            </Callout>
          ))}
          {error ? <Callout tone="error">{error}</Callout> : null}
          <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">If you do not answer in {autoCloseMinutes} minutes, your shift closes at {entry.endTime} and your manager is told.</p>
        </PhonePrompt>
      ) : (
        <PhonePrompt
          kicker="STAYING ON"
          title="Why are you staying?"
          body="One tap. Your manager sees this when they check overtime."
          actions={
            <>
              <PhoneButton
                size="lg"
                disabled={busy || reason === null}
                onClick={() => reason && onStayOn(reason, estimate ? (Number(estimate) as 15 | 30 | 60) : undefined)}
              >
                Stay on
              </PhoneButton>
              <PhoneButton kind="outlined" size="sm" onClick={() => setStep('ask')} disabled={busy}>
                Back
              </PhoneButton>
            </>
          }
        >
          <OptionList legend="Why are you staying?" options={STAY_ON_OPTIONS} value={reason} onChange={setReason} />
          <ChoiceChips legend="About how long?" legendStyle="sentence" options={STAY_ON_ESTIMATES} value={estimate} onChange={setEstimate} size="sm" />
          {error ? <Callout tone="error">{error}</Callout> : null}
          <p className="m-0 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">
            Overtime is paid only after your manager approves it. If you do not answer in {autoCloseMinutes} minutes your shift closes at {entry.endTime} and is flagged for your manager.
          </p>
        </PhonePrompt>
      )}
    </div>
  );
}
