'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // ~3 minutes

interface PayslipGate {
  isVerified: boolean;
  isVerifying: boolean;
  error: string | null;
  verify: (password: string) => Promise<void>;
  lock: () => void;
}

/**
 * View-gate for the payslip page. Financial data stays hidden until the user
 * re-enters their account password and the server verifies it.
 *
 * Re-locks on:
 *  - fresh mount (initial state is always locked)
 *  - ~3 min idle (timer reset on user activity)
 *  - tab blur (visibilitychange → hidden)
 *  - unmount
 */
export function usePayslipGate(): PayslipGate {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    setIsVerified(false);
    setError(null);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const verify = useCallback(
    async (password: string) => {
      if (!accessToken) {
        setError('Your session has expired. Please sign in again.');
        return;
      }
      setIsVerifying(true);
      setError(null);
      try {
        await authService.verifyPassword(password, accessToken);
        setIsVerified(true);
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 401) {
          setError('Incorrect password. Please try again.');
        } else {
          setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
        }
        setIsVerified(false);
      } finally {
        setIsVerifying(false);
      }
    },
    [accessToken],
  );

  // Re-lock when the tab is hidden (navigate-away / app switch / lock screen).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [lock]);

  // Idle auto-lock: only while verified. Reset on user activity.
  useEffect(() => {
    if (!isVerified) {
      return;
    }

    const resetIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        lock();
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents: (keyof DocumentEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ];
    activityEvents.forEach((evt) => document.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      activityEvents.forEach((evt) => document.removeEventListener(evt, resetIdleTimer));
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [isVerified, lock]);

  // Re-lock on unmount (navigate away from the page).
  useEffect(() => {
    return () => lock();
  }, [lock]);

  return { isVerified, isVerifying, error, verify, lock };
}
