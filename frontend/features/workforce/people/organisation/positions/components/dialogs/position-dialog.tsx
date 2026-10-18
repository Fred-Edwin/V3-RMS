'use client';

import * as React from 'react';

import { formatApiErrorMessage } from '@/types/api';

import { Callout, ChangeSummary, DialogButton, KitDialog, RadioCards } from '../../../../../_shared';
import { DialogError, DialogPicker, DialogText, FooterNote } from '../../../../_shared/components/dialog-fields';
import { useAction } from '../../../../_shared/hooks/use-action';
import { impactText } from '../../../../_shared/lib/impact-text';
import { PositionChips } from '../../../_shared/components/position-chips';
import { orgReads, orgWrites } from '../../../_shared/services/org-services';
import type { PositionImpact, PositionView } from '../../../_shared/types/org-types';
import { LOGIN_ROLE_OPTIONS, clockingChanged, formOf, impactHeadline, impactWhatChanges, toPositionPatch, validatePosition, type PositionForm } from '../../lib/position-copy';

/**
 * Add a position (O12) or edit one (O14), Paper Chapter 3 steps 07 and 08. Changing "clocks in" first shows who it affects (O13) and
 * asks for a tick that the count is understood; that count is what the server checks (`ACKNOWLEDGE_IMPACT`).
 */
export interface DepartmentOption {
  id: string;
  name: string;
  isActive: boolean;
}

const EMPTY: PositionForm = { name: '', tracksTime: true, loginRole: '', casualsAllowed: true, departmentIds: [] };

export function PositionDialog({ position, departments, onClose, done }: { position: PositionView | null; departments: readonly DepartmentOption[]; onClose: () => void; done: (message: string) => void }) {
  const [form, setForm] = React.useState<PositionForm>(position ? formOf(position) : EMPTY);
  const [shown, setShown] = React.useState(false);
  const [impact, setImpact] = React.useState<PositionImpact | null>(null);
  const [understood, setUnderstood] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [checkError, setCheckError] = React.useState<string | null>(null);
  const action = useAction((m) => done(m ?? 'Saved.'));
  const set = <K extends keyof PositionForm>(key: K, value: PositionForm[K]): void => setForm((f) => ({ ...f, [key]: value }));
  const errors = validatePosition(form);
  const patch = position ? toPositionPatch(position, form) : null;

  const save = async (): Promise<void> => {
    setShown(true);
    if (errors.name) return;
    if (!position) {
      const body = { name: form.name.trim(), defaultTracksTime: form.tracksTime, loginRole: form.loginRole || null, casualsAllowed: form.casualsAllowed, departmentIds: form.departmentIds };
      await action.run(() => orgWrites.createPosition(body), `${body.name} is added. Departments can offer it when you hire.`);
      return;
    }
    if (!patch) return;
    if (clockingChanged(position, form)) {
      setChecking(true);
      setCheckError(null);
      try {
        setImpact(await orgReads.positionImpact(position.id, form.tracksTime));
      } catch (err) {
        setCheckError(formatApiErrorMessage(err, 'We could not tell who this affects, so nothing was changed.'));
      } finally {
        setChecking(false);
      }
      return;
    }
    await action.run(() => orgWrites.updatePosition(position.id, patch), `${form.name.trim()} is updated.`);
  };

  if (position && impact) {
    const stops = !form.tracksTime;
    const final = toPositionPatch(position, form, impact.count);
    return (
      <KitDialog
        open
        onOpenChange={(o) => !o && onClose()}
        title={impactHeadline(position.name, stops)}
        description={`You are changing "Clocks in and out" from ${stops ? 'Yes to No' : 'No to Yes'}.`}
        busy={action.busy}
        footer={
          <>
            <FooterNote>Written to the audit log.</FooterNote>
            <DialogButton kind="cancel" size="lg" onClick={() => { setImpact(null); setUnderstood(false); }} disabled={action.busy}>Back</DialogButton>
            <DialogButton
              kind="primary"
              size="lg"
              disabled={action.busy || (impact.count > 0 && !understood) || !final}
              onClick={() => final && void action.run(() => orgWrites.updatePosition(position.id, final), `${position.name} ${stops ? 'stops' : 'starts'} tracking time.`)}
            >
              {action.busy ? 'Saving…' : stops ? 'Stop tracking time' : 'Start tracking time'}
            </DialogButton>
          </>
        }
      >
        <ChangeSummary
          caption={`THIS CHANGES ${impact.count} ${impact.count === 1 ? 'PERSON' : 'PEOPLE'}`}
          lines={impact.count === 0 ? ['Nobody holds this position yet, so nobody is affected.'] : impact.people.map((p) => p.name)}
        />
        <Callout tone="warning" size="sm" title={stops ? 'What stops' : 'What starts'}>{impactWhatChanges(stops)}</Callout>
        {impact.impacts.length > 0 ? <ul className="m-0 pl-4 font-wds-sans text-[13px] text-wds-text-secondary">{impact.impacts.map((i) => <li key={i.code}>{impactText(i)}</li>)}</ul> : null}
        {impact.count > 0 ? (
          <label className="flex items-center gap-2.5 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="h-4 w-4 accent-[var(--wds-primary)]" />
            I understand this applies to {impact.count === 2 ? 'both of them' : impact.count === 1 ? 'them' : `all ${impact.count} of them`}
          </label>
        ) : null}
        <DialogError message={action.error} />
      </KitDialog>
    );
  }

  const busy = action.busy || checking;
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={position ? `Edit ${position.name}` : 'Add a position'}
      description={position ? 'A position is what someone does. It is not a department.' : 'What someone does, so a department can offer it when you hire.'}
      busy={busy}
      footer={
        <>
          <FooterNote>{position && !patch ? 'Nothing has changed yet.' : 'Written to the audit log.'}</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={() => void save()} disabled={busy || (position !== null && !patch)}>
            {busy ? 'Saving…' : position ? (position && clockingChanged(position, form) ? 'Review who it affects' : 'Save changes') : 'Add position'}
          </DialogButton>
        </>
      }
    >
      <DialogText label="Name" value={form.name} onChange={(v) => set('name', v)} autoFocus error={shown ? errors.name : undefined} />
      <RadioCards
        legend="Does this person clock in and out?"
        legendStyle="sentence"
        columns={2}
        value={form.tracksTime ? 'yes' : 'no'}
        onChange={(v) => set('tracksTime', v === 'yes')}
        options={[
          { value: 'yes', title: 'Yes', description: 'Rota, timesheet, lateness, overtime' },
          { value: 'no', title: 'No', description: 'Managers and head office' },
        ]}
      />
      <DialogPicker label="Login role" value={form.loginRole} onChange={(v) => set('loginRole', v)} options={LOGIN_ROLE_OPTIONS} placeholder="No login needed" helper="What a new hire in this position can sign in as." />
      <RadioCards
        legend="Can casuals do this job?"
        legendStyle="sentence"
        columns={2}
        value={form.casualsAllowed ? 'yes' : 'no'}
        onChange={(v) => set('casualsAllowed', v === 'yes')}
        options={[
          { value: 'yes', title: 'Yes', description: 'It can be filled from the casual pool' },
          { value: 'no', title: 'No', description: 'Monthly staff only' },
        ]}
      />
      <PositionChips legend="Offered by" options={departments} selected={form.departmentIds} onChange={(ids) => set('departmentIds', ids)} canCreate={false} disabled={busy} />
      {checkError ? <Callout tone="error" role="alert" size="sm">{checkError}</Callout> : null}
      <DialogError message={action.error} />
    </KitDialog>
  );
}
