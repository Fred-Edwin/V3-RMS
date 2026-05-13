'use client';

import { useState } from 'react';
import { BottomSheet, Button, Textarea } from '@/components/ui';

const CANCEL_REASONS = [
  'Customer changed their mind',
  'Customer left',
  'Duplicate order',
  'Wrong items ordered',
  'Item unavailable',
  'Other',
] as const;

interface CancelOrderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, reasonDetail?: string) => void;
  isSubmitting?: boolean;
}

export function CancelOrderSheet({ isOpen, onClose, onConfirm, isSubmitting = false }: CancelOrderSheetProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [reasonDetail, setReasonDetail] = useState('');

  const isOther = selectedReason === 'Other';
  const canSubmit = selectedReason && (!isOther || reasonDetail.trim().length > 0);

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm(selectedReason, isOther ? reasonDetail.trim() : undefined);
  };

  const handleClose = () => {
    setSelectedReason('');
    setReasonDetail('');
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Request Cancellation">
      <div className="space-y-4">
        <p className="text-body-sm text-stone-600">Why should this order be cancelled?</p>

        <div className="space-y-2">
          {CANCEL_REASONS.map((reason) => (
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
                name="cancelReason"
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
          Request Cancellation
        </Button>
      </div>
    </BottomSheet>
  );
}
