'use client';

import * as React from 'react';

import { SetPinForm } from '@/components/app/shell/set-pin-form';
import { usePinStatus } from '@/hooks/usePinStatus';

import { PinField } from '../../../_shared';

/**
 * The person's own PIN for a signed act inside a dialog or panel: four dots, and the shell's "Choose your code" form first when no PIN is
 * set yet. The fourth digit only fills the field; Enter never sends (the kit's rule), so the screen's own button is what signs. `hasPin`
 * tells the screen whether the field is showing, so it keeps its button off until it is.
 */
export function SigningPin({
  active,
  value,
  onChange,
  label,
  invalid,
  disabled,
  error,
  onStatus,
}: {
  /** Check the PIN status now (the panel is open). */
  active: boolean;
  value: string;
  onChange: (value: string) => void;
  label: string;
  invalid: boolean;
  disabled: boolean;
  error: string | null;
  onStatus?: (hasPin: boolean | null) => void;
}) {
  const status = usePinStatus(active);
  const hasPin = status.hasPin;
  const report = React.useRef(onStatus);
  report.current = onStatus;
  React.useEffect(() => {
    report.current?.(hasPin);
  }, [hasPin]);
  if (hasPin === false) {
    return (
      <div className="flex flex-col gap-2">
        <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">Choose your PIN first</span>
        <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-text-secondary">You have not set a signing PIN yet. Choose 4 digits; you will use it for every notice you sign.</p>
        <SetPinForm layout="stacked" submitLabel="Set PIN" onDone={() => status.markSet()} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${label}-label`} className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">
        {label}
      </span>
      <PinField value={value} onChange={onChange} label={label} invalid={invalid} disabled={disabled || hasPin === null} />
      <p role="alert" className="m-0 min-h-4 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
        {error ?? ''}
      </p>
    </div>
  );
}
