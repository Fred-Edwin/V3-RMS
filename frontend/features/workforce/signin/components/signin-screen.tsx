'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { roleLabel } from '@/components/app/shell/role-label';
import { roleHome } from '@/lib/role-home';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { AuthUser } from '@/types/auth';
import { ENDED_NOTICE, noticeFor, trustKey, type SigninNotice } from '../lib/signin-rules';
import { DeviceStep } from './device-step';
import { PasswordStep } from './password-step';
import { PinStep } from './pin-step';
import { SigninShell } from './signin-shell';

/**
 * The sign-in flow: Password, then This device (once per person on each browser), then Set your PIN (only for a person with none).
 * The session is set only at the end, so a person who stops half way or presses "Not you?" never appears signed in.
 */

type Phase = { name: 'password' } | { name: 'device' } | { name: 'pin' };
interface Pending {
  accessToken: string;
  user: AuthUser;
  needsPin: boolean;
}

/** Only a path inside the app is followed after sign-in. */
const safeNext = (next: string | null): string | null => (next && next.startsWith('/') && !next.startsWith('//') ? next : null);

const DISPLAY_ROLES: ReadonlyArray<AuthUser['role']> = ['KITCHEN_DISPLAY', 'BARISTA_DISPLAY'];

const readTrusted = (userId: string): boolean => {
  try {
    return window.localStorage.getItem(trustKey(userId)) === '1';
  } catch {
    return false;
  }
};
const writeTrusted = (userId: string): void => {
  try {
    window.localStorage.setItem(trustKey(userId), '1');
  } catch {
    // Private window: the device is simply asked again next time.
  }
};

export function SigninScreen(): JSX.Element {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [phase, setPhase] = useState<Phase>({ name: 'password' });
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<SigninNotice | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [pinError, setPinError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const params = new URLSearchParams(window.location.search);
    setNextPath(safeNext(params.get('next')));
    // The session gate sends a person here when the server ended their sign-in (never for being away: nobody is signed out for that).
    if (params.get('reason') === 'ended') setNotice(ENDED_NOTICE);
    const on = (): void => {
      setOnline(true);
      setNotice((n) => (n?.kind === 'offline' ? null : n));
    };
    const off = (): void => {
      setOnline(false);
      setNotice(noticeFor(null, false));
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const finish = useCallback(
    (done: Pending): void => {
      setAuth({ accessToken: done.accessToken, user: done.user });
      router.push(nextPath ?? roleHome[done.user.role]);
    },
    [nextPath, router, setAuth],
  );

  /** After the password: which of the two later steps this person still has. */
  const proceed = useCallback(
    (done: Pending): void => {
      const skipDevice = DISPLAY_ROLES.includes(done.user.role) || readTrusted(done.user.id);
      if (!skipDevice) setPhase({ name: 'device' });
      else if (done.needsPin) setPhase({ name: 'pin' });
      else finish(done);
    },
    [finish],
  );

  const submit = async (email: string, password: string): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await authService.login({ email, password });
      let needsPin = false;
      if (!DISPLAY_ROLES.includes(response.user.role)) {
        // A failure to ask is not a reason to stop a person signing in: the PIN can be set later, from Profile.
        needsPin = await authService.getPinStatus(response.accessToken).then((s) => !s.hasPin, () => false);
      }
      const done: Pending = { accessToken: response.accessToken, user: response.user, needsPin };
      setPending(done);
      proceed(done);
    } catch (error: unknown) {
      const next = noticeFor(error, navigator.onLine);
      setNotice(next);
      if (next.kind === 'wrong') setWrongCount((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const notYou = (): void => {
    void authService.logout().catch(() => undefined);
    setPending(null);
    setPinError(null);
    setNotice(null);
    setPhase({ name: 'password' });
  };

  const afterDevice = (): void => {
    if (!pending) return;
    if (pending.needsPin) setPhase({ name: 'pin' });
    else finish(pending);
  };

  const savePin = async (pin: string): Promise<void> => {
    if (!pending) return;
    setBusy(true);
    setPinError(null);
    try {
      await authService.setPin({ pin }, pending.accessToken);
      finish(pending);
    } catch (error: unknown) {
      setPinError(error instanceof ApiError && error.statusCode < 500 ? error.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const who = pending ? { name: pending.user.name, line: `${roleLabel(pending.user.role)} · ${pending.user.organizationName ?? 'Company'}` } : null;

  return (
    <SigninShell compactHero={phase.name === 'pin'}>
      {phase.name === 'password' || !pending || !who ? (
        <PasswordStep notice={notice} busy={busy} online={online} wrongCount={wrongCount} onSubmit={(e, p) => void submit(e, p)} onRetryOffline={() => setOnline(navigator.onLine)} />
      ) : phase.name === 'device' ? (
        <DeviceStep
          name={who.name}
          line={who.line}
          place={pending.user.organizationName ?? 'Company'}
          onTrust={() => {
            writeTrusted(pending.user.id);
            afterDevice();
          }}
          onOnce={afterDevice}
          onNotYou={notYou}
        />
      ) : (
        <PinStep name={who.name} line={who.line} busy={busy} error={pinError} onSave={(pin) => void savePin(pin)} onNotYou={notYou} />
      )}
    </SigninShell>
  );
}
