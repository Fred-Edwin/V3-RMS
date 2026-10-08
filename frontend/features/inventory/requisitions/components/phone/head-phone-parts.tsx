'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';
import { useMobileNavDrawer } from '../../../_shared/hooks/use-mobile-nav-drawer';
import { initialsOf } from '../../../_shared/components/phone-parts';
import { PHONE_SECONDARY_BUTTON } from '../../../_shared/lib/phone-styles';
import type { Banner, RailStep } from '../../_shared/lib/phone-words';

/**
 * Parts of the Department Head's phone screens, drawn from Paper steps 1 to 6, 10, 14, 15, 18 and G1: the dark header (a back arrow
 * on a task, the menu icon on the home; never a status bar), the sticky footer, the status banner, the "where it is" tracker, the
 * category heading and the quantity stepper. Values are from `get_jsx` on step 3 (`27S2-0`) and steps 6, 10, 14.
 */

export interface HeadPhoneHeaderProps {
  title: string;
  /** The line under the title. `mono` draws a reference line ("REQ-NYR-0112 · started 1:41 pm") in Geist Mono. */
  subtitle: string;
  mono?: boolean;
  leading: 'back' | 'menu';
  onBack?: () => void;
  children?: React.ReactNode;
}

export function HeadPhoneHeader({ title, subtitle, mono = false, leading, onBack, children }: HeadPhoneHeaderProps) {
  const initials = useAuthStore((s) => initialsOf(s.user?.name));
  const orgName = useAuthStore((s) => s.user?.organizationName);
  const { open } = useMobileNavDrawer();
  return (
    <header className="flex shrink-0 flex-col bg-wds-sidebar-top">
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={leading === 'back' ? onBack : open}
              aria-label={leading === 'back' ? 'Back' : 'Open menu'}
              className="-m-3 flex size-11 shrink-0 items-center justify-center rounded-wds-sm text-wds-sidebar-fg-active outline-none transition-[background-color,opacity] duration-150 hover:bg-white/10 focus-visible:shadow-wds-ring active:opacity-70"
            >
              {leading === 'back' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <span className="font-wds-sans text-[12px] uppercase leading-4 tracking-[0.06em] text-wds-espresso-400">WENDO RMS · {orgName ?? ''}</span>
          </div>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[14px] bg-wds-espresso-800 font-wds-sans text-[11px] leading-[14px] text-wds-espresso-100" aria-hidden="true">
            {initials}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className="font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.01em] text-wds-neutral-0">{title}</h1>
          <p className={cn('text-[#B5AEA5]', mono ? 'font-wds-mono text-[12px] leading-4' : 'font-wds-sans text-[13px] leading-[18px]')}>{subtitle}</p>
        </div>
        {children}
      </div>
    </header>
  );
}

/** The sticky footer: a summary line over the one primary button. */
export function HeadFooter({ summary, aside, children }: { summary?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <footer className="flex shrink-0 flex-col gap-3 border-t border-wds-border bg-wds-surface px-5 pb-5 pt-3.5">
      {summary || aside ? (
        <div className="flex items-center justify-between gap-3">
          <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink" aria-live="polite">
            {summary}
          </p>
          {aside ? <p className="font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{aside}</p> : null}
        </div>
      ) : null}
      {children}
    </footer>
  );
}

export function HeadPrimaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  // Paper steps 1 to 6 draw the lighter primary gradient (oklab 57.3% to 29.3%), the system `gradient-primary` token.
  return (
    <button
      type="button"
      className={cn(
        'flex h-12 w-full shrink-0 items-center justify-center rounded-[2px] bg-wds-gradient-primary font-wds-sans text-[15px] font-medium leading-5 text-wds-primary-fg outline-none transition-[filter,transform,box-shadow] duration-100 focus-visible:shadow-wds-ring enabled:hover:brightness-110 enabled:active:brightness-95 enabled:motion-safe:active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function HeadSecondaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn(PHONE_SECONDARY_BUTTON, 'h-12 w-full text-[15px]', className)} {...props} />;
}

/** A hint under a footer button ("Allowed until your delivery is signed ..."). */
export function HeadFooterHint({ children }: { children: React.ReactNode }) {
  return <p className="text-center font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{children}</p>;
}

const BANNER_TONE: Record<Banner['tone'], { box: string; title: string; dot: string }> = {
  warning: { box: 'border-wds-warning-border bg-wds-warning-bg', title: 'text-wds-warning-fg', dot: 'bg-wds-warning-fg' },
  info: { box: 'border-wds-info-border bg-wds-info-bg', title: 'text-wds-info-fg', dot: 'bg-wds-info-fg' },
  success: { box: 'border-wds-success-border bg-wds-success-bg', title: 'text-wds-success-fg', dot: 'bg-wds-success-fg' },
  error: { box: 'border-wds-error-border bg-wds-error-bg', title: 'text-wds-error-fg', dot: 'bg-wds-error-fg' },
};

/** "Waiting for the Branch Manager", "The Branch Manager changed 1 line", "Approved, with the store": one coloured card, a title and a line. */
export function StatusBanner({ banner }: { banner: Banner }) {
  const tone = BANNER_TONE[banner.tone];
  return (
    <section className={cn('flex flex-col gap-2 border p-4', tone.box)} role="status">
      <h2 className={cn('flex items-center gap-2 font-wds-sans text-[16px] font-semibold leading-5', tone.title)}>
        <span className={cn('size-2 shrink-0 rounded-full', tone.dot)} aria-hidden="true" />
        {banner.title}
      </h2>
      <p className="font-wds-sans text-[14px] leading-5 text-wds-text-ink">{banner.body}</p>
    </section>
  );
}

/** The "Where it is" tracker: filled green dot done, ring current, grey ring still to do, joined by a rail. */
export function HeadRail({ steps, currentTone = 'warning' }: { steps: RailStep[]; currentTone?: 'warning' | 'info' }) {
  return (
    <section aria-label="Where it is" className="flex flex-col gap-3">
      <h2 className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">Where it is</h2>
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          const next = steps[i + 1];
          return (
            <li key={step.key} className="flex gap-3" aria-current={step.state === 'CURRENT' ? 'step' : undefined}>
              <div className="flex w-[14px] shrink-0 flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 size-[14px] shrink-0 rounded-full border-2',
                    step.state === 'DONE' && 'border-wds-success-fg bg-wds-success-fg',
                    step.state === 'CURRENT' && (currentTone === 'info' ? 'border-wds-info-fg bg-wds-surface' : 'border-wds-warning-fg bg-wds-surface'),
                    step.state === 'TODO' && 'border-wds-border-strong bg-wds-surface',
                  )}
                />
                {!last ? <span aria-hidden="true" className={cn('w-0.5 grow', step.state === 'DONE' && next?.state !== 'TODO' ? 'bg-wds-success-fg' : 'bg-wds-border-strong')} /> : null}
              </div>
              <div className={cn('flex min-w-0 flex-col gap-0.5', last ? 'pb-0' : 'pb-4')}>
                <p className={cn('font-wds-sans text-[16px] leading-5', step.state === 'TODO' ? 'text-wds-text-secondary' : 'font-medium text-wds-text-ink')}>{step.title}</p>
                {step.line ? <p className="font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{step.line}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** A category heading with the line count on the right. */
export function CategoryHeading({ heading, trailing }: { heading: string; trailing: string }) {
  return (
    <div role="presentation" className="flex items-center justify-between border-b border-wds-border bg-wds-neutral-50 px-5 py-[9px]">
      <h3 className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">{heading}</h3>
      <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{trailing}</span>
    </div>
  );
}

export interface StepperProps {
  itemName: string;
  value: string;
  onChange: (raw: string) => void;
  onCommit: () => void;
  onStep: (delta: 1 | -1) => void;
  changed?: boolean;
}

/** The − 22 + stepper: 40 px tall, 36 / 44 / 36 wide, typing allowed. */
export function Stepper({ itemName, value, onChange, onCommit, onStep, changed = false }: StepperProps) {
  const btn =
    'flex h-full w-9 shrink-0 items-center justify-center bg-transparent font-wds-sans text-[20px] leading-5 text-wds-text-ink outline-none transition-colors focus-visible:relative focus-visible:z-10 focus-visible:shadow-wds-ring enabled:hover:bg-wds-neutral-100 active:bg-wds-neutral-100 disabled:text-wds-text-faint';
  return (
    <div role="group" aria-label={`Quantity of ${itemName}`} className="flex h-10 shrink-0 items-center border border-wds-border-strong bg-wds-surface">
      <button type="button" className={btn} aria-label={`Fewer ${itemName}`} onClick={() => onStep(-1)} disabled={Number(value) <= 1}>
        <span aria-hidden="true">−</span>
      </button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        inputMode="decimal"
        aria-label={`${itemName} quantity`}
        className={cn(
          'h-full w-11 shrink-0 border-x border-wds-border bg-transparent text-center font-wds-mono text-[16px] leading-5 text-wds-text-ink outline-none focus-visible:relative focus-visible:z-10 focus-visible:shadow-wds-ring',
          changed && 'font-semibold',
        )}
      />
      <button type="button" className={btn} aria-label={`More ${itemName}`} onClick={() => onStep(1)}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

/** The two inline links on a text row ("Change lines", "+ Add an item"). 44 px touch target without moving the row. */
export function RowLink({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="-my-3 flex min-h-11 shrink-0 items-center rounded-wds-sm px-1 font-wds-sans text-[14px] font-medium leading-[18px] text-wds-selected-edge outline-none transition-[background-color,opacity] duration-100 hover:bg-wds-caramel-100 focus-visible:shadow-wds-ring active:opacity-70 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
