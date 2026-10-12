'use client';

import * as React from 'react';

/**
 * Who gets the in-app number pad (owner decision, 12 Oct 2026):
 *  - a coarse pointer (a finger: a phone or a tablet) gets the pad for quantities and PINs, so the phone keyboard never covers a field;
 *  - a fine pointer (a mouse) keeps ordinary typing;
 *  - anyone, on any device, may switch the pad off ("Use the phone keyboard"), for screen readers and switch access. The choice is
 *    kept on the device.
 * Real text (search boxes, names, notes, delivery note numbers) always uses the phone keyboard; this only covers numbers.
 */
const COARSE = '(pointer: coarse)';
const STORAGE_KEY = 'wendo.phone-keyboard';

function subscribeCoarse(onChange: () => void): () => void {
  const query = window.matchMedia(COARSE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** True when the main pointer is a finger. False on the server and until the browser answers. */
export function useCoarsePointer(): boolean {
  return React.useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
}

const listeners = new Set<() => void>();
const subscribePreference = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
};
const readPreference = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

/** "Use the phone keyboard" (true) or the in-app pad (false), kept on the device. */
export function usePhoneKeyboardPreference(): [boolean, (value: boolean) => void] {
  const prefer = React.useSyncExternalStore(subscribePreference, readPreference, () => false);
  const set = React.useCallback((value: boolean): void => {
    try {
      if (value) window.localStorage.setItem(STORAGE_KEY, '1');
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Private windows and blocked storage: the choice lasts until the page reloads.
    }
    listeners.forEach((l) => l());
  }, []);
  return [prefer, set];
}

/** Whether a number field on this device should use the in-app pad right now. */
export function useInAppPad(): boolean {
  const coarse = useCoarsePointer();
  const [prefer] = usePhoneKeyboardPreference();
  return coarse && !prefer;
}
