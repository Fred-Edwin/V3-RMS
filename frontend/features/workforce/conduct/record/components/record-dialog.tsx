'use client';

import * as React from 'react';

import { ChoiceChips, DialogButton, KeyValueRows, KitDialog } from '../../../_shared';
import { SigningPin } from '../../_shared/components/signing-pin';
import { useOnline } from '../../_shared/hooks/use-online';
import { useSignedAct } from '../../_shared/hooks/use-signed-act';
import { shortDay } from '../../_shared/lib/conduct-dates';
import { conductWrites } from '../../_shared/services/conduct-services';
import type { DeskDetail, NotSignedReason } from '../../_shared/types/conduct-types';
import { defaultReason, keyRows, reasonChips, recordBlock, recordPrint } from '../lib/record-rules';
import { WitnessPicker } from './witness-picker';

/**
 * Record that the notice was not signed (spec S11; Paper 1HRW-0): what happened, a witness, the issuer's PIN. The notice stays in force.
 * Enter never sends. Signed a moment ago (409) closes the dialog and says so; already recorded says when. A person with no login has one
 * reason, chosen for you. The witness is told to confirm on their phone; if they do not, the notice stays valid and HR sees that.
 */
export function RecordDialog({ detail, onClose, onDone }: { detail: DeskDetail; onClose: () => void; onDone: (message: string) => void }) {
  const online = useOnline();
  const act = useSignedAct();
  const [reason, setReason] = React.useState<NotSignedReason | null>(defaultReason(detail));
  const [witnessId, setWitnessId] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState('');
  const [hasPin, setHasPin] = React.useState<boolean | null>(null);
  const [already, setAlready] = React.useState<string | null>(null);
  const block = recordBlock({ reason, witnessId, pin, online, hasPin });
  const name = detail.personName;

  const submit = async (): Promise<void> => {
    if (!reason || !witnessId || block !== null) return;
    const result = await act.run((idempotencyKey) => conductWrites.notSigned(detail.id, { reason, witnessId, pin, idempotencyKey }));
    if (result.ok) {
      onDone(`Recorded that ${name} did not sign. The notice stays in force.`);
      return;
    }
    setPin('');
  };
  // A race the server told us about closes or explains the dialog (spec S11).
  const code = act.problem?.code;
  React.useEffect(() => {
    if (code === 'ALREADY_SIGNED') onDone(`${name} signed a moment ago.`);
    if (code === 'ALREADY_RECORDED') setAlready('This was already recorded. Nothing was changed.');
  }, [code, name, onDone]);

  return (
    <KitDialog
      plain
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={`Record that ${name} did not sign`}
      description={`The notice was sent on ${shortDay(detail.issuedAt)} and has not been signed. The notice is still valid.`}
      busy={act.busy}
      width={540}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={act.busy}>
            Cancel
          </DialogButton>
          <DialogButton kind="primary" size="lg" onClick={() => void submit()} disabled={block !== null || act.busy || already !== null} aria-describedby="record-block">
            {act.busy ? 'Recording…' : 'Record it'}
          </DialogButton>
        </>
      }
    >
      {already ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{already}</p> : null}
      <ChoiceChips legend="What happened?" hint="required" options={reasonChips(detail)} value={reason} onChange={(v) => setReason(v as NotSignedReason)} disabled={act.busy} />
      <div className="flex flex-col gap-2">
        <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">A witness <span className="font-normal text-wds-text-secondary">required</span></span>
        <WitnessPicker noticeId={detail.id} value={witnessId} onChange={setWitnessId} disabled={act.busy} />
      </div>
      <KeyValueRows rows={keyRows(detail)} aria-label="What this does" />
      <SigningPin active label="Your PIN, to sign this record" value={pin} onChange={setPin} invalid={act.problem?.kind === 'wrong'} disabled={act.busy} error={act.problem?.kind === 'wrong' ? 'That PIN is not right.' : (act.problem?.message ?? null)} onStatus={setHasPin} />
      <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{recordPrint(detail)}</p>
      <p id="record-block" aria-live="polite" className="m-0 min-h-4 pb-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        {act.busy ? '' : (block ?? '')}
      </p>
    </KitDialog>
  );
}
