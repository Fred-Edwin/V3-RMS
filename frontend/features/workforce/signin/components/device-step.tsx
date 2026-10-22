'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, Shield } from 'lucide-react';

import { deviceLabel, type DeviceKind } from '../lib/signin-rules';
import { Heading, PersonStrip, PrimaryButton, SigninCard, StepMarker } from './signin-parts';

/**
 * Step 2, "Confirm this device" (Paper 4.1, 4.2). Shown once per person on each browser that has not been trusted. "Trust this device"
 * is remembered in this browser only; "Use just this once" asks again next time. Nothing is sent to the server (the server has no
 * device trust yet), so the card says what it does and no more. The place is the person's branch, not a guess from the network.
 */

export interface DeviceStepProps {
  name: string;
  line: string;
  /** The person's branch or "Company"; shown as the place chip. */
  place: string;
  /** Show the PIN step after this one (the person has no PIN yet); only changes the step marker. */
  onTrust: () => void;
  onOnce: () => void;
  onNotYou: () => void;
}

export function DeviceStep({ name, line, place, onTrust, onOnce, onNotYou }: DeviceStepProps): JSX.Element {
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
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) onTrust();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onTrust]);

  const where = device.kind === 'phone' ? 'phone' : 'computer';

  return (
    <SigninCard>
      <StepMarker current="device" />
      <Heading title="Confirm this device" lead={`This is your first sign-in on this ${where}.`} />
      <div className="flex flex-col gap-3.5 rounded-[4px] border border-wds-border bg-wds-canvas px-5 py-[18px]">
        <div className="flex flex-col gap-0.5">
          <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-[#6B6760]">NEW DEVICE</span>
          <span className="text-xl font-semibold leading-[26px] tracking-[-0.01em] text-wds-text-ink">{device.label}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="flex h-7 items-center gap-1.5 rounded-[2px] border border-wds-border bg-wds-surface px-2.5 text-[13px] text-wds-neutral-800">
            <MapPin size={13} className="text-wds-text-secondary" aria-hidden />
            {place}
          </span>
          <span className="flex h-7 items-center gap-1.5 rounded-[2px] border border-wds-border bg-wds-surface px-2.5 text-[13px] text-wds-neutral-800">
            <Clock size={13} className="text-wds-text-secondary" aria-hidden />
            {when ? `Today, ${when}` : 'Today'}
          </span>
        </div>
        <div className="flex items-start gap-2 border-t border-wds-border pt-3 text-[13px] leading-[19px] text-wds-neutral-700">
          <Shield size={15} className="mt-0.5 shrink-0 text-wds-espresso-700" aria-hidden />
          <p>We ask once on each new device, so you know where you are signed in.</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <PrimaryButton hint="Enter" onClick={onTrust}>
          Trust this device
        </PrimaryButton>
        <button type="button" onClick={onOnce} className="flex flex-col items-center gap-0.5 pt-2.5 focus-visible:outline-none focus-visible:shadow-wds-ring">
          <span className="text-sm font-medium leading-[18px] text-wds-text-ink">Use just this once</span>
          <span className="text-xs leading-4 text-wds-text-secondary">We will ask again next time</span>
        </button>
      </div>
      <PersonStrip name={name} line={line} onNotYou={onNotYou} />
    </SigninCard>
  );
}
