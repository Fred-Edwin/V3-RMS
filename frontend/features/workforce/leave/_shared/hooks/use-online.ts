'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (notify: () => void): (() => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};

/** True while the device says it has a connection. A write needs the server's answer, so screens disable it when this is false. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
