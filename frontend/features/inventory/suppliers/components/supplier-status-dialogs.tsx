'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Textarea } from '@/components/ui2/textarea';
import { ChoiceChips, DecisionDialog, DialogLabel, TouchLine } from '../../_shared/components/decision-dialog';
import { useAction } from '../../_shared/hooks/use-async';
import { changeSupplierStatus } from '../../services';
import { formatAmount, formatDayMonth } from '../lib/supplier-logic';
import { ARCHIVE_REASONS, composeArchiveReason, holdReason, STATUS_REASON_MAX, unpaidInvoices, type ArchiveReason, type OwedInvoice, type StatusMove } from '../lib/supplier-status';
import type { SupplierDetail } from '../types/supplier';

export interface SupplierStatusDialogsProps {
  /** What the person asked for; null = closed. */
  move: StatusMove | null;
  supplier: Pick<SupplierDetail, 'id' | 'name' | 'status'>;
  /** The invoices read for "What we owe" (all of them; the unpaid ones are picked here). Null while unread. */
  invoices: readonly (OwedInvoice & { id: string })[] | null;
  onClose: () => void;
  /** The status changed: the page reloads. */
  onChanged: (status: SupplierDetail['status']) => void;
  /** "See what we owe": the page switches to the Overview tab. */
  onSeeOwed: () => void;
}

/**
 * Put on hold, Archive and Make active, in the style of Paper chapter 8 (only the blocked archive is drawn; the other
 * three use the same dialog). Archiving is refused while any invoice is unpaid: this knows it from the invoices already
 * read, and from the server's 409 SUPPLIER_HAS_OPEN_INVOICES if the page's list was out of date.
 */
