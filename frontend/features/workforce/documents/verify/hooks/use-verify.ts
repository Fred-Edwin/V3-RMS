'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';

import { checkPublic, checkSignedIn, reportMismatch } from '../services/verify-services';
import type { SignedInAnswer, VerifyAnswer } from '../types/verify-types';

export type VerifyState =
  | { status: 'checking' }
  | { status: 'offline' }
  | { status: 'failed' }
  | { status: 'done'; answer: VerifyAnswer | SignedInAnswer };

const newKey = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * The check. The public answer is drawn as soon as it arrives; in parallel the page asks whether the person is signed in (the refresh
 * cookie, if any), and if so replaces it with the signed-in answer (signer, Open button, "Tell the ..."). A person who is not signed in
 * simply keeps the public answer; nothing here ever blocks on a sign-in.
 */
export function useVerify(kind: string, number: string, h: string | null) {
  const [state, setState] = useState<VerifyState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const hydrate = useAuthStore((s) => s.hydrateSession);
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.isHydrated);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'checking' });
    checkPublic(kind, number, h).then(
      (answer) => {
        if (!cancelled) setState((s) => (s.status === 'done' && 'canOpen' in s.answer ? s : { status: 'done', answer }));
      },
      () => {
        if (!cancelled) setState({ status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'failed' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [kind, number, h, attempt]);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    checkSignedIn(kind, number, h).then(
      (answer) => {
        if (!cancelled) setState({ status: 'done', answer });
      },
      () => {
        // The public answer stays; the person is simply not shown the signed-in extras.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [authenticated, kind, number, h, attempt]);

  const retry = useCallback((): void => setAttempt((n) => n + 1), []);
  return { state, retry, user: authenticated ? user : null };
}

/** "Tell the {role}": one press, one key, so a double tap is one report. */
export function useReport(kind: string, number: string, h: string | null) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'told' | 'failed'>('idle');
  const [key] = useState(newKey);
  const send = useCallback(async (): Promise<void> => {
    if (!h) return;
    setStatus('busy');
    try {
      await reportMismatch(kind, number, h, key);
      setStatus('told');
    } catch {
      setStatus('failed');
    }
  }, [kind, number, h, key]);
  return { status, send };
}
