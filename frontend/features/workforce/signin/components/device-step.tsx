'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, Shield } from 'lucide-react';

import { deviceLabel, type DeviceKind } from '../lib/signin-rules';
import { PhoneSupport } from './phone-parts';
import { Heading, NoticeBar, PersonStrip, PrimaryButton, SigninCard, StepMarker } from './signin-parts';

/**
 * Step 2, "Confirm this device" (Paper 4.1, 4.2). The real phone check: the sign-in flow asks the server whether this browser is a known
 * device, and shows this step only when it is not. "Trust this device" and "Use just this once" are the server's two answers. The place
 * is the server's coarse place (from the tunnel's location headers) or "Place not known".
 */

export interface DeviceStepProps {
  name: string;
  line: string;
  /** The server's coarse place for this device, or null when it could not tell. */
  place: string | null;
  busy: boolean;
  /** A failed answer (no signal): the same two buttons stay, nothing is locked. */
  error: string | null;
  onTrust: () => void;
  onOnce: () => void;
  onNotYou: () => void;
}

/** A place or time chip: a quiet fill on a phone, a hairline box on a computer. */
const CHIP = 'flex h-7 items-center gap-1.5 rounded-[2px] bg-wds-neutral-50 px-2.5 text-[13px] text-wds-neutral-800 lg:border lg:border-wds-border lg:bg-wds-surface';

export function DeviceStep({ name, line, place, busy, error, onTrust, onOnce, onNotYou }: DeviceStepProps): JSX.Element {
  const [device, setDevice] = useState<{ label: string; kind: DeviceKind }>({ label: 'This browser', kind: 'computer' });
  const [when, setWhen] = useState('');

  // The browser's own words and clock are known only on the client.
  useEffect(() => {
    setDevice(deviceLabel(navigator.userAgent));
    setWhen(new Intl.DateTimeFormat('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' }).format(new Date()));
  }, []);

  // Enter trusts, as the button hint says.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' && !busy && !(event.target instanceof HTMLButtonElement)) onTrust();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTrust, busy]);

  const where = device.kind === 'phone' ? 'phone' : 'computer';

  return (
    <SigninCard
      top={
        <>
          <StepMarker current="device" />
          <Heading rule={false} title="Confirm this device" lead={`This is your first sign-in on this ${where}.`} />
          <div className="flex flex-col gap-3.5 rounded-[4px] border border-wds-border bg-wds-surface p-[18px] lg:bg-wds-canvas lg:px-5">
            <div className="flex flex-col gap-0.5">
              <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-[#6B6760]">NEW DEVICE</span>
              <span className="text-xl font-semibold leading-[26px] tracking-[-0.01em] text-wds-text-ink">{device.label}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={CHIP}>
                <MapPin size={13} className="text-wds-text-secondary" aria-hidden />
                {place ?? 'Place not known'}
              </span>
              <span className={CHIP}>
                <Clock size={13} className="text-wds-text-secondary" aria-hidden />
                {when ? `Today, ${when}` : 'Today'}
              </span>
            </div>
            <div className="flex items-start gap-2 border-t border-wds-border pt-3 text-[13px] leading-[19px] text-wds-neutral-700">
              <Shield size={15} className="mt-0.5 shrink-0 text-wds-espresso-700" aria-hidden />
              <p>We check each new device so nobody else can sign in as you.</p>
            </div>
          </div>
          {error ? <NoticeBar kind="other">{error}</NoticeBar> : null}
        </>
      }
      bottom={
        <>
          <div className="flex flex-col gap-1.5">
            <PrimaryButton hint="Enter" busy={busy} onClick={onTrust}>
              Trust this device
            </PrimaryButton>
            <button type="button" onClick={onOnce} disabled={busy} className="flex h-12 flex-col items-center justify-center gap-px focus-visible:outline-none focus-visible:shadow-wds-ring disabled:opacity-60 lg:h-auto lg:justify-start lg:gap-0.5 lg:pt-2.5">
              <span className="text-[15px] font-medium leading-[18px] text-wds-text-ink lg:text-sm">Use just this once</span>
              <span className="text-xs leading-4 text-wds-text-secondary">We will ask again next time</span>
            </button>
          </div>
          <PersonStrip name={name} line={line} onNotYou={onNotYou} />
          <PhoneSupport />
        </>
      }
    />
  );
}
