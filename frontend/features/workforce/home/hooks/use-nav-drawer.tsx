'use client';

import * as React from 'react';

import { ShellNavDrawer } from '@/components/app/shell/shell-nav-drawer';

/**
 * Open and close state for the shell's menu drawer on a phone. A Workforce screen draws its own phone header (the shell draws none for a
 * rebuilt page), whose menu button calls `open()`; the Workforce layout mounts the drawer itself. Same job as Inventory's drawer
 * provider, kept here so Workforce never imports Inventory internals.
 */
const Context = React.createContext<{ open: () => void; close: () => void } | null>(null);

export function WorkforceNavDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const value = React.useMemo(() => ({ open: () => setIsOpen(true), close: () => setIsOpen(false) }), []);
  return (
    <Context.Provider value={value}>
      {children}
      <ShellNavDrawer open={isOpen} onOpenChange={setIsOpen} />
    </Context.Provider>
  );
}

/** The menu button's action. Outside the provider (the dev gallery) it does nothing, so a header can be drawn anywhere. */
export function useWorkforceNavDrawer(): { open: () => void } {
  const ctx = React.useContext(Context);
  return { open: ctx?.open ?? (() => undefined) };
}
