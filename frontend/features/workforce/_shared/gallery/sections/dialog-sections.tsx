'use client';

import * as React from 'react';

import { ChangeDialog, DialogButton, EMPTY_REASON, KitDialog, OldToNew, ReasonChips, UndoToast, WorkforcePinDialog, type ReasonValue } from '../..';
import { Label, Section } from '../gallery-parts';

/** Gallery section 9: reason chips, the "what changes" dialog, the plain shell, the PIN dialog and the Undo toast. */
export function DialogSections() {
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const [changeOpen, setChangeOpen] = React.useState(false);
  const [shellOpen, setShellOpen] = React.useState(false);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [undo, setUndo] = React.useState<number | null>(null);

  return (
    <Section id="dialogs" title="9 · Reason chips, “what changes” dialog, PIN dialog, Undo toast" node="VM5-0 / 1Q58-0 (rules 02, 03, 06, 09)" note="Open each with the mouse or the keyboard. Escape closes and returns focus to the button. Enter in a field never completes anything. The PIN dialog asks the server for PIN status, so with no signed-in session it shows its own “couldn’t check” state.">
      <div className="max-w-[560px]">
        <Label>Reason chips (arrow keys move between them)</Label>
        <ReasonChips
          legend="REASON"
          options={[
            { key: 'cover', label: 'Cover for a gap' },
            { key: 'request', label: 'Staff request' },
            { key: 'sick', label: 'Sick' },
            { key: 'traffic', label: 'Morning traffic' },
          ]}
          value={reason}
          onChange={setReason}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <DialogButton kind="cancel" onClick={() => setChangeOpen(true)}>Open “what changes” dialog</DialogButton>
        <DialogButton kind="cancel" onClick={() => setShellOpen(true)}>Open plain dialog shell</DialogButton>
        <DialogButton kind="cancel" onClick={() => setPinOpen(true)}>Open PIN dialog</DialogButton>
        <DialogButton kind="cancel" onClick={() => setUndo(Date.now())}>Show the Undo toast (30 s)</DialogButton>
      </div>
      <div>
        <Label>Old to new rows</Label>
        <div className="max-w-[420px] border border-wds-border bg-wds-surface px-4">
          <OldToNew label="Basic pay" from="KES 38,000" to="KES 42,000" />
          <OldToNew label="Starts on" from="Mon 5 Oct" to="Mon 2 Nov" />
        </div>
      </div>

      <ChangeDialog
        open={changeOpen}
        onOpenChange={setChangeOpen}
        title="Assign a head for Housekeeping"
        description="Nyeri Town. Two people work here, and approvals are with Faith Njeri for now."
        summaryCaption="WHAT CHANGES WHEN GRACE BECOMES HEAD"
        summaryLines={[
          'Overtime, leave and Reports for Housekeeping go to Grace instead of Faith Njeri. One item is waiting now and moves to Grace.',
          "Grace's phone gains Team today, Rota and Casuals. Grace's own job and pay do not change, and only Grace's own pay shows.",
          'Faith Njeri is told, and keeps the power to step in. This is written to the audit log with your name and the time.',
        ]}
        confirmLabel="Assign Grace as head"
        confirmDisabledReason={reason.choice ? undefined : 'Choose a reason (above) before you can assign.'}
        busy={saving}
        onConfirm={() => {
          setSaving(true);
          window.setTimeout(() => {
            setSaving(false);
            setChangeOpen(false);
          }, 900);
        }}
      >
        <ReasonChips
          name="dialog-reason"
          legend="REASON"
          options={[
            { key: 'cover', label: 'Cover for a gap' },
            { key: 'request', label: 'Staff request' },
          ]}
          value={reason}
          onChange={setReason}
        />
      </ChangeDialog>
      <KitDialog
        open={shellOpen}
        onOpenChange={setShellOpen}
        title="Plain dialog shell"
        description="Title, one line, a close ×, the scrim, footer buttons."
        footer={
          <>
            <DialogButton kind="cancel" onClick={() => setShellOpen(false)}>Cancel</DialogButton>
            <DialogButton kind="primary" onClick={() => setShellOpen(false)}>Save</DialogButton>
          </>
        }
      >
        <input autoComplete="off" aria-label="First field has focus when it opens" className="h-10 border border-wds-border-strong px-3 text-[14px] focus-visible:border-wds-primary focus-visible:shadow-wds-ring focus-visible:outline-none" placeholder="First field has focus when it opens" />
      </KitDialog>
      <WorkforcePinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Approve the October run?"
        summaryRows={[
          { label: 'People paid', value: '85', mono: true },
          { label: 'Net to pay', value: 'KES 3,168,500', mono: true },
          { label: 'Statutory tables', value: 'Confirmed by you, 19 Oct 09:15', tone: 'success' },
          { label: 'Prepared by', value: 'Mercy Achieng, not you' },
        ]}
        pinLabel="Your PIN, to sign the approval"
        caption="Mercy Achieng is told to publish. Staff cannot see anything yet. Recorded in the audit log with your name and the time."
        confirmLabel="Approve"
        onSubmit={() => setPinOpen(false)}
      />
      {undo !== null ? (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <UndoToast key={undo} startedAt={undo} message="Approved Lucy Wambui's overtime." onUndo={() => setUndo(null)} onExpire={() => setUndo(null)} />
        </div>
      ) : null}
    </Section>
  );
}
