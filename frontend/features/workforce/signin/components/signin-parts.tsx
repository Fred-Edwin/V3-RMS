import { Fragment, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, Check, Clock, Info } from 'lucide-react';

import { cn } from '@/lib/cn';
import { initialsOf, type SigninNotice } from '../lib/signin-rules';

/**
 * The small pieces every sign-in screen shares: the card, the three-step marker, the coloured message bar and the person strip.
 * Paper draws two layouts and they differ on purpose: from 1024 px up a white card on the right of the brand panel; below that no card at
 * all, the content sits on the page with the heading and fields at the top and the actions pinned to the bottom (390 px frames).
 */

export type SigninStep = 'password' | 'device' | 'pin';
const STEPS: ReadonlyArray<{ id: SigninStep; label: string }> = [
  { id: 'password', label: 'Password' },
  { id: 'device', label: 'This device' },
  { id: 'pin', label: 'PIN' },
];

interface CardProps {
  /** Heading, message bar and fields. */
  top: ReactNode;
  /** The actions: the button, the "once" link, the person strip, the phone support lines. Pinned to the bottom on a phone. */
  bottom?: ReactNode;
  /** Sits between the two groups (the phone number pad); draws nothing on a computer when the part hides itself. */
  middle?: ReactNode;
  /** The phone's Set your PIN frame spaces its top group 18 px apart, the others 24. */
  snug?: boolean;
  /** Render the card as the sign-in form. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}

export function SigninCard({ top, middle, bottom, snug = false, onSubmit }: CardProps): JSX.Element {
  const className =
    'mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-between gap-6 lg:mx-0 lg:flex-none lg:justify-start lg:rounded-[4px] lg:border lg:border-wds-border lg:bg-wds-surface lg:p-10 lg:shadow-[0_8px_24px_-6px_#17151214]';
  const body = (
    <>
      <div className={cn('flex flex-col lg:gap-6', snug ? 'gap-[18px]' : 'gap-6')}>{top}</div>
      {middle}
      {bottom ? <div className="flex flex-col gap-[18px] lg:gap-6">{bottom}</div> : null}
    </>
  );
  return onSubmit ? (
    <form className={className} onSubmit={onSubmit} noValidate>
      {body}
    </form>
  ) : (
    <section className={className}>{body}</section>
  );
}

/** Password, This device, PIN: done steps carry a tick, the current one a filled ring, the rest an empty one. Icons 20 px (18 on a phone). */
export function StepMarker({ current, skip }: { current: SigninStep; skip?: readonly SigninStep[] }): JSX.Element {
  const order = STEPS.map((s) => s.id);
  const at = order.indexOf(current);
  return (
    <ol className="flex items-center gap-3 lg:gap-[14px]" aria-label="Sign-in steps">
      {STEPS.map((step, i) => {
        const state = i < at ? 'done' : i === at ? 'current' : 'todo';
        const skipped = skip?.includes(step.id) === true;
        return (
          <Fragment key={step.id}>
            {i > 0 ? <li role="presentation" className="h-px flex-1 bg-wds-border-strong" aria-hidden /> : null}
            <li className="flex items-center" aria-current={state === 'current' ? 'step' : undefined}>
              <span className={cn('flex items-center gap-[7px] text-[13px] leading-4 lg:gap-2', state === 'current' ? 'font-semibold text-wds-text-ink' : state === 'done' ? 'text-wds-text-secondary' : 'text-wds-neutral-500', skipped && 'line-through')}>
                {state === 'done' ? (
                  <span className="flex size-[18px] items-center justify-center rounded-full bg-wds-success-fg text-white lg:size-5">
                    <Check size={12} strokeWidth={2.5} aria-hidden />
                  </span>
                ) : state === 'current' ? (
                  <span className="flex size-[18px] items-center justify-center rounded-full bg-wds-espresso-700 lg:size-5" aria-hidden>
                    <span className="size-1.5 rounded-full bg-wds-canvas lg:size-[7px]" />
                  </span>
                ) : (
                  <span className="size-[18px] rounded-full border-[1.5px] border-wds-border-strong lg:size-5" aria-hidden />
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

/**
 * The heading and the line under it. The caramel rule above it is drawn on a computer only, and not on the device step (Paper 3.2 draws
 * none there); the phone frames draw no rule at all.
 */
export function Heading({ title, lead, rule = true, tight = false }: { title: string; lead?: string; rule?: boolean; tight?: boolean }): JSX.Element {
  return (
    <div className={cn('flex flex-col lg:gap-3', tight ? 'gap-1.5' : 'gap-2')}>
      {rule ? <span className="hidden h-0.5 w-8 bg-wds-caramel-500 lg:block" aria-hidden /> : null}
      <h1 className="font-wds-sans text-[30px] font-semibold leading-[34px] tracking-[-0.025em] text-wds-text-ink lg:text-[34px] lg:leading-[38px]">{title}</h1>
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

/** Who is signing in, with "Not you? Sign out" (device and PIN steps). The phone frames draw no initials box. */
export function PersonStrip({ name, line, onNotYou, snug = false }: { name: string; line: string; onNotYou: () => void; snug?: boolean }): JSX.Element {
  return (
    <div className={cn('flex items-center justify-between border-t border-wds-border lg:pt-5', snug ? 'pt-3' : 'pt-3.5')}>
      <div className="flex items-center gap-2.5">
        <span className="hidden size-7 shrink-0 items-center justify-center rounded-[2px] bg-wds-neutral-100 font-wds-mono text-[10px] text-wds-neutral-700 lg:flex" aria-hidden>
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

/** The espresso button of the sign-in screens: 48 high on a computer (52 on a phone), a sheen, an optional key hint (Enter) on a computer. */
export function PrimaryButton({ children, hint, disabled, busy, type = 'button', onClick }: { children: ReactNode; hint?: string; disabled?: boolean; busy?: boolean; type?: 'button' | 'submit'; onClick?: () => void }): JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[2px] bg-[linear-gradient(180deg,#8B5A32_0%,#693C1B_100%)] text-base font-medium leading-5 text-wds-canvas shadow-[inset_0_1px_0_#FFFFFF14] transition-[transform,opacity] duration-150 ease-out hover:opacity-95 focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-neutral-500 disabled:shadow-none lg:h-12 lg:text-[15px] lg:leading-[18px]"
    >
      {busy ? 'One moment…' : children}
      {hint && !busy && !disabled ? <kbd className="hidden border border-white/30 px-1.5 font-wds-mono text-[11px] font-normal leading-4 text-[#EEDDCC] lg:inline">{hint}</kbd> : null}
    </button>
  );
}
