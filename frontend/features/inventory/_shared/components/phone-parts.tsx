'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { useAuthStore } from '@/store/authStore';

/**
 * Parts the Central Store phone screens share (Paper chapters 6 and 7, "Parts · phone shell"):
 * the dark header (no status bar: that belongs to the phone), the mono field label, the full-width primary button and the
 * green "done" note. The header carries a back arrow (a task) or a menu (a landing screen).
 */

export function initialsOf(name: string | undefined | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export interface PhoneHeaderProps {
  title: string;
  subtitle: string;
  /** `back` for a task opened from another screen, `menu` for a landing screen. */
  leading: 'back' | 'menu';
  onLeading?: () => void;
  className?: string;
}

export function PhoneHeader({ title, subtitle, leading, onLeading, className }: PhoneHeaderProps) {
  const initials = useAuthStore((s) => initialsOf(s.user?.name));
  const orgName = useAuthStore((s) => s.user?.organizationName);
  return (
    <header className={cn('flex shrink-0 flex-col bg-wds-sidebar-top', className)}>
      <div className="flex flex-col gap-2.5 px-4 pb-[18px] pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLeading}
            aria-label={leading === 'back' ? 'Back' : 'Open menu'}
            className="-m-2 flex size-11 shrink-0 items-center justify-center outline-none focus-visible:shadow-wds-ring"
          >
            {leading === 'back' ? (
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <span className="grow font-wds-mono text-[11px] leading-[14px] tracking-[0.08em] text-wds-espresso-400">
            WENDO RMS · {(orgName ?? 'Hub').toUpperCase()}
          </span>
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-wds-espresso-800 font-wds-mono text-[11px] leading-[14px] text-[#EBDFD6]">
            {initials}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className="font-wds-sans text-[22px] font-semibold leading-7 text-white">{title}</h1>
          <p className="font-wds-sans text-[13px] leading-[18px] text-[#B5AEA5]">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}

/** "NAME", "HOW IT ARRIVES": mono, 10px, tracked. */
export function PhoneFieldLabel({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-ink', className)}>
      {children}
    </label>
  );
}

/** The full-width 52px primary button every phone screen ends on. */
export function PhonePrimaryButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button className={cn('h-[52px] w-full text-[16px] font-semibold leading-5', className)} {...props} />;
}

/** The "2 levels saved" / "Tomato paste added" note. */
export function PhoneSuccessNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="flex gap-2.5 border border-wds-success-border bg-wds-success-bg px-3.5 py-3">
      <span className="mt-[5px] size-2 shrink-0 rounded-[4px] bg-wds-success-fg" />
      <div className="flex flex-col gap-0.5">
        <p className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-success-fg">{title}</p>
        <p className="font-wds-sans text-[12px] leading-[17px] text-wds-text-ink">{children}</p>
      </div>
    </div>
  );
}

/** A failed request, at the top of the screen, with what the person typed still below it. */
export function PhoneErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
      {children}
    </div>
  );
}
