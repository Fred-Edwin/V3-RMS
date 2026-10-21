'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../../_shared';
import { useIdempotencyKey } from '../../../_shared/lib/idempotency';
import { leaveErrorText, waitingOn } from '../../../_shared/lib/leave-copy';
import { leaveWrites } from '../../../_shared/services/leave-services';

/** Cancel your own request (Step 3): no PIN, no reason. "Keep it" is the quiet way out; the brown button is the one action. */
export function CancelOwnDialog({ open, onOpenChange, id, decider, approved, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; id: string; decider: string | null; approved: boolean; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = useIdempotencyKey();
  React.useEffect(() => {
    if (open) {
      key.fresh();
      setError(null);
    }
    // `key.fresh` is stable; this resets the intent each time the dialog opens.
  }, [open, key]);

  const cancel = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await leaveWrites.cancelOwn(id, key.current());
      onOpenChange(false);
      onDone();
    } catch (err) {
      const e = leaveErrorText(err, 'Could not cancel. Nothing was changed. Try again.');
      setError(e.text);
      // Answered or started while the dialog was open: the screen reloads to show what happened.
      if (e.code === 'NOT_CANCELLABLE' || e.code === 'ALREADY_DECIDED') onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <KitDialog
      open={open}
      onOpenChange={onOpenChange}
      title={approved ? 'Cancel this approved leave?' : 'Cancel this leave request?'}
      busy={busy}
      width={440}
      description={approved ? 'The days go back to your balance and your leave slip is marked cancelled.' : `${waitingOn(decider).replace(/^./, (c) => c.toUpperCase())} is told. Nothing is taken off your balance.`}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={() => onOpenChange(false)} disabled={busy}>Keep it</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel the request'}</DialogButton>
        </>
      }
    >
      {error ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">{error}</p> : null}
    </KitDialog>
  );
}
