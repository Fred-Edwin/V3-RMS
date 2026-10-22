'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SESSION_GATE_EVENT } from '@/lib/apiClient';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

import { phoneWrites, sessionReads } from '../services/security-services';

/**
 * What stands between a signed-in person and the app (6a S2, S3, decisions-6a-backend 4 and 9):
 *   - `reset`: "This wasn't me" was pressed, so a new password comes first;
 *   - `phone`: the server does not know this device, so the person is signed out and sent to sign in, where the device step asks;
 *   - `clear`: nothing to ask.
 * The checks run once per load. A failed check (no signal) lets the person through: the server still refuses what it must, and nobody is
 * ever locked out here. A token that the server ended (`SESSION_ENDED`) signs the person out and sends them to sign in again.
 */
export type GateState = { step: 'checking' } | { step: 'clear' } | { step: 'reset' } | { step: 'phone' };

export function useSecurityGate(enabled: boolean) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [state, setState] = useState<{ userId: string; gate: GateState } | null>(null);

  // One check at a time: a refused call raises the gate event again, and that must not start a second check on top of the first.
  const running = useRef(false);

  /** `phoneOnly` skips the password state: a removed phone is refused on that route too, so reading it would only raise the event again. */
  const check = useCallback(async (id: string, phoneOnly = false): Promise<void> => {
    if (running.current) return;
    running.current = true;
    try {
      if (!phoneOnly) {
        try {
          if ((await sessionReads.state()).mustChangePassword) {
            setState({ userId: id, gate: { step: 'reset' } });
            return;
          }
        } catch {
          // No signal or a refusal: carry on to the phone check.
        }
      }
      try {
        const seen = await phoneWrites.seen();
        if (seen.phoneQuestion) {
          // The server does not know this device: sign in again, where the device step asks. No screen of the app shows meanwhile.
          setState({ userId: id, gate: { step: 'phone' } });
          void authService.logout().catch(() => undefined).finally(() => {
            useAuthStore.getState().clearAuth();
            router.replace('/login?reason=phone');
          });
        } else {
          setState({ userId: id, gate: { step: 'clear' } });
        }
      } catch {
        setState({ userId: id, gate: { step: 'clear' } });
      }
    } finally {
      running.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (enabled && userId) void check(userId);
  }, [enabled, userId, check]);

  useEffect(() => {
    if (!enabled || !userId) return;
    const onGate = (event: Event): void => {
      const code = (event as CustomEvent<{ code: string }>).detail.code;
      if (code === 'SESSION_ENDED') {
        const here = window.location.pathname + window.location.search;
        void authService.logout().catch(() => undefined).finally(() => {
          useAuthStore.getState().clearAuth();
          router.replace(`/login?reason=ended&next=${encodeURIComponent(here)}`);
        });
      } else {
        // PASSWORD_RESET_REQUIRED: ask the state; PHONE_REMOVED: the phone is asked again (the state route refuses a removed phone).
        void check(userId, code === 'PHONE_REMOVED');
      }
    };
    window.addEventListener(SESSION_GATE_EVENT, onGate);
    return () => window.removeEventListener(SESSION_GATE_EVENT, onGate);
  }, [enabled, userId, check, router]);

  const gate: GateState = enabled && state !== null && state.userId === userId ? state.gate : { step: enabled ? 'checking' : 'clear' };
  return { gate };
}
