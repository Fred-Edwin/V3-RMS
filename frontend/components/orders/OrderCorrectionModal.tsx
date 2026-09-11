'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button, Modal, Textarea } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { orderCorrectionService } from '@/services/orderCorrectionService';
import { ApiError } from '@/types/api';
import type { OrderDetail } from '@/types/order';

interface OrderCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetail;
  accessToken: string;
  onCorrected: () => void;
}

const paidAmount = (order: OrderDetail): number => {
  if (order.paymentMethod === 'SPLIT' || order.paymentMethod === 'GUEST_SPLIT') {
    return order.splitPaymentLines.reduce((sum, line) => sum + Number.parseFloat(line.amount), 0);
  }
  return (
    Number.parseFloat(order.mpesaAmount ?? '0') +
    Number.parseFloat(order.cashAmount ?? '0') +
    Number.parseFloat(order.cardAmount ?? '0')
  );
};

export function OrderCorrectionModal({
  isOpen,
  onClose,
  order,
  accessToken,
  onCorrected,
}: OrderCorrectionModalProps): JSX.Element {
  const { toast } = useToast();
  const [removedItemIds, setRemovedItemIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remainingItems = order.items.filter((item) => !removedItemIds.has(item.id));
  const newTotal = remainingItems.reduce((sum, item) => sum + Number.parseFloat(item.subtotal), 0);
  const collected = paidAmount(order);
  const delta = collected - newTotal;
  const reasonValid = reason.trim().length >= 10;

  const toggleRemove = (itemId: string) => {
    setRemovedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const reset = () => {
    setRemovedItemIds(new Set());
    setReason('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!reasonValid || removedItemIds.size === 0 || remainingItems.length === 0) return;

    setIsSubmitting(true);
    try {
      // Correction endpoints remove one item at a time — apply sequentially so a
      // partial failure leaves a clear, individually-audited trail rather than an
      // all-or-nothing batch the manager can't tell apart from a single item.
      for (const itemId of Array.from(removedItemIds)) {
        await orderCorrectionService.removeOrderItem(order.id, itemId, { reason: reason.trim() }, accessToken);
      }
      toast({
        variant: 'success',
        title: 'Order corrected',
        message:
          Math.abs(delta) >= 0.01
            ? `New total KES ${newTotal.toFixed(2)}. Customer was charged KES ${collected.toFixed(2)} — reconcile the KES ${delta.toFixed(2)} difference manually.`
            : `New total KES ${newTotal.toFixed(2)}.`,
      });
      reset();
      onClose();
      onCorrected();
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to correct order',
        message: error instanceof ApiError ? error.message : 'Try again later',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Correct Order #${order.dailyNumber}`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            isLoading={isSubmitting}
            disabled={!reasonValid || removedItemIds.size === 0 || remainingItems.length === 0}
            onClick={() => void handleSave()}
          >
            Remove {removedItemIds.size > 0 ? `${removedItemIds.size} item${removedItemIds.size === 1 ? '' : 's'}` : 'items'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-[#FDBA74] bg-[#FFF7ED] p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#9A3412]" />
          <p className="text-caption text-[#9A3412]">
            This order is {order.status.toLowerCase()} and already paid. Removing items here corrects the
            record but does not refund the customer or reprint a receipt — handle that separately.
          </p>
        </div>

        <div className="space-y-2">
          {order.items.map((item) => {
            const isRemoved = removedItemIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  isRemoved ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'
                }`}
              >
                <div className={isRemoved ? 'line-through text-stone-400' : ''}>
                  <p className="text-body-sm font-medium text-stone-900">
                    {item.name} {item.quantity > 1 ? `×${item.quantity}` : ''}
                  </p>
                  <p className="text-caption text-stone-500">KES {Number.parseFloat(item.subtotal).toFixed(2)}</p>
                </div>
                <Button
                  variant={isRemoved ? 'secondary' : 'destructive'}
                  size="sm"
                  onClick={() => toggleRemove(item.id)}
                >
                  {isRemoved ? 'Undo' : <Trash2 size={14} />}
                </Button>
              </div>
            );
          })}
        </div>

        {remainingItems.length === 0 && (
          <p className="text-caption text-red-600">
            Cannot remove every item from an order. Cancel the order instead if it should not exist at all.
          </p>
        )}

        <div className="flex items-center justify-between border-t border-stone-200 pt-3">
          <span className="text-body-sm text-stone-600">New total</span>
          <span className="text-heading-sm font-semibold text-stone-900">KES {newTotal.toFixed(2)}</span>
        </div>

        {removedItemIds.size > 0 && Math.abs(delta) >= 0.01 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />
            <p className="text-caption text-amber-800">
              Customer was charged KES {collected.toFixed(2)}. After this correction the order total is KES{' '}
              {newTotal.toFixed(2)} — a KES {delta.toFixed(2)} difference to reconcile manually (refund, till note,
              etc.).
            </p>
          </div>
        )}

        <Textarea
          label="Reason (required)"
          placeholder="Why is this order being corrected? (minimum 10 characters)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </div>
    </Modal>
  );
}
