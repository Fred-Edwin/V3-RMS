'use client';

import * as React from 'react';

import { useFcmToken } from '@/hooks/useFcmToken';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';

import { OwnCard } from '../../components/own-file-cards';
import { notificationsLine } from '../lib/account-words';
import { PasswordDialog } from './password-dialog';

/** Change, Turn on: amber, underlined, 14 px medium; 44 px tall to tap (frames 13.3 and 13.14). */
const LINK = 'flex h-11 shrink-0 items-center justify-center border-0 bg-transparent px-1 font-wds-sans text-[14px] font-medium leading-[18px] text-[#A8680A] underline decoration-1 underline-offset-[3px] outline-none focus-visible:shadow-wds-ring disabled:opacity-60';

/** A row: on a phone the label sits above the value; from 640 px it sits beside it, in the same 124 px column as the other cards. */
function Row({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-t border-wds-border px-[18px] py-1.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-0">
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary sm:w-[124px] sm:shrink-0">{label}</span>
        {children}
      </div>
      {action}
    </div>
  );
}

const VALUE = 'min-w-0 truncate font-wds-sans text-[14px] leading-[18px] text-wds-text-ink';

/**
 * "Sign-in and alerts" (frames 13.3 and 13.14), the card that replaced the Profile page: the sign-in email, the password (Change opens
 * a dialog), whether this device gets notifications (Turn on), and "Sign out everywhere" for a lost phone. The password is never shown,
 * only dots. Notifications read the device's own permission, so "Off on this computer" is about this browser alone.
 */
export function AccountCard({ desktop, onSignOutEverywhere }: { desktop: boolean; onSignOutEverywhere: () => void }) {
  const email = useAuthStore((s) => s.user?.email ?? '');
  const fcm = useFcmToken();
  const [changing, setChanging] = React.useState(false);
  const device = desktop ? 'computer' : 'phone';
  const line = notificationsLine(fcm.permission, fcm.isRegistering, device);

  return (
    <OwnCard title="Sign-in and alerts">
      <Row label="Sign-in email"><span className={VALUE}>{email || 'Not on file'}</span></Row>
      <Row label="Password" action={<button type="button" onClick={() => setChanging(true)} aria-label="Change my password" className={LINK}>Change</button>}>
        <span aria-hidden className="font-wds-mono text-[14px] leading-[18px] tracking-[0.12em] text-wds-text-ink">••••••••••</span>
        <span className="sr-only">Hidden</span>
      </Row>
      <Row
        label="Notifications"
        action={
          fcm.permission === 'default' ? (
            <button type="button" disabled={fcm.isRegistering} onClick={() => void fcm.requestPermissionAndRegister()} aria-label={`Turn on notifications on this ${device}`} className={LINK}>
              Turn on
            </button>
          ) : undefined
        }
      >
        <span className={cn(VALUE, fcm.permission === 'granted' ? 'text-wds-text-ink' : 'text-wds-text-secondary')}>{line}</span>
      </Row>
      <div className="flex min-h-[60px] items-center justify-between gap-3 border-t border-wds-border px-[18px] py-3 max-sm:flex-col max-sm:items-stretch">
        <div className="flex flex-col gap-0.5">
          <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">Lost a phone?</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Signs you out on every device. You sign in again with your password and PIN.</span>
        </div>
        <button
          type="button"
          onClick={onSignOutEverywhere}
          className={cn(
            'flex h-11 shrink-0 items-center justify-center border-0 bg-transparent px-1 font-wds-sans text-[14px] font-medium leading-[18px] text-[#A8321C] underline decoration-1 underline-offset-[3px] outline-none focus-visible:shadow-wds-ring',
            'max-sm:w-full max-sm:border max-sm:border-[#A8321C] max-sm:no-underline'
          )}
        >
          Sign out everywhere
        </button>
      </div>
      {changing ? <PasswordDialog onClose={() => setChanging(false)} /> : null}
    </OwnCard>
  );
}