export function SupplierStatusDialogs({ move, supplier, invoices, onClose, onChanged, onSeeOwed }: SupplierStatusDialogsProps) {
  const change = useAction(changeSupplierStatus, 'Could not change the status. Check the connection and try again.');
  const [reason, setReason] = React.useState<ArchiveReason | null>(null);
  const [note, setNote] = React.useState('');
  const [blockedByServer, setBlockedByServer] = React.useState(false);
  const { clear } = change;

  React.useEffect(() => {
    if (move) {
      setReason(null);
      setNote('');
      setBlockedByServer(false);
      clear();
    }
  }, [move, clear]);

  const unpaid = React.useMemo(() => (invoices ? unpaidInvoices(invoices) : []), [invoices]);
  const blocked = move === 'ARCHIVE' && (unpaid.length > 0 || blockedByServer);
  const holdInstead = supplier.status === 'ACTIVE';

  const submit = async (status: SupplierDetail['status'], text: string | undefined) => {
    const result = await change.run(supplier.id, status, text);
    if (result) {
      onChanged(status);
      onClose();
      return;
    }
  };

  // The server can know about an unpaid invoice the page has not read yet.
  React.useEffect(() => {
    if (change.failure?.code === 'SUPPLIER_HAS_OPEN_INVOICES') setBlockedByServer(true);
  }, [change.failure]);

  if (blocked) {
    const count = unpaid.length;
    return (
      <DecisionDialog
        open
        onOpenChange={(next) => !next && onClose()}
        tone="error"
        title={`${supplier.name} cannot be archived yet`}
        description="We still owe them money."
        busy={change.saving}
        error={change.failure && change.failure.code !== 'SUPPLIER_HAS_OPEN_INVOICES' ? change.failure.message : null}
        actions={
          <>
            <Button
              variant={holdInstead ? 'secondary' : 'primary'}
              className="h-9 px-[18px] text-[14px]"
              onClick={() => {
                onClose();
                onSeeOwed();
              }}
              disabled={change.saving}
            >
              See what we owe
            </Button>
            {holdInstead ? (
              <Button className="h-9 px-[22px] text-[14px]" onClick={() => void submit('ON_HOLD', undefined)} disabled={change.saving}>
                {change.saving ? 'Putting on hold…' : 'Put on hold instead'}
              </Button>
            ) : null}
          </>
        }
      >
        {count > 0 ? (
          <div className="flex flex-col gap-2">
            {count > 1 ? <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{count} unpaid invoices</span> : null}
            {unpaid.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between gap-3 border border-wds-error-border bg-wds-error-bg px-3.5 py-3">
                <div className="flex flex-col gap-[3px]">
                  {count === 1 ? <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">1 unpaid invoice</span> : null}
                  <span className="font-wds-mono text-[12px] leading-4 text-wds-text-copy-muted">
                    {invoice.invoiceNumber} · {formatDayMonth(invoice.invoiceDate)} · due {formatDayMonth(invoice.dueDate)}
                  </span>
                </div>
                <span className="shrink-0 font-wds-mono text-[16px] font-semibold leading-5 text-wds-error-fg">KES {formatAmount(invoice.outstanding)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-wds-error-border bg-wds-error-bg px-3.5 py-3 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">An invoice for this supplier is not paid yet.</div>
        )}
        <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
          Pay or settle the invoice first, then archive.
          {holdInstead ? ' If you only want to stop ordering from them, put them on hold. It can be undone in one click.' : ''}
        </p>
      </DecisionDialog>
    );
  }

  if (move === 'HOLD') {
    return (
      <DecisionDialog
        open
        onOpenChange={(next) => !next && onClose()}
        title={`Put “${supplier.name}” on hold?`}
        description="We stop ordering from them for now. Nothing is deleted, and it can be undone in one click."
        footerNote="Make them active again from this page."
        busy={change.saving}
        error={change.failure?.message}
        actions={
          <>
            <Button variant="secondary" className="h-9 px-[18px] text-[14px]" onClick={onClose} disabled={change.saving}>
              Back
            </Button>
            <Button className="h-9 px-[22px] text-[14px]" onClick={() => void submit('ON_HOLD', holdReason(note))} disabled={change.saving}>
              {change.saving ? 'Putting on hold…' : 'Put on hold'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5">
          <DialogLabel>What this touches</DialogLabel>
          <TouchLine tone="change">No new orders or receipts can use them while they are on hold.</TouchLine>
          <TouchLine tone="safe">Their history, invoices and payments stay as they are, and we can still pay what we owe.</TouchLine>
        </div>
        <div className="flex flex-col gap-2">
          <DialogLabel hint="optional">Why?</DialogLabel>
          <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, STATUS_REASON_MAX))} aria-label="Why are they on hold" placeholder="In a few words" rows={2} maxLength={STATUS_REASON_MAX} />
        </div>
      </DecisionDialog>
    );
  }

  if (move === 'ARCHIVE') {
    const composed = composeArchiveReason(reason, note);
    return (
      <DecisionDialog
        open
        onOpenChange={(next) => !next && onClose()}
        title={`Archive “${supplier.name}”?`}
        description="Nothing is deleted. They stop being offered, and their history stays."
        footerNote="Make them active again any time."
        busy={change.saving}
        error={change.failure && change.failure.code !== 'SUPPLIER_HAS_OPEN_INVOICES' ? change.failure.message : null}
        actions={
          <>
            <Button variant="secondary" className="h-9 px-[18px] text-[14px]" onClick={onClose} disabled={change.saving}>
              Back
            </Button>
            <Button variant="destructive" className="h-9 px-[22px] text-[14px]" onClick={() => composed && void submit('ARCHIVED', composed)} disabled={change.saving || composed === null}>
              {change.saving ? 'Archiving…' : 'Archive supplier'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5">
          <DialogLabel>What this touches</DialogLabel>
          <TouchLine tone="safe">No unpaid invoices. Nothing is owed to them.</TouchLine>
          <TouchLine tone="change">They stop being the preferred supplier for any item that named them.</TouchLine>
          <TouchLine tone="change">No new orders or receipts can use them.</TouchLine>
        </div>
        <div className="flex flex-col gap-2.5">
          <DialogLabel hint="required">Why?</DialogLabel>
          <ChoiceChips name="archive-reason" label="Why are they archived?" options={ARCHIVE_REASONS} value={reason} onChange={setReason} />
          {reason === 'Other' ? (
            <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, STATUS_REASON_MAX - 2))} aria-label="Say why" placeholder="In a few words" rows={2} maxLength={STATUS_REASON_MAX - 2} />
          ) : null}
        </div>
      </DecisionDialog>
    );
  }

  if (move === 'ACTIVATE') {
    return (
      <DecisionDialog
        open
        onOpenChange={(next) => !next && onClose()}
        title={`Make “${supplier.name}” active?`}
        description={supplier.status === 'ARCHIVED' ? 'They are offered again for new orders and receipts. Their history was never removed.' : 'They can be used for new orders and receipts again.'}
        busy={change.saving}
        error={change.failure?.message}
        actions={
          <>
            <Button variant="secondary" className="h-9 px-[18px] text-[14px]" onClick={onClose} disabled={change.saving}>
              Back
            </Button>
            <Button className="h-9 px-[22px] text-[14px]" onClick={() => void submit('ACTIVE', undefined)} disabled={change.saving}>
              {change.saving ? 'Making active…' : 'Make active'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2.5">
          <DialogLabel>What this touches</DialogLabel>
          <TouchLine tone="safe">All their history, invoices and payments are still there.</TouchLine>
          {supplier.status === 'ARCHIVED' ? <TouchLine tone="change">Items that named them as the preferred supplier no longer do. Choose them again on the item.</TouchLine> : null}
        </div>
      </DecisionDialog>
    );
  }

  return null;
}
