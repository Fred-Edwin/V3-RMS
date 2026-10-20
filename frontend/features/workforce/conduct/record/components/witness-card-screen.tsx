'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { SetPinForm } from '@/components/app/shell/set-pin-form';
import { usePinStatus } from '@/hooks/usePinStatus';

import { PhoneButton, PhoneScreen, PIN_LENGTH, PinField, useRemote } from '../../../_shared';
import { LoadingBlock, ProblemBlock } from '../../_shared/components/problem-block';
import { useOnline } from '../../_shared/hooks/use-online';
import { useSignedAct } from '../../_shared/hooks/use-signed-act';
import { shortDay } from '../../_shared/lib/conduct-dates';
import { NOT_SIGNED_WORDS } from '../../_shared/lib/conduct-words';
import { conductReads, conductWrites } from '../../_shared/services/conduct-services';

/**
 * Confirm what you saw (spec S11, "witness confirm card"; not drawn in Paper, built in the Sign screen's style). The witness sees one fact:
 * a manager's role, the person's role, what happened and the date. Never the reason, the facts or the letter. Confirming needs the witness's
 * own code; "This is not right" needs none. Either way the notice stays valid; HR and the manager are told if it is not confirmed.
 */
export function WitnessCardScreen({ id }: { id: string }) {
  const router = useRouter();
  const online = useOnline();
  const card = useRemote(() => conductReads.witnessCard(id), `conduct-witness:${id}`);
  const pinStatus = usePinStatus(true);
  const act = useSignedAct();
  const [pin, setPin] = React.useState('');
  const [answered, setAnswered] = React.useState<'CONFIRMED' | 'DECLINED' | null>(null);
  const data = card.data;
  const settled = answered ?? data?.answered ?? null;

  const answer = async (confirmed: boolean): Promise<void> => {
    const result = await act.run(() => conductWrites.witness(id, confirmed ? { confirmed, code: pin } : { confirmed }));
    if (result.ok) setAnswered(result.value.answered);
    else setPin('');
  };
  const ready = pin.length === PIN_LENGTH && !act.busy && act.wait === 0 && online;

  return (
    <PhoneScreen screen="Conduct" kicker="CONFIRM" back="/app/inbox" heading="Confirm what you saw" desktopTitle="Confirm what you saw">
      {card.status === 'loading' ? <LoadingBlock label="Loading the request" rows={2} /> : null}
      {card.status === 'error' && !data ? <ProblemBlock error={card.error} what="this request" onRetry={card.reload} /> : null}
      {data && settled ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="m-0 border border-wds-border bg-wds-neutral-50 px-4 py-3 font-wds-sans text-[14px] leading-5 text-wds-text-ink">
            {settled === 'CONFIRMED' ? 'You confirmed this. Thank you.' : 'You said this is not right. The manager and HR have been told.'}
          </p>
          <PhoneButton kind="outlined" onClick={() => router.push('/app/inbox')}>Back to my Inbox</PhoneButton>
        </div>
      ) : null}
      {data && !settled ? (
        <div className="flex flex-col gap-4">
          <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">
            A {data.issuerRole} told you that a {data.personRole} {NOT_SIGNED_WORDS[data.reason]} on {shortDay(data.date)}. Confirm only if this is true.
          </p>
          {pinStatus.hasPin === false ? (
            <div className="flex flex-col gap-3">
              <h2 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">Choose your code</h2>
              <SetPinForm layout="stacked" submitLabel="Choose code and continue" onDone={() => pinStatus.markSet()} />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="font-wds-sans text-[12px] font-semibold leading-4 text-wds-text-ink">Your code</span>
              <PinField value={pin} onChange={setPin} label="Your code" invalid={act.problem?.kind === 'wrong'} disabled={act.busy || pinStatus.loading} />
              <p role="alert" className="m-0 min-h-4 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{act.problem ? act.problem.message : ''}</p>
              {act.wait > 0 ? <p aria-live="polite" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">Wait {act.wait} seconds, then try again.</p> : null}
            </div>
          )}
          <PhoneButton onClick={() => void answer(true)} disabled={!ready || pinStatus.hasPin === false}>
            {act.busy ? 'Confirming…' : 'Confirm'}
          </PhoneButton>
          <PhoneButton kind="outlined" onClick={() => void answer(false)} disabled={act.busy || !online}>
            This is not right
          </PhoneButton>
          {!online ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">No signal. Your answer was not sent. Try again when you are back online.</p> : null}
          <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">You are not shown the reason for the notice. The notice stays valid whichever you choose.</p>
        </div>
      ) : null}
    </PhoneScreen>
  );
}
