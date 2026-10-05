'use client';

import { createContext, useContext } from 'react';

export type ShellKind = 'desktop' | 'mobile';

/**
 * Which of the two simultaneously-mounted app shells a page is currently
 * rendering inside. Dual-shell roles (MANAGER, DIRECTOR, STORE_MANAGER, etc.
 * — see `usesDesktopShell` in components/app/shell/nav-table.ts) mount `{children}` twice: once
 * inside the desktop AppShell, once inside the CSS-hidden
 * (`lg:hidden`) mobile MobileLayout. `window.matchMedia` can't distinguish
 * the two mounts — both see the same viewport — so a page that needs to
 * skip its own data-fetching/rendering in whichever copy isn't visible
 * (because no responsive or separate-mobile version of that page exists
 * yet) reads this instead.
 */
const ShellContext = createContext<ShellKind>('desktop');

export const ShellProvider = ShellContext.Provider;

/** True inside the desktop shell mount; false inside the mobile shell mount. */
export function useIsDesktopShell(): boolean {
  return useContext(ShellContext) === 'desktop';
}
