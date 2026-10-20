'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { DialogButton, StatusTag, TAP_TARGET } from '../../_shared';
import { phoneMeta, phoneRegionName, PHONE_COPY } from '../lib/security-words';
import type { Phone } from '../types/security-types';

/**
 * One phone on "My phones" (Paper Chapter 14 step 3, middle phone): a 3 px bar (green when confirmed, amber when not), the label and a tag,
 * the place and dates, and the buttons the person may use. This phone cannot be removed from itself ("Sign out instead" is the screen's job);
 * a phone not yet confirmed offers both buttons. The card is a region named "Tecno, Android, not confirmed".
 */
export function PhoneCard({
  phone,
  now,
  busy,
  onConfirm,
  onRemove,
  onSignOut,
}: {
  phone: Phone;
  now: Date;
  busy: boolean;
  onConfirm: () => void;
  onRemove: () => void;
  onSignOut: () => void;
}) {
  return (
    <section aria-label={phoneRegionName(phone)} className={cn('flex gap-3.5 border border-wds-border bg-wds-surface px-4 py-3.5')}>
      <span aria-hidden className={cn('w-[3px] shrink-0', phone.confirmed ? 'bg-wds-success-fg' : 'bg-wds-caramel-500')} />
      <div className="flex min-w-0 grow flex-col gap-2.5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">
              {phone.label}
              {phone.isThisPhone ? <span className="font-normal text-wds-text-secondary"> · this phone</span> : null}
            </h3>
            <StatusTag tone={phone.confirmed ? 'success' : 'warning'}>{phone.confirmed ? 'Confirmed' : 'Not confirmed'}</StatusTag>
          </div>
          <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{phoneMeta(phone, now)}</p>
        </div>
        {phone.isThisPhone ? (
          <div className="flex flex-wrap gap-2">
            {!phone.confirmed ? (
              <DialogButton kind="primary" className={TAP_TARGET} disabled={busy} onClick={onConfirm}>
                {PHONE_COPY.yes}
              </DialogButton>
            ) : null}
            <DialogButton kind="cancel" className={TAP_TARGET} onClick={onSignOut}>
              {PHONE_COPY.signOutInstead}
            </DialogButton>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {!phone.confirmed ? (
              <DialogButton kind="primary" className={TAP_TARGET} disabled={busy} onClick={onConfirm}>
                {PHONE_COPY.yes}
              </DialogButton>
            ) : null}
            <DialogButton kind="cancel" className={TAP_TARGET} disabled={busy} onClick={onRemove} aria-label={`Remove ${phone.label}`}>
              Remove it
            </DialogButton>
          </div>
        )}
      </div>
    </section>
  );
}
