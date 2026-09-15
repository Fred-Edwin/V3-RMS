'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';

/**
 * WDS Confirm Dialog — new primitive, not sourced from Paper (Paper never
 * draws a delete/retire confirmation anywhere in this milestone's file).
 * Built on the same `@radix-ui/react-dialog` primitive Sheet already uses,
 * as a small centered modal rather than a side drawer — matches the
 * "simple confirm dialog, extra typed confirmation only when blocked"
 * pattern approved 2026-09-15: friction scales with actual risk instead of
 * demanding a typed name for every retire action.
 */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** When set, the dialog escalates: the confirm button stays disabled until the user types this exact string. */
  requireTypedConfirmation?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  confirming?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  requireTypedConfirmation,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  confirming = false,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = React.useState('');

  React.useEffect(() => {
    if (open) setTypedValue('');
  }, [open]);

  const isBlocked = Boolean(requireTypedConfirmation) && typedValue !== requireTypedConfirmation;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-wds-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2',
            'rounded-wds-md border border-wds-border bg-wds-surface p-wds-6 shadow-wds-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <DialogPrimitive.Title className="font-wds-sans text-wds-h2 font-semibold text-wds-text-ink">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-wds-2 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            {description}
          </DialogPrimitive.Description>

          {requireTypedConfirmation ? (
            <div className="mt-wds-4 flex flex-col gap-wds-1.5">
              <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">
                Type &quot;{requireTypedConfirmation}&quot; to confirm
              </label>
              <input
                autoFocus
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                className="flex h-8 w-full items-center rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-3 font-wds-sans text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
              />
            </div>
          ) : null}

          <div className="mt-wds-6 flex justify-end gap-wds-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              onClick={onConfirm}
              disabled={isBlocked || confirming}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
