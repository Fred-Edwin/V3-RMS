'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { DecisionDialog } from '../../_shared/components/decision-dialog';
import { useLoader } from '../../_shared/hooks/use-async';
import { getSupplierDetail } from '../../services';
import { formatDayMonth } from '../lib/supplier-logic';

export interface DuplicateMatch {
  id: string;
  code: string;
  name: string;
}

export interface DuplicateSupplierDialogProps {
  open: boolean;
  matches: readonly DuplicateMatch[];
  /** "It is a different business": the form is sent again with the warning confirmed. */
  onCreateAnyway: () => void;
  /** Dismissed: the form stays as it was. */
  onClose: () => void;
  busy: boolean;
  /** Called after the person chose to open the existing supplier. */
  onOpened: () => void;
}

/**
 * This supplier may already exist — Paper step 33. Names the first match with its phone, address and when it was created,
 * then asks: open the one we already have, or carry on because it is a different business.
 */
export function DuplicateSupplierDialog({ open, matches, onCreateAnyway, onClose, busy, onOpened }: DuplicateSupplierDialogProps) {
  const router = useRouter();
  const first = matches[0] ?? null;
  const detail = useLoader(open && first ? first.id : null, () => getSupplierDetail((first as DuplicateMatch).id), 'Could not read the existing supplier.');
  const info = detail.data;
  const extra = [info ? (info.contacts.find((c) => c.isPrimary) ?? info.contacts[0])?.phone : null, info && info.address !== '—' ? info.address : null, info ? `created ${formatDayMonth(info.createdAt)}` : null].filter(Boolean).join(' · ');

  return (
    <DecisionDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      tone="warning"
      title="This supplier may already exist"
      description="Same name or phone number as a supplier you already have."
      busy={busy}
      actions={
        <>
          <Button variant="secondary" className="h-9 px-[18px] text-[14px]" onClick={onCreateAnyway} disabled={busy}>
            {busy ? 'Creating…' : 'It is a different business'}
          </Button>
          {first ? (
            <Button
              className="h-9 px-[22px] text-[14px]"
              disabled={busy}
              onClick={() => {
                onOpened();
                router.push(`/app/inventory/suppliers/${first.id}`);
              }}
            >
              Open {first.name}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {matches.slice(0, 3).map((match, index) => (
          <div key={match.id} className="flex flex-col gap-[3px] border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
            <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">
              {match.name} · {match.code}
            </span>
            {index === 0 && extra ? <span className="font-wds-mono text-[12px] leading-4 text-wds-text-copy-muted">{extra}</span> : null}
          </div>
        ))}
        {matches.length > 3 ? <p className="font-wds-sans text-[12px] text-wds-text-copy-muted">and {matches.length - 3} more.</p> : null}
      </div>
      <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
        If it is the same business, open the existing supplier. If it is a different business that shares a name or a phone, you can still create it.
      </p>
    </DecisionDialog>
  );
}
