'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { ConfirmDialog } from '@/components/ui2/confirm-dialog';
import { formatApiErrorMessage } from '@/types/api';
import type { SupplierPayMethod, SupplierPayMethodChange } from '../types/supplier';
import { deleteSupplierPayMethod, getSupplierPayMethod } from '../../services';
import { groupAccountNumber, payMethodDetail } from '../lib/supplier-pay';
import { PAY_METHOD_LABEL } from '../lib/supplier-labels';
import { formatHistoryWhen } from '../../catalog/lib/item-price';
import { StockEmptyCard, StockErrorCard } from '../../_shared/components/stock-states';
import { InlineNotice, QuietAction, RowAction, TabHeading, tableHead } from './supplier-ui';

export interface PaymentTabProps {
  supplierId: string;
  methods: SupplierPayMethod[];
  history: SupplierPayMethodChange[] | null;
  historyError: string | null;
  onRetryHistory: () => void;
  canEdit: boolean;
  onAdd: () => void;
  onChange: (method: SupplierPayMethod) => void;
  /** A method was removed: the page reloads its methods and history. */
  onRemoved: () => void;
}

/**
 * Payment tab (Paper step 18): the methods, with the account number hidden until "Show" (it is fetched only then, and
 * hidden again on "Hide"), then who changed them and why. Bank transfer, M-Pesa and Cheque rows are drawn from the same
 * detail text rules (`payMethodDetail`).
 */
