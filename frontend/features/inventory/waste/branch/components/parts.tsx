'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';
import { ScwPhoneHeader, type ScwPhoneHeaderProps } from '../../../_shared/components/phone-column';

/** The 44 px hit area behind a control Paper draws smaller (D14): an invisible strip, the drawn look is unchanged. `px` is the control's drawn height. */
export const hitArea = (drawnHeight: number): string => {
  const extra = Math.max(0, Math.ceil((44 - drawnHeight) / 2));
  return extra === 0 ? '' : `relative before:absolute before:inset-x-0 before:content-[''] ${extra === 2 ? 'before:-inset-y-[2px]' : extra === 3 ? 'before:-inset-y-[3px]' : 'before:-inset-y-[5px]'}`;
};

/** T5: the mono 10/12 section label, in capitals as typed. */
export function SectionLabel({ children, id, className }: { children: React.ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={cn('font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary', className)}>
      {children}
    </h2>
  );
}

/** The phone header of every Branch waste screen: "WENDO RMS · NYERI TOWN" (the branch the signed-in person belongs to). */
export function BranchHeader(props: Omit<ScwPhoneHeaderProps, 'place'>) {
  const org = useAuthStore((s) => s.user?.organizationName);
  return <ScwPhoneHeader {...props} place={(org ?? 'Branch').toUpperCase()} />;
}

/**
 * Arrow-key movement for a radio group made of `role="radio"` buttons (W9: "one is required"): Left/Up and Right/Down move the choice
 * and the focus together, wrapping at the ends. Put it on the group element.
 */
export function radioGroupKeyDown<T>(event: React.KeyboardEvent<HTMLElement>, values: readonly T[], current: T | null, choose: (v: T) => void): void {
  const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
  const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
  if (!forward && !backward) return;
  event.preventDefault();
  const at = current === null ? -1 : values.indexOf(current);
  const next = (at + (forward ? 1 : -1) + values.length) % values.length;
  const value = values[next];
  if (value === undefined) return;
  choose(value);
  const radios = event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
  radios[next]?.focus();
}

/** Roving tab stop for a radio group: the chosen radio, else the first one. */
export const radioTabIndex = (index: number, chosen: boolean, anyChosen: boolean): 0 | -1 => (chosen || (!anyChosen && index === 0) ? 0 : -1);
