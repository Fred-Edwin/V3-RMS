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
  children,
}: DrawerShellProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-wds-4 overflow-y-auto px-wds-6 py-wds-5">{children}</div>
        <SheetFooter>
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
