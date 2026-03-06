'use client';

import { useState } from 'react';
import { BottomSheet, Button, Textarea } from '@/components/ui';

interface RejectTicketSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

export function RejectTicketSheet({ isOpen, onClose, onConfirm, isSubmitting = false }: RejectTicketSheetProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Reject Ticket">
      <div className="space-y-4">
        <p className="text-body-sm text-stone-600">Why is this ticket being rejected?</p>
        <Textarea
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Item out of stock..."
          rows={3}
        />
        <Button
          variant="destructive"
          className="w-full"
          disabled={!reason.trim()}
          isLoading={isSubmitting}
          onClick={handleConfirm}
        >
          Reject Ticket
        </Button>
      </div>
    </BottomSheet>
  );
}
