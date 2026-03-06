'use client';

import { useState } from 'react';
import { BottomSheet, Button, Textarea } from '@/components/ui';

const REJECT_REASONS = [
  'Item out of stock',
  'Equipment not working',
  'Wrong station',
  'Ingredient unavailable',
  'Quality issue with ingredient',
  'Other',
] as const;

interface RejectTicketSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

export function RejectTicketSheet({ isOpen, onClose, onConfirm, isSubmitting = false }: RejectTicketSheetProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [reasonDetail, setReasonDetail] = useState('');

  const isOther = selectedReason === 'Other';
  const canSubmit = selectedReason && (!isOther || reasonDetail.trim().length > 0);

  const handleConfirm = () => {
    if (!canSubmit) return;
    const reason = isOther ? `Other: ${reasonDetail.trim()}` : selectedReason;
    onConfirm(reason);
  };

  const handleClose = () => {
    setSelectedReason('');
    setReasonDetail('');
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Reject Ticket">
      <div className="space-y-4">
        <p className="text-body-sm text-stone-600">
          The ticket will be sent back to the waiter so they can edit or cancel the order.
        </p>

        <div className="space-y-2">
          {REJECT_REASONS.map((reason) => (
            <label
              key={reason}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                selectedReason === reason
                  ? 'border-amber bg-amber/10'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <input
                type="radio"
                name="rejectReason"
                value={reason}
                checked={selectedReason === reason}
                onChange={() => setSelectedReason(reason)}
                className="h-4 w-4 accent-amber"
              />
              <span className="text-body-sm text-stone-900">{reason}</span>
            </label>
          ))}
        </div>

        {isOther && (
          <Textarea
            label="Details"
            value={reasonDetail}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReasonDetail(e.target.value)}
            placeholder="Please explain..."
            rows={3}
          />
        )}

        <Button
          variant="destructive"
          className="w-full"
          disabled={!canSubmit}
          isLoading={isSubmitting}
          onClick={handleConfirm}
        >
          Reject Ticket
        </Button>
      </div>
    </BottomSheet>
  );
}
