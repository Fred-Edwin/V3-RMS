'use client';

import * as React from 'react';

/**
 * Text typed but not sent, kept for the visit so a lost connection or a back tap does not lose it (spec S6: "kept in the page for the
 * session, not stored"). It lives in sessionStorage, which the browser drops when the tab closes; if storage is blocked it is plain state.
 * Call `clear` once the text has been sent.
 */
export function useSessionDraft(key: string): [string, (value: string) => void, () => void] {
  const [value, setValue] = React.useState('');
  React.useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(key);
      if (saved) setValue(saved);
    } catch {
      // Blocked storage: the draft lives in state only.
    }
  }, [key]);
  const set = React.useCallback(
    (next: string) => {
      setValue(next);
      try {
        window.sessionStorage.setItem(key, next);
      } catch {
        // Nothing to do: the text is still in state.
      }
    },
    [key]
  );
  const clear = React.useCallback(() => {
    setValue('');
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  }, [key]);
  return [value, set, clear];
}
