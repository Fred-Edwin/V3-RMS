'use client';

import { useCallback, useState } from 'react';

import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { ApiError, formatApiErrorMessage } from '@/types/api';

import { WASNT_ME_COPY } from '../lib/security-words';
import { sessionWrites } from '../services/security-services';

/**
 * Chooses the new password after "This wasn't me" and signs the person in again (decisions-6a-backend 10: the reset answers no tokens).
 * `needsCurrent` is true when the person has no live sign-in (they pressed the button on this phone, which ended every session): the app
 * signs in once with the current password to be allowed to choose the new one, then signs in with the new one. Nobody is locked out:
 * a wrong current password is only a message, and the person can try again. The passwords are never logged or kept after the call.
 */
export function usePasswordReset(email: string, needsCurrent: boolean, onDone: () => void) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: 'current' | 'password' | 'form'; message: string } | null>(null);

  const save = useCallback(
    async (current: string, newPassword: string, confirm: string): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        if (needsCurrent) {
          try {
            setAuth(await authService.login({ email, password: current }));
          } catch (err) {
            if (err instanceof ApiError && err.statusCode === 401) {
              setError({ field: 'current', message: WASNT_ME_COPY.wrongCurrent });
              return;
            }
            throw err;
          }
        }
        await sessionWrites.resetPassword(newPassword, confirm);
        setAuth(await authService.login({ email, password: newPassword }));
        onDone();
      } catch (err) {
        setError({ field: 'password', message: formatApiErrorMessage(err, 'We could not save the new password. Nothing was changed. Try again.') });
      } finally {
        setBusy(false);
      }
    },
    [email, needsCurrent, onDone, setAuth]
  );

  return { busy, error, save };
}
