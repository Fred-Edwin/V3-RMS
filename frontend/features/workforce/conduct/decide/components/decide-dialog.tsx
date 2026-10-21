'use client';

import * as React from 'react';

import { Textarea } from '@/components/ui2/textarea';

import { DialogButton, FIELD_CLASS, FormField, KeyValueRows, KitDialog, RadioCards, useRemote } from '../../../_shared';
import { SigningPin } from '../../_shared/components/signing-pin';
import { useOnline } from '../../_shared/hooks/use-online';
import { useSignedAct } from '../../_shared/hooks/use-signed-act';
import { DECISION_REASON_MAX, OUTCOME_COPY } from '../../_shared/lib/conduct-words';
import { conductWrites } from '../../_shared/services/conduct-services';
import type { DecisionOutcome, DeskDetail } from '../../_shared/types/conduct-types';
import { decideBlock, decidePrint, decisionReasonLength, doneLine, outcomeOptions, previewRows, titleFor } from '../lib/decide-rules';

/**
 * Decide the appeal, or change a notice with no appeal (spec S13; Paper 1H7K-0). The options come from the server for this notice; the
 * rows beneath come from the server's preview of the chosen one. A reason (10 to 1,000 characters, which the staff member will read) and
 * the decider's PIN are needed, and the brown button carries the outcome's name. Two deciders at once: the second is told "just decided"
 * and nothing is changed. Enter never sends.
 */
export function DecideDialog({ detail, mode, onClose, onDone }: { detail: DeskDetail; mode: 'decide' | 'change'; onClose: () => void; onDone: (message: string) => void }) {
  const online = useOnline();
  const act = useSignedAct();
  const [outcome, setOutcome] = React.useState<DecisionOutcome | null>(null);
  const [reason, setReason] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [hasPin, setHasPin] = React.useState<boolean | null>(null);
  const [settled, setSettled] = React.useState<string | null>(null);

  const preview = useRemote(() => conductWrites.decisionPreview(detail.id, outcome ?? 'KEEP'), `conduct-preview:${detail.id}:${outcome}`, outcome !== null);
  const block = decideBlock({ outcome, reason, pin, online, hasPin });
  const options = outcomeOptions(detail.actions.outcomes);

  const code = act.problem?.code;
  React.useEffect(() => {
    if (code === 'ALREADY_DECIDED') setSettled('This appeal was just decided by HR. Nothing was changed.');
  }, [code]);

  const submit = async (): Promise<void> => {
    if (!outcome || block !== null) return;
    const result = await act.run((idempotencyKey) => conductWrites.decide(detail.id, { outcome, reason: reason.trim(), pin, idempotencyKey }));
    if (result.ok) onDone(doneLine);
    else setPin('');
  };

  return (
    <KitDialog
      plain
      open
      onOpenChange={(next) => (next ? undefined : settled ? onDone(settled) : onClose())}
      title={titleFor(detail, mode)}
      busy={act.busy}
      width={600}
      footer={
        settled ? (
          <DialogButton kind="primary" size="lg" onClick={() => onDone(settled)}>
            Close
          </DialogButton>
        ) : (
          <>
            <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={act.busy}>
              Cancel
            </DialogButton>
            <DialogButton kind="primary" size="lg" onClick={() => void submit()} disabled={block !== null || act.busy} aria-describedby="decide-block">
              {act.busy ? 'Deciding…' : outcome ? OUTCOME_COPY[outcome].button : 'Decide'}
            </DialogButton>
          </>
        )
      }
    >
      {settled ? (
        <p role="alert" className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-ink">{settled}</p>
      ) : (
        <>
          <RadioCards look="ink" legend="Outcome" options={options} value={outcome} onChange={(v) => setOutcome(v as DecisionOutcome)} disabled={act.busy} />
          <FormField label="Why? (the staff member will see this)" hint="required" helper={`At least 10 characters. ${decisionReasonLength(reason)} of ${DECISION_REASON_MAX}`}>
            {(ids) => <Textarea id={ids.id} aria-describedby={ids.describedBy} rows={3} maxLength={DECISION_REASON_MAX} value={reason} disabled={act.busy} onChange={(e) => setReason(e.target.value)} className={`${FIELD_CLASS} h-auto min-h-[84px] py-2.5 leading-5`} />}
          </FormField>
          {outcome && preview.data ? <KeyValueRows rows={previewRows(detail, preview.data)} aria-label="What this does" /> : null}
          {outcome && preview.status === 'error' && !preview.data ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">The preview did not load. You can still decide.</p> : null}
          <SigningPin active label="Your PIN, to sign this decision" value={pin} onChange={(v) => { setPin(v); if (act.problem?.kind === 'wrong') act.clear(); }} invalid={act.problem?.kind === 'wrong'} disabled={act.busy} error={act.problem?.kind === 'wrong' ? 'That PIN is not right.' : code === 'ALREADY_DECIDED' ? null : (act.problem?.message ?? null)} onStatus={setHasPin} />
          <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{decidePrint(mode)}</p>
          <p id="decide-block" aria-live="polite" className="m-0 min-h-4 pb-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{act.busy ? '' : (block ?? '')}</p>
        </>
      )}
    </KitDialog>
  );
}
