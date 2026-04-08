'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { BottomSheet, Button, Input } from '@/components/ui';
import type { OrderDetail } from '@/types/order';

interface ManagerOrderEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetail | null;
  onConfirm: (orderId: string, removeItemIds: string[], reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function ManagerOrderEditSheet({
  isOpen,
  onClose,
  order,
  onConfirm,
  isSubmitting = false,
}: ManagerOrderEditSheetProps): JSX.Element | null {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  if (!order) return null;

  const isEditable = (['PENDING', 'IN_PROGRESS', 'READY'] as string[]).includes(order.status);

  const toggle = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClose = (): void => {
    setSelectedIds(new Set());
    setReason('');
    setReasonError('');
    onClose();
  };

  const handleConfirm = async (): Promise<void> => {
    if (selectedIds.size === 0) return;

    if (!reason.trim() || reason.trim().length < 3) {
      setReasonError('Please provide a reason (at least 3 characters)');
      return;
    }
    setReasonError('');

    await onConfirm(order.id, Array.from(selectedIds), reason.trim());
    setSelectedIds(new Set());
    setReason('');
  };

  const willCancelOrder = selectedIds.size === order.items.length;

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title={`Edit Order #${order.dailyNumber}`}>
      <div className="space-y-4 pb-4">
        {!isEditable && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle size={16} className="shrink-0 text-amber-600" />
            <p className="text-body-sm text-amber-800">
              This order is {order.status.toLowerCase()} and cannot be modified.
            </p>
          </div>
        )}

        {isEditable && (
          <>
            <p className="text-body-sm text-stone-600">
              Select items to remove. Checked items will be voided from the order.
            </p>

            <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden">
              {order.items.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-red-50' : 'hover:bg-stone-50'
                    }`}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isSelected
                          ? 'border-red-500 bg-red-500'
                          : 'border-stone-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          viewBox="0 0 10 8"
                          className="h-3 w-3 fill-none stroke-white stroke-2"
                        >
                          <polyline points="1,4 4,7 9,1" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-body-sm font-medium truncate ${
                          isSelected ? 'text-red-700 line-through' : 'text-stone-900'
                        }`}
                      >
                        {item.name}
                        {item.quantity > 1 && (
                          <span className="ml-1 text-stone-500 font-normal">×{item.quantity}</span>
                        )}
                      </p>
                      {item.notes && (
                        <p className="text-caption text-stone-400 truncate">{item.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-body-sm font-medium ${isSelected ? 'text-red-500' : 'text-stone-700'}`}>
                        KES {Number(item.subtotal).toLocaleString()}
                      </span>
                      {isSelected && (
                        <Trash2 size={14} className="text-red-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {willCancelOrder && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
                <p className="text-body-sm text-red-800">
                  All items selected — removing them will <strong>cancel the entire order</strong>.
                </p>
              </div>
            )}

            <div>
              <Input
                label="Reason for edit *"
                placeholder="e.g. Customer changed their mind, incorrect item added…"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (reasonError) setReasonError('');
                }}
                errorMessage={reasonError}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => void handleConfirm()}
                disabled={selectedIds.size === 0 || isSubmitting}
                isLoading={isSubmitting}
              >
                {willCancelOrder ? 'Remove & Cancel Order' : `Remove ${selectedIds.size} Item${selectedIds.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </>
        )}

        {!isEditable && (
          <Button variant="secondary" className="w-full" onClick={handleClose}>
            Close
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
