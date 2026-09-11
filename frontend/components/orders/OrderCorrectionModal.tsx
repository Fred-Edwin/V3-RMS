'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { orderCorrectionService } from '@/services/orderCorrectionService';
import { ApiError } from '@/types/api';
import type { OrderDetail, PaymentMethod } from '@/types/order';

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

const isMpesaEligible = (method: PaymentMethod | null): boolean =>
  method === 'MPESA' || method === 'SPLIT' || method === 'GUEST_SPLIT';

const isSplit = (method: PaymentMethod | null): boolean => method === 'SPLIT' || method === 'GUEST_SPLIT';

const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
];

const splitLineMethodOptions: { value: 'MPESA' | 'CASH' | 'CARD'; label: string }[] = [
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
];

export function OrderCorrectionModal({
  isOpen,
  onClose,
  order,
  accessToken,
  onCorrected,
}: OrderCorrectionModalProps): JSX.Element {
  const { toast } = useToast();
  const [removedItemIds, setRemovedItemIds] = useState<Set<string>>(new Set());
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [newMpesaCode, setNewMpesaCode] = useState('');
  const [removedSplitLineIds, setRemovedSplitLineIds] = useState<Set<string>>(new Set());
  const [newLineLabel, setNewLineLabel] = useState('');
  const [newLineAmount, setNewLineAmount] = useState('');
  const [newLineMethod, setNewLineMethod] = useState<'MPESA' | 'CASH' | 'CARD'>('CASH');
  const [newLineMpesaCode, setNewLineMpesaCode] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remainingItems = order.items.filter((item) => !removedItemIds.has(item.id));
  const newTotal = remainingItems.reduce((sum, item) => sum + Number.parseFloat(item.subtotal), 0);
  const collected = paidAmount(order);
  const delta = collected - newTotal;
  const reasonValid = reason.trim().length >= 10;

  const remainingSplitLines = order.splitPaymentLines.filter((line) => !removedSplitLineIds.has(line.id));
  const newLineAmountNum = Number.parseFloat(newLineAmount);
  const canAddSplitLine =
    newLineLabel.trim() !== '' &&
    Number.isFinite(newLineAmountNum) &&
    newLineAmountNum > 0 &&
    (newLineMethod !== 'MPESA' || newLineMpesaCode.trim() !== '');
  const hasPendingSplitLineDraft = newLineLabel.trim() !== '' || newLineAmount.trim() !== '';

  const paymentMethodChanged = newPaymentMethod !== '' && newPaymentMethod !== order.paymentMethod;
  const mpesaCodeChanged = newMpesaCode.trim() !== '' && newMpesaCode.trim() !== (order.mpesaCode ?? '');
  const hasAnyChange =
    removedItemIds.size > 0 ||
    paymentMethodChanged ||
    mpesaCodeChanged ||
    removedSplitLineIds.size > 0 ||
    canAddSplitLine;
  const canSubmit =
    reasonValid && hasAnyChange && remainingItems.length > 0 && remainingSplitLines.length > 0;

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

  const toggleRemoveSplitLine = (lineId: string) => {
    setRemovedSplitLineIds((current) => {
      const next = new Set(current);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const reset = () => {
    setRemovedItemIds(new Set());
    setNewPaymentMethod('');
    setNewMpesaCode('');
    setRemovedSplitLineIds(new Set());
    setNewLineLabel('');
    setNewLineAmount('');
    setNewLineMethod('CASH');
    setNewLineMpesaCode('');
    setReason('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!canSubmit) return;

    const trimmedReason = reason.trim();
    setIsSubmitting(true);
    try {
      // Each correction endpoint is one focused action, logged as its own
      // ORDER_CORRECTION incident — applied sequentially so a partial failure
      // leaves a clear, individually-audited trail rather than an opaque batch.
      for (const itemId of Array.from(removedItemIds)) {
        await orderCorrectionService.removeOrderItem(order.id, itemId, { reason: trimmedReason }, accessToken);
      }
      if (paymentMethodChanged) {
        await orderCorrectionService.correctPaymentMethod(
          order.id,
          { paymentMethod: newPaymentMethod, reason: trimmedReason },
          accessToken,
        );
      }
      if (mpesaCodeChanged) {
        await orderCorrectionService.correctMpesaCode(
          order.id,
          { mpesaCode: newMpesaCode.trim(), reason: trimmedReason },
          accessToken,
        );
      }
      for (const lineId of Array.from(removedSplitLineIds)) {
        await orderCorrectionService.removeSplitLine(order.id, lineId, { reason: trimmedReason }, accessToken);
      }
      if (canAddSplitLine) {
        await orderCorrectionService.addSplitLine(
          order.id,
          {
            label: newLineLabel.trim(),
            amount: newLineAmountNum,
            method: newLineMethod,
            mpesaCode: newLineMethod === 'MPESA' ? newLineMpesaCode.trim() : undefined,
            reason: trimmedReason,
          },
          accessToken,
        );
      }
      toast({
        variant: 'success',
        title: 'Order corrected',
        message:
          removedItemIds.size > 0 && Math.abs(delta) >= 0.01
            ? `New total KES ${newTotal.toFixed(2)}. Customer was charged KES ${collected.toFixed(2)} — reconcile the KES ${delta.toFixed(2)} difference manually.`
            : 'Changes saved.',
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
            disabled={!canSubmit}
            onClick={() => void handleSave()}
          >
            Save Correction
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-2 rounded-lg border border-[#FDBA74] bg-[#FFF7ED] p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#9A3412]" />
          <p className="text-caption text-[#9A3412]">
            This order is {order.status.toLowerCase()} and already paid. Corrections here fix the record but
            do not refund the customer or reprint a receipt — handle that separately.
          </p>
        </div>

        {/* ── Remove items — the last remaining item can never be removed,
             matching the backend's "cannot remove the last item" rule ───── */}
        <div className="space-y-2">
          <p className="text-label-sm font-medium text-stone-700">Items</p>
          {order.items.map((item) => {
            const isRemoved = removedItemIds.has(item.id);
            const isOnlyItem = order.items.length === 1;
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
                {!isOnlyItem && (
                  <Button
                    variant={isRemoved ? 'secondary' : 'destructive'}
                    size="sm"
                    onClick={() => toggleRemove(item.id)}
                  >
                    {isRemoved ? 'Undo' : <Trash2 size={14} />}
                  </Button>
                )}
              </div>
            );
          })}

          {order.items.length === 1 && (
            <p className="text-caption text-stone-500">
              This order has only one item, so it cannot be removed — use payment method, M-Pesa code, or split
              line corrections below instead.
            </p>
          )}

          {order.items.length > 1 && (
            <div className="flex items-center justify-between border-t border-stone-200 pt-3">
              <span className="text-body-sm text-stone-600">New total</span>
              <span className="text-heading-sm font-semibold text-stone-900">KES {newTotal.toFixed(2)}</span>
            </div>
          )}

          {removedItemIds.size > 0 && Math.abs(delta) >= 0.01 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />
              <p className="text-caption text-amber-800">
                Customer was charged KES {collected.toFixed(2)}. After this correction the order total is KES{' '}
                {newTotal.toFixed(2)} — a KES {delta.toFixed(2)} difference to reconcile manually (refund, till
                note, etc.).
              </p>
            </div>
          )}
        </div>

        {/* ── Payment method / M-Pesa code — CLOSED orders only, matching the
             backend's correctPaymentMethod/correctMpesaCode status guard ───── */}
        {order.status === 'CLOSED' && (
          <div className="space-y-2 border-t border-stone-200 pt-4">
            <p className="text-label-sm font-medium text-stone-700">Payment method</p>
            <p className="text-caption text-stone-500">
              Currently recorded as {order.paymentMethod ?? 'not set'}. Only change this if it was entered
              incorrectly when the order was closed.
            </p>
            <Select
              options={[{ value: '', label: 'Keep current method' }, ...paymentMethodOptions]}
              value={newPaymentMethod}
              onChange={(event) => setNewPaymentMethod(event.target.value)}
            />
          </div>
        )}

        {order.status === 'CLOSED' && isMpesaEligible(order.paymentMethod) && (
          <div className="space-y-2 border-t border-stone-200 pt-4">
            <p className="text-label-sm font-medium text-stone-700">M-Pesa code</p>
            <p className="text-caption text-stone-500">
              Currently recorded as {order.mpesaCode ?? 'none'}.
            </p>
            <Input
              placeholder="e.g. QKA123XY"
              value={newMpesaCode}
              onChange={(event) => setNewMpesaCode(event.target.value.toUpperCase())}
            />
          </div>
        )}

        {/* ── Split payment lines — CLOSED split orders only ─────────────── */}
        {order.status === 'CLOSED' && isSplit(order.paymentMethod) && (
          <div className="space-y-2 border-t border-stone-200 pt-4">
            <p className="text-label-sm font-medium text-stone-700">Split payment lines</p>
            <p className="text-caption text-stone-500">
              Remove a line that was recorded wrong, or add a corrected one. At least one line must remain.
            </p>

            {order.splitPaymentLines.map((line) => {
              const isRemoved = removedSplitLineIds.has(line.id);
              return (
                <div
                  key={line.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    isRemoved ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white'
                  }`}
                >
                  <div className={isRemoved ? 'line-through text-stone-400' : ''}>
                    <p className="text-body-sm font-medium text-stone-900">{line.label}</p>
                    <p className="text-caption text-stone-500">
                      {line.method} · KES {Number.parseFloat(line.amount).toFixed(2)}
                      {line.mpesaCode ? ` · ${line.mpesaCode}` : ''}
                    </p>
                  </div>
                  <Button
                    variant={isRemoved ? 'secondary' : 'destructive'}
                    size="sm"
                    onClick={() => toggleRemoveSplitLine(line.id)}
                  >
                    {isRemoved ? 'Undo' : <Trash2 size={14} />}
                  </Button>
                </div>
              );
            })}

            {remainingSplitLines.length === 0 && (
              <p className="text-caption text-red-600">
                Cannot remove every payment line from a split order.
              </p>
            )}

            <div className="space-y-2 rounded-lg border border-dashed border-stone-300 p-3">
              <p className="text-caption font-medium text-stone-600">Add a corrected line</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Label, e.g. Guest 1"
                  value={newLineLabel}
                  onChange={(event) => setNewLineLabel(event.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={newLineAmount}
                  onChange={(event) => setNewLineAmount(event.target.value)}
                />
                <Select
                  options={splitLineMethodOptions}
                  value={newLineMethod}
                  onChange={(event) => setNewLineMethod(event.target.value as 'MPESA' | 'CASH' | 'CARD')}
                />
                {newLineMethod === 'MPESA' && (
                  <Input
                    placeholder="M-Pesa code"
                    value={newLineMpesaCode}
                    onChange={(event) => setNewLineMpesaCode(event.target.value.toUpperCase())}
                  />
                )}
              </div>
              {hasPendingSplitLineDraft && !canAddSplitLine && (
                <p className="text-caption text-amber-700">
                  Fill in a label, a positive amount{newLineMethod === 'MPESA' ? ', and the M-Pesa code' : ''} to
                  add this line.
                </p>
              )}
            </div>
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
