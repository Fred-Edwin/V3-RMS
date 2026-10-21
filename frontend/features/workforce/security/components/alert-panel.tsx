'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { Callout, DialogButton, FIELD_CLASS, FormField, KeyValueRows, MOTION, FOCUS_RING } from '../../_shared';
import { ALERT_COPY, ALERT_KIND_LABEL, alertTitle, clearedByLine, noteOk, placeWords, whenLabel } from '../lib/security-words';
import type { AlertRow } from '../types/security-types';

/**
 * The right panel for the chosen alert (6a S1; designed from the kit, Paper step 6 says "not drawn"): mono kind and time, the sentence, the
 * facts, and, while the alert is open, a one-line note (what did you do) with Clear this alert. The button is disabled with its reason until
 * the note has 3 characters. Two System Admins clearing at once: the second sees who got there first. Cleared alerts stay listed, read-only.
 */
export function AlertPanel({
  alert,
  now,
  busy,
  error,
  onClear,
  onClose,
}: {
  alert: AlertRow;
  now: Date;
  busy: boolean;
  error: string | null;
  onClear: (note: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [note, setNote] = React.useState('');
  const open = alert.status === 'OPEN';
  const ok = noteOk(note);

  return (
    <aside aria-label={ALERT_KIND_LABEL[alert.kind]} className="flex w-[340px] shrink-0 flex-col gap-4 border border-wds-border bg-wds-surface p-5 max-lg:w-full">
      <div className="flex items-start justify-between gap-3">
        <span className={cn('font-wds-mono text-[10px] leading-3 tracking-[0.08em]', alert.kind === 'WASNT_ME' ? 'text-wds-error-fg' : 'text-wds-warning-fg')}>
          {ALERT_KIND_LABEL[alert.kind].toUpperCase()} · {whenLabel(alert.occurredAt, now).toUpperCase()}
        </span>
        <button type="button" onClick={onClose} aria-label="Close the alert" className={cn('-mr-2 -mt-2 flex h-9 w-9 items-center justify-center text-[20px] leading-6 text-wds-text-muted', MOTION, FOCUS_RING)}>
          <span aria-hidden>×</span>
        </button>
      </div>
      <h2 className="m-0 font-wds-sans text-[15px] font-semibold leading-[22px] text-wds-text-ink">{alertTitle(alert)}</h2>
      <KeyValueRows
        aria-label="Facts"
        rows={[
          { label: 'Person', value: alert.person ? `${alert.person.name}, ${alert.person.role}` : 'Not a person' },
          { label: 'Phone', value: alert.deviceLabel ?? 'Not known' },
          { label: 'Place', value: placeWords(alert.placeLabel) },
          { label: 'Time', value: whenLabel(alert.occurredAt, now), mono: true },
          ...(alert.kind === 'WASNT_ME' ? [{ label: 'What was done', value: ALERT_COPY.wasntMeFacts }] : []),
        ]}
      />
      {open ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (ok) void onClear(note).then((cleared) => cleared && setNote(''));
          }}
        >
          <FormField label={ALERT_COPY.noteLabel} hint="required">
            {(ids) => <input id={ids.id} aria-describedby={ids.describedBy} className={FIELD_CLASS} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} autoComplete="off" />}
          </FormField>
          {error ? <Callout tone="error" role="alert">{error}</Callout> : null}
          <div className="flex flex-col gap-1.5">
            <DialogButton type="submit" kind="primary" size="lg" disabled={busy || !ok} aria-describedby="clear-reason">
              {busy ? 'Clearing…' : ALERT_COPY.clear}
            </DialogButton>
            {!ok ? (
              <p id="clear-reason" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                {ALERT_COPY.noteReason}
              </p>
            ) : null}
          </div>
        </form>
      ) : (
        <Callout tone="success" title={clearedByLine(alert.clearedBy, alert.clearedAt)}>
          {alert.clearNote ?? ''}
        </Callout>
      )}
    </aside>
  );
}
