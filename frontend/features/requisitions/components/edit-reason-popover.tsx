'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Textarea } from '@/components/ui2/textarea';

export interface EditReasonPopoverProps {
  anchorRef: React.RefObject<HTMLElement>;
  approvedQty: string;
  reason: string;
  onApprovedQtyChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

/**
 * Inline edit popover for a requisition line (decision #4) — qty + reason
 * commit together. Portaled to `document.body` and positioned from the
 * anchor's `getBoundingClientRect`, not rendered inline next to the cell:
 * the section blocks live inside the detail column's `overflow-y-auto`,
 * the classic popover-in-a-scroll-container clipping failure (HANDOFF-
 * session-b.md's #3 likely-to-go-wrong item). On blur with an empty
 * reason, stays open and marks the field invalid rather than silently
 * reverting the qty.
 */
export function EditReasonPopover({
  anchorRef,
  approvedQty,
  reason,
  onApprovedQtyChange,
  onReasonChange,
  onSave,
  onCancel,
  saving = false,
}: EditReasonPopoverProps) {
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const [reasonTouched, setReasonTouched] = React.useState(false);
  const reasonInvalid = reasonTouched && reason.trim().length === 0;

  React.useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPosition({ top: rect.bottom + window.scrollY + 6, left: rect.right + window.scrollX - 320 });
  }, [anchorRef]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (saving) return;
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (saving) return;
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel, saving]);

  const handleSave = () => {
    if (reason.trim().length === 0) {
      setReasonTouched(true);
      return;
    }
    onSave();
  };

  if (!position) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: 'absolute', top: position.top, left: Math.max(8, position.left) }}
      className="z-50 flex w-80 flex-col gap-wds-3 rounded-wds-lg border border-wds-border bg-wds-surface p-wds-4 shadow-wds-md"
    >
      <div className="flex flex-col gap-wds-1.5">
        <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Approved quantity</label>
        <input
          type="text"
          inputMode="decimal"
          value={approvedQty}
          onChange={(e) => onApprovedQtyChange(e.target.value)}
          disabled={saving}
          className="flex h-8 w-full rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-3 font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring disabled:opacity-60"
        />
      </div>
      <div className="flex flex-col gap-wds-1.5">
        <div className="flex items-baseline gap-wds-1.5">
          <label className="font-wds-sans text-wds-caption font-medium uppercase tracking-wds-label text-wds-text-copy-muted">
            Reason for change
          </label>
          <span className="font-wds-sans text-wds-caption text-wds-error-fg">required</span>
        </div>
        <Textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          onBlur={() => setReasonTouched(true)}
          aria-invalid={reasonInvalid}
          rows={3}
          disabled={saving}
          className={cn(reasonInvalid && 'border-wds-error-fg')}
        />
        {reasonInvalid ? (
          <p className="font-wds-sans text-wds-caption text-wds-error-fg">A reason is required when you change the quantity.</p>
        ) : null}
      </div>
      <div className="flex gap-wds-2">
        <Button variant="secondary" className="grow" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" className="grow" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save line'}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
