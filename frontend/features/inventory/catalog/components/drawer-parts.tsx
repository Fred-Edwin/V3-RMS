import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { SheetOverlay } from '@/components/ui2/sheet';

/**
 * Pieces shared by the catalog's drawers (Paper steps 02–10): a 460px frame
 * with a bordered header, a scrolling body and a bordered footer, plus the
 * mono field label, section label and hairline rows those drawers repeat.
 */

/** One Radix dialog for the whole drawer sequence, so moving item page → edit → review swaps content without re-animating. */
export function DrawerHost({
  open,
  onOpenChange,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name for the dialog (the visible title lives in the frame). */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <SheetOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Focus lands on the panel (or a field that asked for it with autoFocus), not on the Close button, which would show a ring on open.
          onOpenAutoFocus={(event) => {
            const panel = event.currentTarget as HTMLElement | null;
            if (panel && !panel.contains(document.activeElement)) {
              event.preventDefault();
              panel.focus();
            }
          }}
          tabIndex={-1}
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[460px] flex-col bg-white shadow-wds-drawer outline-none',
            'ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:animate-in data-[state=open]:duration-300 data-[state=open]:slide-in-from-right',
            'data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=closed]:slide-out-to-right',
            'motion-reduce:data-[state=open]:slide-in-from-right-0 motion-reduce:data-[state=closed]:slide-out-to-right-0'
          )}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface DrawerFrameProps {
  /** Small mono line above the title: "NEW ITEM", "EDIT ITEM · WHEAT FLOUR". */
  eyebrow?: string;
  title: string;
  /** Title size: forms use 20/26; the item page uses 22/28. */
  titleSize?: 'form' | 'page';
  /** Line under the title: a caption, or the type · category line on the item page. */
  subtitle?: React.ReactNode;
  /** Omit for a read-only page: no footer bar at all. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Gap between body sections. Forms 18, the item page 22. */
  bodyGap?: 'form' | 'page';
}

export function DrawerFrame({ eyebrow, title, titleSize = 'form', subtitle, footer, children, bodyGap = 'form' }: DrawerFrameProps) {
  return (
    <>
      <div className="flex shrink-0 items-start justify-between border-b border-wds-border px-6 pb-4 pt-5">
        <div className={cn('flex min-w-0 flex-col', titleSize === 'page' ? 'gap-1.5' : 'gap-1')}>
          {eyebrow ? <span className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">{eyebrow.toUpperCase()}</span> : null}
          <span
            className={cn(
              'font-wds-sans font-semibold tracking-[-0.01em] text-wds-text-ink',
              titleSize === 'page' ? 'text-[22px] leading-7' : 'text-[20px] leading-[26px]'
            )}
          >
            {title}
          </span>
          {typeof subtitle === 'string' ? <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{subtitle}</span> : subtitle}
        </div>
        <DialogPrimitive.Close
          aria-label="Close"
          className="-mr-1 -mt-0.5 flex size-7 items-center justify-center rounded-wds-sm font-wds-sans text-[20px] leading-5 text-wds-text-secondary transition-colors hover:text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring"
        >
          <span aria-hidden>×</span>
        </DialogPrimitive.Close>
      </div>
      <div className={cn('flex min-h-0 grow flex-col overflow-y-auto px-6 py-[22px]', bodyGap === 'page' ? 'gap-[22px]' : 'gap-[18px]')}>{children}</div>
      {footer ? <div className="flex shrink-0 items-center justify-between gap-3 border-t border-wds-border px-6 py-4">{footer}</div> : null}
    </>
  );
}

/** Mono, uppercase field label (NAME, WHAT IS IT?). `hint` is the quiet "optional" beside it. */
export function FieldLabel({ children, hint, htmlFor }: { children: React.ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <label htmlFor={htmlFor} className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">
        {typeof children === 'string' ? children.toUpperCase() : children}
      </label>
      {hint ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-muted">{hint}</span> : null}
    </span>
  );
}

/** Mono section label for read-only blocks (HOW WE BUY AND USE IT, WHO SELLS IT). */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">{typeof children === 'string' ? children.toUpperCase() : children}</span>;
}

/** Text-field class matching the drawers (38px tall; the name field is 40px), with the selected-edge focus. */
export const fieldClass =
  'flex h-[38px] w-full border border-wds-border-strong bg-white px-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink transition-colors rounded-wds-sm placeholder:text-wds-text-muted focus-visible:outline-none focus-visible:border-wds-selected-edge focus-visible:shadow-[0_0_0_1px_var(--wds-selected-edge)] aria-[invalid=true]:border-wds-error-fg disabled:cursor-not-allowed disabled:opacity-60';

/** A hairline key/value row (Pack · 1 bag = 50 kg). */
export function FactRow({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-wds-neutral-100 py-[9px]">
      <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{label}</span>
      <span className={cn('text-right text-[13px] leading-4 text-wds-text-ink', mono ? 'font-wds-mono' : 'font-wds-sans')}>{children}</span>
    </div>
  );
}

/** A small bordered tag: Preferred (success), To confirm / New (warning). */
export function Tag({ tone, children }: { tone: 'success' | 'warning'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap border px-1.5 py-px font-wds-sans text-[11px] leading-[14px]',
        tone === 'success' ? 'border-wds-success-border bg-wds-success-bg text-wds-success-fg' : 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg'
      )}
    >
      {children}
    </span>
  );
}

/** Inline error banner at the top of a drawer body (states kit: drawer/form error). The input is kept; the primary button retries. */
export function DrawerError({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="border border-wds-error-border bg-wds-error-bg px-3.5 py-2.5 font-wds-sans text-[12px] leading-4 text-wds-error-fg">
      {children}
    </div>
  );
}

export function SecondaryFooterButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button variant="secondary" className={cn('h-9 !px-[18px] text-[14px] font-normal', className)} {...props} />;
}

export function PrimaryFooterButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button className={cn('h-9 !px-[22px] text-[14px]', className)} {...props} />;
}

/** The red text link in the footer ("Retire item"). */
export function DangerLink({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-wds-sm font-wds-sans text-[14px] leading-[18px] text-wds-error-fg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:shadow-wds-ring disabled:opacity-60',
        className
      )}
      {...props}
    />
  );
}
