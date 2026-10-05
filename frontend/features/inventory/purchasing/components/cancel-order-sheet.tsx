'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { Textarea } from '@/components/ui2/textarea';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { useIsNarrow } from '../hooks/use-order';
import { usePurchasing } from '../hooks/use-purchasing';
import { kes2 } from '../lib/format';
import type { CancelReason, Order } from '../types';
import { PinDialog } from './pin-dialog';
import { FieldLabel } from './parts';

const REASONS: Array<{ value: CancelReason; label: string }> = [
  { value: 'ORDERED_BY_MISTAKE', label: 'Ordered by mistake' },
  { value: 'SUPPLIER_CANNOT_SUPPLY', label: 'Supplier cannot supply' },
  { value: 'NO_LONGER_NEEDED', label: 'No longer needed' },
  { value: 'OTHER', label: 'Other' },
];

/** Cancel an order (Paper `36`): a reason, an optional note and the PIN. Only before any goods arrive; the order stays on record. */
export function CancelOrderSheet({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { service } = usePurchasing();
  const narrow = useIsNarrow();
  const addToast = useWdsToastStore((s) => s.addToast);
  const [reason, setReason] = React.useState<CancelReason>('ORDERED_BY_MISTAKE');
  const [note, setNote] = React.useState('');
  const [pinOpen, setPinOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason('ORDERED_BY_MISTAKE');
      setNote('');
    }
  }, [open]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side={narrow ? 'bottom' : 'right'} className={cn(narrow ? 'max-h-[92vh] rounded-t-wds-lg' : 'w-[460px] max-w-full')}>
          <SheetHeader>
            <SheetTitle className="flex items-baseline gap-2.5 font-wds-sans text-wds-section font-semibold text-wds-neutral-950">
              Cancel order
              <span className="font-wds-mono text-wds-caption font-normal text-wds-text-secondary">{order.reference}</span>
            </SheetTitle>
            <SheetDescription className="font-wds-sans text-wds-caption text-wds-text-secondary">
              {order.supplier.name}
              {order.money ? ` · KES ${kes2(order.money.ordered)}` : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-wds-6 py-wds-5">
            <div className="flex flex-col gap-1 rounded-wds-sm border border-wds-warning-border bg-wds-warning-bg px-3 py-2.5">
              <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-warning-fg">Nothing has been received on this order.</span>
              <span className="font-wds-sans text-wds-caption text-wds-warning-fg">It stays on record as Cancelled. Nothing is deleted.</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="cancel-reason">Reason (required)</FieldLabel>
              <select id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value as CancelReason)} className="h-8 rounded-wds-sm border border-wds-border-strong bg-white px-2 font-wds-sans text-wds-body-sm outline-none focus-visible:shadow-wds-ring">
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="cancel-note">Note</FieldLabel>
              <Textarea id="cancel-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the team should know" className="min-h-14" />
            </div>
            <p className="font-wds-sans text-wds-caption text-wds-text-secondary">Once goods have arrived an order can&apos;t be cancelled. Attendants can&apos;t cancel orders.</p>
          </div>
          <SheetFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Keep order
            </Button>
            <Button variant="destructive" onClick={() => setPinOpen(true)}>
              Cancel order
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <PinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Cancel with your PIN"
        subtitle="This is recorded against your name."
        summary={{ title: `${order.reference} · ${order.supplier.name}`, detail: REASONS.find((r) => r.value === reason)?.label ?? '' }}
        confirmLabel="Cancel order"
        onSubmit={async (pin) => {
          await service.cancelOrder(order.id, { reason, note: note.trim() || null, pin });
          setPinOpen(false);
          onOpenChange(false);
          addToast({ variant: 'info', title: `${order.reference} cancelled`, description: 'It stays on record under Closed.' });
        }}
      />
    </>
  );
}
