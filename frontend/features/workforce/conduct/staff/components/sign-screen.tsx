'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { SetPinForm } from '@/components/app/shell/set-pin-form';
import { usePinStatus } from '@/hooks/usePinStatus';

import { PhoneButton, PhoneScreen, PIN_LENGTH, PinField, useRemote } from '../../../_shared';
import { LoadingBlock, ProblemBlock } from '../../_shared/components/problem-block';
import { useOnline } from '../../_shared/hooks/use-online';
import { useSignedAct } from '../../_shared/hooks/use-signed-act';
import { deviceId } from '../../_shared/lib/device-and-keys';
import { staffNoticeHref, STAFF_HOME } from '../../_shared/lib/routes';
import { conductReads, conductWrites } from '../../_shared/services/conduct-services';
import type { StaffDetail } from '../../_shared/types/conduct-types';

/** "Friday 16 October" is not on the staff detail; the appeal step's line starts "Until Fri 16 Oct", which is enough. */
function appealUntil(detail: StaffDetail): string | null {
  const line = detail.steps.find((s) => s.key === 'appeal' && s.state === 'current')?.line;
  return line ? (line.split(' · ')[0]?.replace(/^Until /, '') ?? null) : null;
}

/**
 * Sign that you received this notice (spec S5; Paper 1GX7-0 left). The person's own code, four digits. The fourth digit only enables
 * Sign; Enter never signs, only the button does. A wrong code clears the field and says so; a paused code shows the seconds to wait and is
 * never a lockout. No code set yet: the shell's "Choose your code" form comes first. Already signed (another tab): the screen says so.
 */
export function SignScreen({ id }: { id: string }) {
  const router = useRouter();
  const online = useOnline();
  const notice = useRemote(() => conductReads.detail(id), `conduct-sign:${id}`);
  const pinStatus = usePinStatus(true);
  const act = useSignedAct();
  const [pin, setPin] = React.useState('');
  const [done, setDone] = React.useState<'signed' | 'already' | null>(null);
  const fieldRef = React.useRef<HTMLDivElement>(null);

  const detail = notice.data && notice.data.view === 'STAFF' ? notice.data : null;
  const kicker = `SIGN${detail?.number ? ` · ${detail.number}` : ''}`;
  const back = detail ? staffNoticeHref(id) : STAFF_HOME;

  const sign = async () => {
    const result = await act.run((idempotencyKey) => conductWrites.sign(id, { code: pin, deviceId: deviceId(), idempotencyKey }));
    if (result.ok) {
      const value = result.value as { alreadySigned?: boolean } | null;
      setDone(value?.alreadySigned ? 'already' : 'signed');
      return;
    }
    setPin('');
    window.setTimeout(() => fieldRef.current?.querySelector('input')?.focus(), 0);
  };

  const until = detail ? appealUntil(detail) : null;
  const waiting = act.wait > 0;
  const reason = !online ? 'No signal. Your notice was not signed. Try again when you are back online.' : waiting ? `Wait ${act.wait} seconds, then try again.` : null;
  const ready = pin.length === PIN_LENGTH && !act.busy && !waiting && online;

  return (
    <PhoneScreen screen="Conduct" kicker={kicker} back={back} heading={done ? undefined : 'Sign that you received this notice'} desktopTitle="Sign this notice">
      {notice.status === 'error' && !detail ? <ProblemBlock error={notice.error} what="this notice" onRetry={notice.reload} /> : null}
      {notice.status === 'loading' ? <LoadingBlock label="Loading the notice" rows={2} /> : null}
      {notice.data && !detail ? <ProblemBlock error={{ message: 'Not yours', status: 404, code: 'NOT_FOUND' }} what="this notice" onRetry={notice.reload} /> : null}
      {detail && done ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="m-0 border border-wds-success-border bg-wds-success-bg px-4 py-3 font-wds-sans text-[14px] leading-5 text-wds-success-fg">
            {done === 'already' ? 'You already signed this notice.' : 'Signed. Your manager and HR have been told.'}
          </p>
          <PhoneButton onClick={() => router.push(staffNoticeHref(id))}>Back to my notice</PhoneButton>
        </div>
      ) : null}
      {detail && !done && !detail.actions.canSign ? (
        <div className="flex flex-col gap-4">
          <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">This notice cannot be signed now.</p>
          <PhoneButton kind="outlined" onClick={() => router.push(staffNoticeHref(id))}>
            Back to my notice
          </PhoneButton>
        </div>
      ) : null}
      {detail && !done && detail.actions.canSign && pinStatus.hasPin === false ? (
        <div className="flex flex-col gap-3">
          <h2 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">Choose your code</h2>
          <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">You have not chosen a code yet. Choose 4 digits, then you can sign.</p>
          <SetPinForm layout="stacked" submitLabel="Choose code and continue" onCancel={() => router.push(staffNoticeHref(id))} onDone={() => pinStatus.markSet()} />
        </div>
      ) : null}
      {detail && !done && detail.actions.canSign && pinStatus.hasPin !== false ? (
        <div className="flex flex-col gap-4">
          <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">
            This shows you were given the letter. It does not mean you agree with it{until ? `, and you can still appeal until ${until}` : ''}.
          </p>
          <div ref={fieldRef} className="flex flex-col gap-1.5">
            <span id="sign-code-label" className="font-wds-sans text-[12px] font-semibold leading-4 text-wds-text-ink">
              Your code
            </span>
            <PinField value={pin} onChange={(v) => { setPin(v); if (act.problem?.kind === 'wrong') act.clear(); }} label="Your code" invalid={act.problem?.kind === 'wrong'} disabled={act.busy || pinStatus.loading} autoFocus />
            <p role="alert" aria-live="assertive" className="m-0 min-h-4 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
              {act.problem && act.problem.kind !== 'slowed' ? act.problem.message : ''}
            </p>
            <p aria-live="polite" className="m-0 min-h-4 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">
              {waiting ? `Wait ${act.wait} seconds, then try again.` : act.problem?.kind === 'slowed' ? act.problem.message : ''}
            </p>
          </div>
          <PhoneButton onClick={sign} disabled={!ready} aria-describedby="sign-reason">
            {act.busy ? 'Signing…' : 'Sign'}
          </PhoneButton>
          <p id="sign-reason" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            {reason ?? 'Your manager and HR are told that you signed. If you do not sign within the days given, your manager records that you were given the letter.'}
          </p>
        </div>
      ) : null}
    </PhoneScreen>
  );
}
