import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Stops a page with unsaved edits from being left by accident.
 *  - Closing or reloading the tab: the browser's own prompt (`beforeunload`).
 *  - Following a link inside the app (the sidebar, the breadcrumb, a button that is a link): the click is held
 *    and `pendingHref` is set; the screen shows its confirm dialog and calls `confirmLeave` or `stay`.
 * The browser's Back button is not intercepted (App Router has no hook for it); the tab prompt does not cover it either.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    // Capture phase, so this runs before Next's link handler.
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const stay = useCallback(() => setPendingHref(null), []);

  const confirmLeave = useCallback(() => {
    if (pendingHref === null) return;
    const href = pendingHref;
    setPendingHref(null);
    router.push(href);
  }, [pendingHref, router]);

  return { pendingHref, stay, confirmLeave };
}
