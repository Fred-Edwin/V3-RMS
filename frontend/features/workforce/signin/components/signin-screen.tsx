'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { roleLabel } from '@/components/app/shell/role-label';
import { roleHome } from '@/lib/role-home';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { AuthUser } from '@/types/auth';
import { ENDED_NOTICE, PHONE_REMOVED_NOTICE, noticeFor, type SigninNotice } from '../lib/signin-rules';
import { deviceApi, type DeviceAnswer, type DeviceSeen } from '../services/device-api';
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
  /** The server's answer for this device when it is new to the person; null when nothing is to be asked. */
  device: DeviceSeen | null;
}

/** Only a path inside the app is followed after sign-in. */
const safeNext = (next: string | null): string | null => (next && next.startsWith('/') && !next.startsWith('//') ? next : null);

const DISPLAY_ROLES: ReadonlyArray<AuthUser['role']> = ['KITCHEN_DISPLAY', 'BARISTA_DISPLAY'];

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
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const params = new URLSearchParams(window.location.search);
    setNextPath(safeNext(params.get('next')));
    // The session gate sends a person here when the server ended their sign-in (never for being away: nobody is signed out for that).
    if (params.get('reason') === 'ended') setNotice(ENDED_NOTICE);
    if (params.get('reason') === 'phone') setNotice(PHONE_REMOVED_NOTICE);
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
      if (done.device !== null) setPhase({ name: 'device' });
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
      let device: DeviceSeen | null = null;
      if (!DISPLAY_ROLES.includes(response.user.role)) {
        // A failure to ask is not a reason to stop a person signing in: the PIN can be set later, from Profile, and the server still
        // refuses what it must when it does not know this device.
        needsPin = await authService.getPinStatus(response.accessToken).then((s) => !s.hasPin, () => false);
        device = await deviceApi.seen(response.accessToken).then((s) => (s.phoneQuestion ? s : null), () => null);
      }
      const done: Pending = { accessToken: response.accessToken, user: response.user, needsPin, device };
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
    setDeviceError(null);
    setNotice(null);
    setPhase({ name: 'password' });
  };

  /** Trust this device (REMEMBER) or use it just once (ONCE): the server's two answers. A failed answer keeps the step and says so. */
  const answerDevice = async (answer: DeviceAnswer): Promise<void> => {
    if (!pending) return;
    setBusy(true);
    setDeviceError(null);
    try {
      await deviceApi.answer(answer, pending.accessToken);
      if (pending.needsPin) setPhase({ name: 'pin' });
      else finish(pending);
    } catch {
      setDeviceError('We could not save that. Check your signal and try again. Nothing was locked.');
    } finally {
      setBusy(false);
    }
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
    <SigninShell hero={phase.name === 'pin' ? 'pin' : phase.name === 'device' ? 'device' : 'welcome'}>
      {phase.name === 'password' || !pending || !who ? (
        <PasswordStep notice={notice} busy={busy} online={online} wrongCount={wrongCount} onSubmit={(e, p) => void submit(e, p)} onRetryOffline={() => setOnline(navigator.onLine)} />
      ) : phase.name === 'device' ? (
        <DeviceStep
          name={who.name}
          line={who.line}
          place={pending.device?.phone.placeLabel ?? null}
          busy={busy}
          error={deviceError}
          onTrust={() => void answerDevice('REMEMBER')}
          onOnce={() => void answerDevice('ONCE')}
          onNotYou={notYou}
        />
      ) : (
        <PinStep name={who.name} line={who.line} busy={busy} error={pinError} onSave={(pin) => void savePin(pin)} onNotYou={notYou} />
      )}
    </SigninShell>
  );
}
