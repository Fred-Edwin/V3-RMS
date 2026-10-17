import * as React from 'react';

import { cn } from '@/lib/cn';

import { HomeButton } from './home-button';
import { SectionHeader } from './section-header';

/**
 * "Waiting for you": approvals one tap each. Two looks of one card (Paper PXC-0 desktop column, QJV-0 phone card):
 * a title and a grey line, then the buttons. Approve is brown, Decline outlined; a row the person may only read ("See why") carries
 * just one outlined button. Each button is passed only when the person may use it.
 */
export type WaitingKind = 'overtime' | 'request' | 'casuals' | 'leave';

export interface WaitingAction {
  label: string;
  /** `primary` is the brown one; use it once per row. */
  kind?: 'primary' | 'outlined';
  onClick: () => void;
}

export interface WaitingItem {
  key: string;
  /** "Overtime · Brian Otieno". */
  title: string;
  detail: string;
  /** Colours the phone card's left edge. */
  kind?: WaitingKind;
  actions: readonly WaitingAction[];
}

const EDGE: Record<WaitingKind, string> = {
  overtime: 'bg-wds-caramel-600',
  request: 'bg-wds-caramel-600',
  casuals: 'bg-wds-info-fg',
  leave: 'bg-wds-caramel-600',
};

export function WaitingForYouColumn({ items, openAll, className }: { items: readonly WaitingItem[]; openAll?: { label: string; onClick: () => void }; className?: string }) {
  return (
    <section aria-label="Waiting for you" className={cn('flex min-w-0 flex-col', className)}>
      <SectionHeader title="Waiting for you" link={openAll} />
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((item) => (
          <li key={item.key} className="flex flex-col gap-2.5 border-b border-wds-border py-3.5 last:border-b-0">
            <div className="flex flex-col gap-0.5">
              <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{item.title}</span>
              <span className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">{item.detail}</span>
            </div>
            <div className="flex gap-2">
              {item.actions.map((a) => (
                <HomeButton key={a.label} size="compact" kind={a.kind ?? 'outlined'} onClick={a.onClick} aria-label={`${a.label}: ${item.title}`}>
                  {a.label}
                </HomeButton>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WaitingForYouCard({ items, className }: { items: readonly WaitingItem[]; className?: string }) {
  return (
    <section aria-label="Waiting for you" className={cn('flex flex-col border border-wds-border bg-wds-surface shadow-[0_10px_24px_-18px_color-mix(in_oklab,var(--wds-neutral-950)_18%,transparent)]', className)}>
      <header className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="m-0 font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">Waiting for you</h2>
        <span className="bg-wds-primary px-2 py-px font-wds-mono text-[13px] font-medium leading-4 text-wds-primary-fg">{items.length}</span>
      </header>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((item) => (
          <li key={item.key} className="flex gap-3.5 border-t border-wds-border px-5 py-3.5">
            <span aria-hidden className={cn('w-[3px] shrink-0', EDGE[item.kind ?? 'request'])} />
            <div className="flex min-w-0 grow flex-col gap-2.5">
              <div className="flex flex-col gap-[3px]">
                <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{item.title}</span>
                <span className="font-wds-sans text-[13px] leading-5 text-wds-text-secondary">{item.detail}</span>
              </div>
              <div className="flex gap-2">
                {item.actions.map((a) => (
                  <HomeButton key={a.label} size="card" kind={a.kind ?? 'outlined'} className={a.kind === 'primary' ? undefined : 'px-4'} onClick={a.onClick} aria-label={`${a.label}: ${item.title}`}>
                    {a.label}
                  </HomeButton>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
