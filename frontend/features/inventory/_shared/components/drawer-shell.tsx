import * as React from 'react';

import { Button } from '@/components/ui2/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/components/ui2/sheet';

/**
 * Drawer Shell — the standard right-side drawer used by all 4 Milestone One
 * desktop drawers (Item create/edit, Manage categories, New/edit supplier,
 * Par levels). A thin composite over the `Sheet` primitive: the header
 * (title + description, always present — "carries the record's context
 * line, never blank") and footer (secondary Cancel + primary action) are
 * the part every drawer repeats verbatim, so this wires them in instead of
 * every screen hand-assembling `SheetHeader`/`SheetFooter` itself.
 *
 * Reference: `SMI-0`/`SKW-0` (Milestone One, Item create/edit drawer) — the
 * 500px width, header/body/footer padding, and scrim are already codified
 * in `ui2/sheet.tsx` (confirmed identical via `get_computed_styles` on
 * `SMD-0`/`SL2-0`/`SKX-0` vs. the Shells & Primitives page's generic
 * 460px specimen, `4CK-0` — Milestone One's real drawers are the 500px
 * variant already built, not the shell page's illustrative one).
 */
export interface DrawerShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** Primary action button label, e.g. "Create item" / "Save changes". */
  primaryLabel: string;
  onPrimaryAction?: () => void;
  primaryDisabled?: boolean;
  cancelLabel?: string;
  onCancel?: () => void;
  /** Extra content rendered in the body, below `children` — used for a "Retire" link on the edit variant, since Paper never drew a delete affordance for this shell to reserve room for. */
  footerExtra?: React.ReactNode;
  /** `bottom` = phone sheet (Paper "Pre-Demo · Phone screens" 4). */
  side?: 'right' | 'bottom';
  /** Block 2 drawers (Paper D15, D19): 520 wide, 28px padding, the context line above a 22/28 title, 44px buttons. */
  paper?: boolean;
  /** Width of a `paper` drawer in px: 520 for D15, 540 for D19. */
  paperWidth?: number;
  /**
   * Block 4 day drawers (Paper B8, B12, B15): 560 wide, a 1px ink left edge, the 20/26 title above a 13/18 context line, a close glyph,
   * a text-link Cancel at the left and a 44-high primary of natural width at the right, over a 45% scrim.
   */
  variant?: 'default' | 'day';
  /** Day variant: the header's bottom padding (B8 and B12 draw 18, B15 draws 16) and the body's vertical padding (20, or 16 on B15). */
  compact?: boolean;
  /** Day variant: hides the close glyph (nothing in Paper's B15 draws one, kept as an option; the build keeps it on every drawer, C21). */
  hideCloseGlyph?: boolean;
  /** Day variant: replaces the primary button (for a step that needs two actions). */
  footerPrimary?: React.ReactNode;
  /** Day variant: a selector for the element that takes focus when the drawer opens (the first thing to fill), instead of the close glyph. */
  initialFocus?: string;
  /** Day variant: return true to keep the drawer open on Escape (an inner list handles that key itself). */
  escapeGuard?: () => boolean;
  children: React.ReactNode;
}

