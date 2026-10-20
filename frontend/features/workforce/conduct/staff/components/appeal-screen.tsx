'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Textarea } from '@/components/ui2/textarea';

import { FIELD_CLASS, FormField, OptionList, PhoneButton, PhoneScreen, useRemote } from '../../../_shared';
import { LoadingBlock, ProblemBlock } from '../../_shared/components/problem-block';
import { useOnline } from '../../_shared/hooks/use-online';
import { useSessionDraft } from '../../_shared/hooks/use-session-draft';
import { useSignedAct } from '../../_shared/hooks/use-signed-act';
import { APPEAL_TEXT_MAX, APPEAL_TEXT_MIN, appealChips } from '../../_shared/lib/conduct-words';
import { staffNoticeHref, STAFF_HOME } from '../../_shared/lib/routes';
import { conductReads, conductWrites } from '../../_shared/services/conduct-services';
import type { AppealReasonKey } from '../../_shared/types/conduct-types';
import { appealProblem } from '../lib/appeal-rules';

/**
 * Appeal (spec S6; Paper 1GX7-0 right). One chip and a written reason, 10 to 1,000 characters; no code, because an appeal is the person's
 * own act inside their own login. After the days it is a plain line with no form. Unsent text is kept for the visit. A second appeal and a
 * closed window are shown in the spec's words, not as a failure.
 */
export function AppealScreen({ id }: { id: string }) {
  const router = useRouter();
  const online = useOnline();
  const notice = useRemote(() => conductReads.detail(id), `conduct-appeal:${id}`);
  const act = useSignedAct();
  const [reasonKey, setReasonKey] = React.useState<AppealReasonKey | null>(null);
  const [text, setText, clearText] = useSessionDraft(`conduct.appeal.${id}`);
  const [sent, setSent] = React.useState(false);
  const detail = notice.data && notice.data.view === 'STAFF' ? notice.data : null;

  const problem = appealProblem(reasonKey, text);
  const send = async () => {
    if (!reasonKey) return;
    const result = await act.run((idempotencyKey) => conductWrites.appeal(id, { reasonKey, text: text.trim(), idempotencyKey }));
    if (result.ok) {
      clearText();
      setSent(true);
    }
  };

  const closedLine = detail ? (detail.appeal ? 'You have already appealed this notice.' : !detail.actions.canAppeal ? `The ${detail.appealDays} days to appeal have ended. Speak to HR.` : null) : null;
  const chips = appealChips(detail?.aboutLabel ?? '');

  return (
    <PhoneScreen screen="Conduct" kicker={`APPEAL${detail?.number ? ` · ${detail.number}` : ''}`} back={detail ? staffNoticeHref(id) : STAFF_HOME} heading={sent ? undefined : 'Why do you disagree?'} desktopTitle="Appeal this notice">
      {notice.status === 'loading' ? <LoadingBlock label="Loading the notice" rows={2} /> : null}
      {notice.status === 'error' && !detail ? <ProblemBlock error={notice.error} what="this notice" onRetry={notice.reload} /> : null}
      {sent ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="m-0 border border-wds-success-border bg-wds-success-bg px-4 py-3 font-wds-sans text-[14px] leading-5 text-wds-success-fg">
            Sent to HR. You will be told here when HR decides.
          </p>
          <PhoneButton onClick={() => router.push(staffNoticeHref(id))}>Back to my notice</PhoneButton>
        </div>
      ) : null}
      {detail && !sent && closedLine ? (
        <div className="flex flex-col gap-4">
          <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">{closedLine}</p>
          <PhoneButton kind="outlined" onClick={() => router.push(staffNoticeHref(id))}>
            Back to my notice
          </PhoneButton>
        </div>
      ) : null}
      {detail && !sent && !closedLine ? (
        <div className="flex flex-col gap-4">
          <OptionList legend="Why do you disagree?" options={chips} value={reasonKey} onChange={(v) => setReasonKey(v as AppealReasonKey)} tick disabled={act.busy} />
          <FormField label="Tell HR what happened" hint="required" helper={text.length >= APPEAL_TEXT_MAX - 100 ? `${text.length} of ${APPEAL_TEXT_MAX}` : `At least ${APPEAL_TEXT_MIN} characters.`}>
            {(ids) => (
              <Textarea
                id={ids.id}
                aria-describedby={ids.describedBy}
                value={text}
                maxLength={APPEAL_TEXT_MAX}
                rows={5}
                disabled={act.busy}
                onChange={(e) => setText(e.target.value)}
                className={`${FIELD_CLASS} h-auto min-h-[120px] py-3 text-[14px] leading-5`}
              />
            )}
          </FormField>
          <p role="alert" className="m-0 min-h-4 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
            {act.problem?.message ?? ''}
          </p>
          <PhoneButton onClick={send} disabled={problem !== null || act.busy || !online} aria-describedby="appeal-reason">
            {act.busy ? 'Sending…' : 'Send to HR'}
          </PhoneButton>
          <p id="appeal-reason" className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">
            {!online ? 'No signal. Your appeal was not sent. Try again when you are back online.' : (problem ?? 'HR decides, not your manager. The notice stays as it is until HR answers. You will be told here.')}
          </p>
        </div>
      ) : null}
    </PhoneScreen>
  );
}