export function PaymentTab({ supplierId, methods, history, historyError, onRetryHistory, canEdit, onAdd, onChange, onRemoved }: PaymentTabProps) {
  const [shown, setShown] = React.useState<Record<string, string>>({});
  const [showing, setShowing] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<SupplierPayMethod | null>(null);
  const [removeBusy, setRemoveBusy] = React.useState(false);

  const show = async (method: SupplierPayMethod) => {
    setShowing(method.id);
    setProblem(null);
    try {
      const full = await getSupplierPayMethod(supplierId, method.id);
      setShown((prev) => ({ ...prev, [method.id]: full.accountNumber ?? '' }));
    } catch (err) {
      setProblem(formatApiErrorMessage(err, 'Could not show the account number.'));
    } finally {
      setShowing(null);
    }
  };
  const hide = (id: string) =>
    setShown((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await deleteSupplierPayMethod(supplierId, removing.id);
      setRemoving(null);
      onRemoved();
    } catch (err) {
      setProblem(formatApiErrorMessage(err, 'Could not remove this payment method.'));
      setRemoving(null);
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <TabHeading
        title="Payment methods"
        actions={canEdit ? <Button className="h-[34px] px-4" onClick={onAdd}>Add payment method</Button> : null}
      >
        Seen by the Store Manager, Accountant and Directors only. Attendants never see them.
      </TabHeading>
      {problem ? <InlineNotice>{problem}</InlineNotice> : null}

      {methods.length === 0 ? (
        <div className="flex justify-center border border-wds-border bg-white px-4 py-8">
          <StockEmptyCard
            title="No payment methods yet"
            description="Add the bank, M-Pesa or cheque details we pay this supplier with."
            actionLabel={canEdit ? 'Add payment method' : undefined}
            onAction={canEdit ? onAdd : undefined}
          />
        </div>
      ) : (
        <div role="table" aria-label="Payment methods" className="border border-wds-border bg-white">
          <div role="row" className="flex h-[34px] items-center border-b border-wds-text-ink px-4">
            <span role="columnheader" className={cn(tableHead, 'w-[180px] shrink-0')}>METHOD</span>
            <span role="columnheader" className={cn(tableHead, 'min-w-0 grow basis-0')}>DETAILS</span>
            <span role="columnheader" className={cn(tableHead, 'w-[100px] shrink-0')}>DEFAULT</span>
            <span role="columnheader" className="w-[140px] shrink-0" />
          </div>
          {methods.map((method) => {
            const detail = payMethodDetail(method);
            const full = shown[method.id];
            return (
              <div key={method.id} role="row" className="flex h-[72px] items-center border-b border-wds-neutral-100 px-4 last:border-b-0">
                <span role="cell" className="w-[180px] shrink-0 font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">
                  {PAY_METHOD_LABEL[method.type]}
                </span>
                <span role="cell" className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
                  <span className={cn('truncate text-[13px] leading-4 text-wds-text-ink', detail.mono ? 'font-wds-mono' : 'font-wds-sans')}>{detail.primary}</span>
                  {method.type === 'BANK_TRANSFER' && method.accountNumberMasked ? (
                    <span className="flex items-center gap-2.5">
                      <span className="font-wds-mono text-[13px] leading-4 text-wds-text-ink">
                        {full !== undefined ? groupAccountNumber(full) : `•••• •••• ${method.accountNumberMasked.replace(/^•+/, '')}`}
                      </span>
                      <RowAction
                        className="text-[12px]"
                        disabled={showing === method.id}
                        onClick={() => (full !== undefined ? hide(method.id) : void show(method))}
                        aria-label={`${full !== undefined ? 'Hide' : 'Show'} the account number`}
                      >
                        {full !== undefined ? 'Hide' : 'Show'}
                      </RowAction>
                    </span>
                  ) : detail.secondary ? (
                    <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{detail.secondary}</span>
                  ) : null}
                </span>
                <span role="cell" className="w-[100px] shrink-0">
                  {method.isDefault ? (
                    <span className="inline-flex border border-wds-success-border bg-wds-success-bg px-1.5 py-px font-wds-sans text-[11px] leading-[14px] text-wds-success-fg">Default</span>
                  ) : null}
                </span>
                <span role="cell" className="flex w-[140px] shrink-0 justify-end gap-3.5">
                  {canEdit ? (
                    <>
                      <RowAction onClick={() => onChange(method)}>Change</RowAction>
                      <QuietAction onClick={() => setRemoving(method)}>Remove</QuietAction>
                    </>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline gap-2.5">
          <h3 className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">Who changed these, and when</h3>
          <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Every change needs a reason. The Accountant is told straight away.</p>
        </div>
        {historyError ? (
          <StockErrorCard title="Couldn’t load the change history" description={historyError} onRetry={onRetryHistory} />
        ) : (
          <div role="table" aria-label="Payment detail changes" className="border border-wds-border bg-white">
            <div role="row" className="flex h-[34px] items-center border-b border-wds-text-ink px-4">
              <span role="columnheader" className={cn(tableHead, 'w-[130px] shrink-0')}>WHEN</span>
              <span role="columnheader" className={cn(tableHead, 'w-[140px] shrink-0')}>WHO</span>
              <span role="columnheader" className={cn(tableHead, 'min-w-0 grow basis-0')}>CHANGE</span>
              <span role="columnheader" className={cn(tableHead, 'w-[200px] shrink-0')}>REASON</span>
            </div>
            {history === null ? (
              <p className="px-4 py-3.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Loading the history…</p>
            ) : history.length === 0 ? (
              <p className="px-4 py-3.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">No changes yet.</p>
            ) : (
              history.map((entry) => (
                <div key={entry.id} role="row" className="flex min-h-11 items-center border-b border-wds-neutral-100 px-4 py-1 last:border-b-0">
                  <span role="cell" className="w-[130px] shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{formatHistoryWhen(entry.at)}</span>
                  <span role="cell" className="w-[140px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">{entry.actor.name}</span>
                  <span role="cell" className="min-w-0 grow basis-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">{entry.summary}</span>
                  <span role="cell" className="w-[200px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{entry.reason ?? '—'}</span>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove this payment method?"
        description={
          removing
            ? `${PAY_METHOD_LABEL[removing.type]} stops being offered when paying this supplier. The change stays in the list below.`
            : ''
        }
        confirmLabel="Remove"
        confirming={removeBusy}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  );
}
