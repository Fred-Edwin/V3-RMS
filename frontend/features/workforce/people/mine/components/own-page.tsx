'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * A full page on a phone for one task of My file (frames 8.3 to 8.6): the dark band with a back arrow and a small caps line, a 24 px
 * title and one line under it, then the body. It covers the screen, so nothing from the shell sits above it.
 */
export function OwnPage({
  kicker,
  title,
  subtitle,
  onBack,
  backLabel,
  children,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  onBack: () => void;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-wds-canvas">
      <header className="flex shrink-0 flex-col gap-[14px] bg-[#2C1707] px-4 pb-5 pt-[18px]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label={backLabel} className="-my-[10px] -ml-2.5 flex h-11 w-11 items-center justify-center border-0 bg-transparent font-wds-sans text-[20px] leading-6 text-[#EBDFD6] outline-none focus-visible:shadow-wds-ring">
            ←
          </button>
          <span className="-ml-[13px] font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-[#B5AEA5]">{kicker}</span>
        </div>
        <h1 className="m-0 font-wds-sans text-[24px] font-semibold leading-7 tracking-[-0.02em] text-white">{title}</h1>
        <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-[#D9CBBF]">{subtitle}</p>
      </header>
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-4 pb-7 pt-5">{children}</div>
    </div>
  );
}

const BUTTON =
  'flex h-12 w-full items-center justify-center gap-2.5 rounded-[2px] border-0 bg-wds-primary font-wds-sans text-[15px] font-medium leading-[18px] text-white outline-none transition-colors hover:bg-wds-primary-hover focus-visible:shadow-wds-ring disabled:cursor-not-allowed disabled:opacity-60';

/** The one brown button of a page: 48 px high, square corners (frame 8.3). */
export function OwnButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn(BUTTON, className)} {...props}>
      {children}
    </button>
  );
}

/** A plain amber underlined action under the brown button: Cancel, Choose another (frames 8.4 to 8.6). */
export function OwnTextButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn('flex h-12 items-center justify-center border-0 bg-transparent font-wds-sans text-[14px] font-medium leading-[18px] text-[#A8680A] underline decoration-1 underline-offset-[3px] outline-none focus-visible:shadow-wds-ring', className)}
      {...props}
    >
      {children}
    </button>
  );
}
