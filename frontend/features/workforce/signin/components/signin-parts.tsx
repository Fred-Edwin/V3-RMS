import { Fragment, type ReactNode } from 'react';
import { AlertCircle, Check, Clock, Info } from 'lucide-react';

import { cn } from '@/lib/cn';
import { initialsOf, type SigninNotice } from '../lib/signin-rules';

/** The small pieces every sign-in card shares: the card, the three-step marker, the coloured message bar and the person strip. */

export type SigninStep = 'password' | 'device' | 'pin';
const STEPS: ReadonlyArray<{ id: SigninStep; label: string }> = [
  { id: 'password', label: 'Password' },
  { id: 'device', label: 'This device' },
  { id: 'pin', label: 'PIN' },
];

export function SigninCard({ children }: { children: ReactNode }): JSX.Element {
  return <section className="flex w-full max-w-[480px] flex-col gap-6 rounded-[4px] border border-wds-border bg-wds-surface p-6 shadow-[0_8px_24px_-6px_#17151214] sm:p-10">{children}</section>;
}

/** Password, This device, PIN: done steps carry a tick, the current one a filled ring, the rest an empty one. Icons 20 px (18 on a phone). */
export function StepMarker({ current, skip }: { current: SigninStep; skip?: readonly SigninStep[] }): JSX.Element {
  const order = STEPS.map((s) => s.id);
  const at = order.indexOf(current);
  return (
    <ol className="flex items-center gap-[14px]" aria-label="Sign-in steps">
      {STEPS.map((step, i) => {
        const state = i < at ? 'done' : i === at ? 'current' : 'todo';
        const skipped = skip?.includes(step.id) === true;
        return (
          <Fragment key={step.id}>
            {i > 0 ? <li role="presentation" className="h-px flex-1 bg-wds-border-strong" aria-hidden /> : null}
          <li className="flex items-center" aria-current={state === 'current' ? 'step' : undefined}>
            <span className={cn('flex items-center gap-2 text-[13px] leading-4', state === 'current' ? 'font-semibold text-wds-text-ink' : state === 'done' ? 'text-wds-text-secondary' : 'text-wds-neutral-500', skipped && 'line-through')}>
              {state === 'done' ? (
                <span className="flex size-[18px] items-center justify-center rounded-full bg-wds-success-fg text-white sm:size-5">
                  <Check size={12} strokeWidth={2.5} aria-hidden />
                </span>
              ) : state === 'current' ? (
                <span className="flex size-[18px] items-center justify-center rounded-full bg-wds-espresso-700 sm:size-5" aria-hidden>
                  <span className="size-[7px] rounded-full bg-wds-canvas" />
                </span>
              ) : (
                <span className="size-[18px] rounded-full border-[1.5px] border-wds-border-strong sm:size-5" aria-hidden />
              )}
              <span className="whitespace-nowrap">{step.label}</span>
            </span>
          </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/** The caramel rule above a heading and the heading itself, with a line under it. Paper's device step draws no rule. */
export function Heading({ title, lead, rule = true }: { title: string; lead?: string; rule?: boolean }): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {rule ? <span className="h-0.5 w-8 bg-wds-caramel-500" aria-hidden /> : null}
      <h1 className="font-wds-sans text-[28px] font-semibold leading-[34px] tracking-[-0.025em] text-wds-text-ink sm:text-[34px] sm:leading-[38px]">{title}</h1>
      {lead ? <p className="text-[15px] leading-[22px] text-wds-neutral-700">{lead}</p> : null}
    </div>
  );
}

const NOTICE_LOOK: Record<SigninNotice['kind'], { box: string; icon: JSX.Element }> = {
  wrong: { box: 'border-wds-error-border bg-wds-error-bg text-wds-error-fg', icon: <AlertCircle size={16} aria-hidden /> },
  other: { box: 'border-wds-error-border bg-wds-error-bg text-wds-error-fg', icon: <AlertCircle size={16} aria-hidden /> },
  offline: { box: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg', icon: <Clock size={16} aria-hidden /> },
  paused: { box: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg', icon: <Clock size={16} aria-hidden /> },
  ended: { box: 'border-wds-info-border bg-wds-info-bg text-wds-info-fg', icon: <Info size={16} aria-hidden /> },
};

/** A message above the form in a coloured bar. The fields stay, so nobody starts again. */
export function NoticeBar({ kind, children }: { kind: SigninNotice['kind']; children: ReactNode }): JSX.Element {
  const look = NOTICE_LOOK[kind];
  return (
    <div role={kind === 'ended' ? 'status' : 'alert'} className={cn('flex gap-2.5 border px-3.5 py-3 text-[13px] leading-[19px]', look.box)}>
      <span className="mt-px shrink-0">{look.icon}</span>
      <p>{children}</p>
    </div>
  );
}

/** Who is signing in, with "Not you? Sign out" (device and PIN steps). */
export function PersonStrip({ name, line, onNotYou }: { name: string; line: string; onNotYou: () => void }): JSX.Element {
  return (
    <div className="flex items-center justify-between border-t border-wds-border pt-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-wds-neutral-100 font-wds-mono text-[10px] text-wds-neutral-700" aria-hidden>
          {initialsOf(name)}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-medium leading-4 text-wds-text-ink">{name}</span>
          <span className="truncate text-xs leading-4 text-wds-text-secondary">{line}</span>
        </div>
      </div>
      <button type="button" onClick={onNotYou} className="shrink-0 text-[13px] font-medium leading-4 text-[#8A5A16] hover:underline focus-visible:outline-none focus-visible:shadow-wds-ring">
        Not you? Sign out
      </button>
    </div>
  );
}

/** The espresso button of the sign-in cards: 48 high, a sheen, an optional key hint (Enter). */
export function PrimaryButton({ children, hint, disabled, busy, type = 'button', onClick }: { children: ReactNode; hint?: string; disabled?: boolean; busy?: boolean; type?: 'button' | 'submit'; onClick?: () => void }): JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[2px] bg-[linear-gradient(180deg,#8B5A32_0%,#693C1B_100%)] text-[15px] font-medium leading-[18px] text-wds-canvas shadow-[inset_0_1px_0_#FFFFFF14] transition-[transform,opacity] duration-150 ease-out hover:opacity-95 focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-neutral-500 disabled:shadow-none"
    >
      {busy ? 'One moment…' : children}
      {hint && !busy && !disabled ? <kbd className="hidden border border-white/30 px-1.5 font-wds-mono text-[11px] font-normal leading-4 text-[#EEDDCC] sm:inline">{hint}</kbd> : null}
    </button>
  );
}
