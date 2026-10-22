'use client';

import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { useSecurityGate } from '../hooks/use-security-gate';
import { ResetPasswordScreen } from './reset-password-screen';

/**
 * Wraps the signed-in app. While a new password is required the person sees that screen instead of the app (no skip, no back). A device the
 * server does not know (removed from My phones) signs the person out and back to sign-in, where the device step asks; otherwise the app is
 * drawn at once, even while the two checks run. `enabled` is false for a person who is
 * not signed in and for the kitchen and bar display screens, which are not people.
 */
export function SecurityGate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const email = useAuthStore((s) => s.user?.email ?? '');
  const { gate } = useSecurityGate(enabled);

  // After a reset every phone is asked again, so the app starts over from Home: a fresh load runs both checks.
  if (gate.step === 'reset') return <ResetPasswordScreen email={email} needsCurrent={false} onDone={() => window.location.assign('/app/workforce')} />;
  // A device the server does not know is sent back to sign in, where the device step asks (the hook does the sign-out); nothing of the app shows.
  if (gate.step === 'phone') return null;
  return <>{children}</>;
}
