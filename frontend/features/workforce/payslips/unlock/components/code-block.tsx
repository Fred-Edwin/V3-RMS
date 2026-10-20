'use client';

import * as React from 'react';

import { Callout, PhoneButton, PinField, PIN_LENGTH } from '../../../_shared';
import { CODE_COPY } from '../../_shared/lib/payslip-copy';
import { MISMATCH_LINE, WRONG_LINE, slowedLine, type CodeProblem } from '../lib/unlock-logic';

/**
 * The code field, button and the warning under the locked list (Paper 3AJR-0, right phone). The 4th digit only enables the button;
 * Enter never opens (kit rule). A wrong code clears the field and keeps focus; a pause disables the button, never the field.
 * With no code set the same block asks for one, twice, and "Save my code" opens the payslips.
 */
export function CodeBlock({
  hasCode,
  monthLabel,
  who,
  busy,
  problem,
  wait,
  onUnlock,
  onSetCode,
  onEdit,
}: {
  hasCode: boolean;
  /** "September": the month of the chosen row. */
  monthLabel: string;
  /** "Cynthia Wairimu, Barista". */
  who: string;
  busy: boolean;
  problem: CodeProblem | null;
  wait: number;
  onUnlock: (code: string) => void;
  onSetCode: (code: string) => void;
  onEdit: () => void;
}) {
  const [code, setCode] = React.useState('');
  const [again, setAgain] = React.useState('');
  const box = React.useRef<HTMLDivElement>(null);
  const setting = !hasCode;
  const mismatch = setting && again.length === PIN_LENGTH && code.length === PIN_LENGTH && code !== again;

  // A refused try clears the field and puts the cursor back, so the next try can be typed straight away.
  React.useEffect(() => {
    if (problem && (problem.kind === 'wrong' || problem.kind === 'slowed')) {
      setCode('');
      box.current?.querySelector('input')?.focus();
    }
  }, [problem]);

  const line = problem?.kind === 'wrong' ? WRONG_LINE : problem?.kind === 'other' ? problem.message : problem?.kind === 'offline' ? 'No signal. Try again when you are back online.' : null;
  const slowed = wait > 0 ? slowedLine(wait) : null;
  const ready = setting ? code.length === PIN_LENGTH && again.length === PIN_LENGTH && !mismatch : code.length === PIN_LENGTH;
  const submit = () => (setting ? onSetCode(code) : onUnlock(code));

  return (
    <section ref={box} aria-label={setting ? CODE_COPY.setTitle : CODE_COPY.title} className="mt-5 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-wds-sans text-[18px] font-semibold leading-[22px] text-wds-text-ink">{setting ? CODE_COPY.setTitle : CODE_COPY.title}</h2>
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{setting ? CODE_COPY.setLine : CODE_COPY.line}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {setting ? <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">{CODE_COPY.setFirst}</span> : null}
        <PinField
          value={code}
          onChange={(v) => {
            setCode(v);
            onEdit();
          }}
          label={setting ? CODE_COPY.setFirst : CODE_COPY.fieldLabel}
          invalid={problem?.kind === 'wrong'}
          disabled={busy}
          autoFocus
        />
      </div>
      {setting ? (
        <div className="flex flex-col gap-1.5">
          <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">{CODE_COPY.setAgain}</span>
          <PinField value={again} onChange={setAgain} label={CODE_COPY.setAgain} invalid={mismatch} disabled={busy} />
          {mismatch ? (
            <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
              {MISMATCH_LINE}
            </p>
          ) : null}
        </div>
      ) : null}
      {line ? (
        <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {line}
        </p>
      ) : null}
      <PhoneButton size="lg" className="text-[15px]" disabled={!ready || busy || (!setting && wait > 0)} onClick={submit}>
        {busy ? 'Opening…' : setting ? CODE_COPY.setButton : `Open ${monthLabel}`}
      </PhoneButton>
      {slowed ? (
        <p aria-live="polite" className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">
          {slowed}
        </p>
      ) : null}
      {setting ? null : <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">{CODE_COPY.reassure}</p>}
      <Callout tone="warning" size="sm" title={`This payslip is ${who}'s.`}>
        {CODE_COPY.warningBody(who)}
      </Callout>
    </section>
  );
}
