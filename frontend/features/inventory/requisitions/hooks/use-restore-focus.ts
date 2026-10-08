import { useEffect, useRef } from 'react';

/**
 * Puts keyboard focus back on whatever opened a sheet or dialog when it closes. The shared sign sheet is controlled (it has no
 * trigger element), so the browser would otherwise drop focus on the page body and a keyboard or screen-reader user would lose
 * their place. Call with the sheet's `open` flag.
 */
export function useRestoreFocus(open: boolean): void {
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  // Capture during render of the opening commit: by the time an effect runs the sheet may already have moved focus inside itself.
  if (open && !wasOpen.current && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
    opener.current = document.activeElement;
  }

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const target = opener.current;
    opener.current = null;
    // After the closing animation has released the focus trap.
    const id = window.setTimeout(() => {
      if (target && target.isConnected) target.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);
}
