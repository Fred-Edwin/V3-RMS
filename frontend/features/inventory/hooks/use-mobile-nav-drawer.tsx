'use client';

import * as React from 'react';

/**
 * Shared open/close state for `InventoryMobileNavDrawer`, now mounted once by
 * `app/app/inventory/(shell)/layout.tsx` instead of per-screen. Screens call
 * `open()` from their `MobileHubHeader`'s `onMenuClick`; the layout reads
 * `isOpen`/`close` to render the drawer itself.
 */
const MobileNavDrawerContext = React.createContext<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
} | null>(null);

export function MobileNavDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const value = React.useMemo(
    () => ({ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }),
    [isOpen]
  );
  return <MobileNavDrawerContext.Provider value={value}>{children}</MobileNavDrawerContext.Provider>;
}

export function useMobileNavDrawer() {
  const ctx = React.useContext(MobileNavDrawerContext);
  if (!ctx) throw new Error('useMobileNavDrawer must be used within MobileNavDrawerProvider');
  return ctx;
}
