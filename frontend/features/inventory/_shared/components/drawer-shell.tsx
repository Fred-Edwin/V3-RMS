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
  description: string;
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
  children,
}: DrawerShellProps) {
  const bottom = side === 'bottom';
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
