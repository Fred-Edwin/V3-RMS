'use client';

import { useMemo, useState } from 'react';
import { BottomSheet, Button, Select } from '@/components/ui';
import type { PrepStation } from '@/types/order';

interface ClaimTicketSheetProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  station: PrepStation;
  staffOnShift: Array<{ id: string; name: string }>;
  helperText?: string;
  isSubmitting?: boolean;
  submittingMessage?: string;
  onClaim: (claimedById: string) => void;
}

export function ClaimTicketSheet({
  isOpen,
  onClose,
  ticketId,
  station,
  staffOnShift,
  helperText,
  isSubmitting = false,
  submittingMessage = 'Claiming ticket...',
  onClaim,
}: ClaimTicketSheetProps) {
  const defaultStaffId = staffOnShift[0]?.id ?? '';
  const [selectedUserId, setSelectedUserId] = useState(defaultStaffId);

  const options = useMemo(
    () => staffOnShift.map((staff) => ({ value: staff.id, label: staff.name })),
    [staffOnShift],
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Claim ${station} Ticket`}>
      <div className="space-y-4">
        <p className="text-body-sm text-stone-600">Ticket: {ticketId.slice(0, 8)}</p>
        <Select
          label="Staff on shift"
          options={options}
          value={selectedUserId}
          placeholder="Select staff"
          helperText={helperText}
          onChange={(event) => setSelectedUserId(event.target.value)}
        />
        <Button
          className="w-full"
          disabled={selectedUserId.length === 0}
          isLoading={isSubmitting}
          onClick={() => onClaim(selectedUserId)}
        >
          Claim
        </Button>
        {isSubmitting && (
          <p className="text-center text-caption text-stone-500">{submittingMessage}</p>
        )}
      </div>
    </BottomSheet>
  );
}