export function DrawerShell({
  open,
  onOpenChange,
  title,
  description,
  primaryLabel,
  onPrimaryAction,
  primaryDisabled,
  cancelLabel = 'Cancel',
  onCancel,
  footerExtra,
  side = 'right',
  paper = false,
  paperWidth = 520,
  variant = 'default',
  compact = false,
  hideCloseGlyph = false,
  footerPrimary,
  initialFocus,
  escapeGuard,
  children,
}: DrawerShellProps) {
  const bottom = side === 'bottom';
  if (variant === 'day' && !bottom) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          hideClose
          overlayClassName="bg-[#17151273]"
          onEscapeKeyDown={(event) => {
            if (escapeGuard?.()) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            const target = initialFocus ? document.querySelector<HTMLElement>(initialFocus) : null;
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          style={{ width: 560 }}
          // Opens in 300ms and leaves in 200ms on a strong ease-out (slow where the person decides, fast where the system answers).
          className="gap-0 border-l border-wds-text-ink p-0 shadow-none ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:duration-200 data-[state=open]:duration-300 sm:max-w-full max-sm:!w-full motion-reduce:data-[state=closed]:duration-100 motion-reduce:data-[state=open]:duration-100"
        >
          <div className={`flex shrink-0 items-start justify-between border-b border-wds-border px-7 pt-6 ${compact ? 'pb-4' : 'pb-[18px]'}`}>
            <div className="flex min-w-0 flex-col gap-1">
              <SheetTitle className="!text-[20px] font-semibold !leading-[26px] tracking-[-0.01em] text-wds-text-ink">{title}</SheetTitle>
              <SheetDescription className="!text-[13px] !leading-[18px] text-wds-text-secondary">{description}</SheetDescription>
            </div>
            {hideCloseGlyph ? null : (
              <button
                type="button"
                aria-label="Close"
                onClick={onCancel ?? (() => onOpenChange(false))}
                className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center text-wds-text-secondary outline-none transition-[color,transform] duration-150 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.92] [@media(hover:hover)]:hover:text-wds-text-ink"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
          <div className={`flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-7 ${compact ? 'py-4' : 'py-5'}`}>
            {children}
            {footerExtra}
          </div>
          <div className="flex shrink-0 items-center justify-between border-t border-wds-border px-7 pb-[22px] pt-4">
            <button
              type="button"
              onClick={onCancel ?? (() => onOpenChange(false))}
              className="-ml-1 px-1 py-2 font-wds-sans text-[14px] font-medium leading-[18px] text-wds-selected-edge outline-none transition-[color,transform] duration-150 ease-out focus-visible:shadow-wds-ring motion-safe:active:scale-[0.97] [@media(hover:hover)]:hover:underline"
            >
              {cancelLabel}
            </button>
            {footerPrimary ?? (
              <Button size="drawer" onClick={onPrimaryAction} disabled={primaryDisabled} className="disabled:opacity-[0.45]">
                {primaryLabel}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  if (paper && !bottom) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" style={{ width: paperWidth }} className="gap-[18px] overflow-y-auto border-l border-wds-text-ink p-7 shadow-none">
          <div className="flex flex-col gap-1.5">
            <SheetDescription className="!font-wds-mono !text-[11px] uppercase !leading-[14px] tracking-[0.06em] text-wds-text-secondary">{description}</SheetDescription>
            <SheetTitle className="!text-[22px] font-semibold !leading-7 tracking-[-0.01em] text-wds-text-ink">{title}</SheetTitle>
          </div>
          {children}
          {footerExtra}
          <div className="mt-auto flex gap-2.5">
            <Button variant="secondary" className="h-11 bg-white px-5 text-[14px] leading-[18px]" onClick={onCancel ?? (() => onOpenChange(false))}>
              {cancelLabel}
            </Button>
            <Button className="h-11 grow basis-0 text-[14px] leading-[18px]" onClick={onPrimaryAction} disabled={primaryDisabled}>
              {primaryLabel}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={bottom ? 'max-h-[92vh] rounded-t-wds-md' : undefined}>
        <SheetHeader className={bottom ? '!px-4' : undefined}>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className={bottom ? 'flex flex-1 flex-col gap-wds-4 overflow-y-auto px-4 py-4' : 'flex flex-1 flex-col gap-wds-4 overflow-y-auto px-wds-6 py-wds-5'}>
          {children}
          {footerExtra}
        </div>
        <SheetFooter className={bottom ? '!px-4 !pb-5 [&>*]:h-11 [&>*]:flex-1' : undefined}>
          <Button variant="secondary" onClick={onCancel ?? (() => onOpenChange(false))}>
            {cancelLabel}
          </Button>
          <Button onClick={onPrimaryAction} disabled={primaryDisabled}>
            {primaryLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
