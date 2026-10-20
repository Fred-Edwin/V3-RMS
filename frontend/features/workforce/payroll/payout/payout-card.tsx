'use client';

import * as React from 'react';

import { ApiError } from '@/types/api';

import { Callout, DialogButton, ErrorBlock, ListSkeleton, Panel, useWorkforcePermissions } from '../../_shared';
import { saveFile } from '../exports/save-file';
import { usePayout } from '../_shared/hooks/use-payroll-data';
import { dayMonthTime, kes, newKey, people } from '../_shared/lib/format';
import { refusalWords } from '../_shared/lib/month-view';
import { downloadBankFile } from '../_shared/services/payroll-writes';
import type { MonthView } from '../_shared/types/month-types';
import { fileStateWords } from './payout-view';

/**
 * Pay out (spec S8): the Accountant downloads the bank file, pays at the bank, then marks the month paid. HR, the Director and the System
 * Admin read the card without buttons. A file voided by a correction is shown first, in amber, with what to do. A person with no bank
 * account is listed with the reason Mark as paid is blocked. The hash of the file comes back in a header and is read from the pay-out
 * when the month is marked paid, so a reload loses nothing.
 */
export function PayoutCard({ view, refresh, onChanged }: { view: MonthView; refresh: number; onChanged: (message?: string) => void }) {
  const payout = usePayout(view.monthKey, refresh, true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = React.useRef(newKey());
  const p = payout.data;
  const bank = p?.methods[0];
  // Before Paid the month's own flag says so; after Paid the Accountant may still take the file again (audited, nothing changes).
  const holdsPay = useWorkforcePermissions().can('payroll.pay');
  const canPay = view.capabilities.canPay || (view.state === 'PAID' && holdsPay);

  const download = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const file = await downloadBankFile(view.monthKey, key.current);
      saveFile(file.blob, file.filename);
      key.current = newKey();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? refusalWords(err.code, err.message) : 'The file could not be made. Try again.');
      if (err instanceof ApiError && ['BANK_FILE_CHANGED', 'CHANGED_UNDERNEATH'].includes(err.code)) {
        key.current = newKey();
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  if (payout.status === 'loading' && !p) return <ListSkeleton rows={3} columns={['fill', 120]} label="Loading the pay-out" />;
  if (payout.status === 'error' && !p) return <ErrorBlock title="The pay-out did not load" line={payout.error.message} onRetry={payout.reload} reference={payout.error.code} />;
  if (!p || !bank) return null;
  const file = bank.file;
  const paid = view.state === 'PAID';
  const buttonLabel = busy ? 'Preparing…' : file.state === 'NONE' ? 'Download bank file' : 'Download again';
  return (
    <div className="flex flex-col gap-4">
      {file.state === 'VOIDED' ? (
        <Callout tone="warning" title="The bank file was voided" role="alert">
          {file.voidReason ?? 'A payslip changed after the file was downloaded.'} Download the new file before you pay. If you already uploaded the old file at the bank, tell the bank to stop it.
        </Callout>
      ) : null}
      <Panel title={`Pay out the ${view.label.split(' ')[0]} net pay`} caption={view.publishedAt ? `PUBLISHED ${dayMonthTime(view.publishedAt).toUpperCase()}${view.documentNumber ? ` · ${view.documentNumber}` : ''}` : undefined} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <caption className="sr-only">Pay-out for {view.label}</caption>
            <thead>
              <tr className="border-b border-wds-text-ink">
                {['PAID BY', 'PEOPLE', 'AMOUNT (KES)', 'FILE'].map((h, i) => (
                  <th key={h} scope="col" className={`px-3.5 py-2.5 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary ${i === 1 || i === 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
                <th scope="col" className="px-3.5 py-2.5"><span className="sr-only">Download</span></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3.5 py-3 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">Bank transfer</td>
                <td className="px-3.5 py-3 text-right font-wds-mono text-[13px] leading-4">{bank.people}</td>
                <td className="px-3.5 py-3 text-right font-wds-mono text-[13px] font-semibold leading-4">{kes(bank.amount)}</td>
                <td className="px-3.5 py-3 font-wds-mono text-[12px] leading-4 text-wds-text-ink">
                  <span role="status">{file.state === 'NONE' ? p.nextFilename : file.filename}</span>
                  <span className="block font-wds-sans text-[12px] text-wds-text-secondary">
                    {fileStateWords(file.state)}
                    {file.downloadedAt ? ` ${dayMonthTime(file.downloadedAt)}${file.downloadedBy ? ` by ${file.downloadedBy}` : ''}` : ''}
                  </span>
                </td>
                <td className="px-3.5 py-3 text-right">
                  {canPay ? (
                    <DialogButton kind="cancel" onClick={() => void download()} disabled={busy || p.cannotPay.length > 0}>
                      {buttonLabel}
                    </DialogButton>
                  ) : (
                    <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">The Accountant pays out.</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {p.cannotPay.length > 0 ? (
          <p role="alert" className="m-0 border-t border-wds-neutral-100 px-3.5 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">
            {p.cannotPay.length === 1 ? '1 person cannot' : `${p.cannotPay.length} people cannot`} be paid by bank: no bank account. {p.cannotPay.map((c) => c.name).join(', ')}.
          </p>
        ) : null}
        {p.nothingToPay.length > 0 ? <p className="m-0 border-t border-wds-neutral-100 px-3.5 py-3 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{people(p.nothingToPay.length)} {p.nothingToPay.length === 1 ? 'has' : 'have'} nothing to pay and {p.nothingToPay.length === 1 ? 'is' : 'are'} not in the file.</p> : null}
        {p.otherMethods.length > 0 ? <p className="m-0 border-t border-wds-neutral-100 px-3.5 py-3 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Paid another way, not in the file: {p.otherMethods.map((m) => `${people(m.people)} by ${m.method.toLowerCase().replace(/_/g, ' ')}`).join(', ')}.</p> : null}
      </Panel>
      {error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {error}
        </p>
      ) : null}
      {!paid ? (
        <Panel title="How paying out works">
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">
            <li>Download the bank file. If a payslip is corrected after you download it, the file is voided and you download a new one. Each download is kept in the audit log.</li>
            <li>Upload it at the bank. Casual pay is paid from petty cash and is not in this file.</li>
            <li>Come back and mark the month as paid with your PIN. That locks the month, and staff are told their pay has been sent.</li>
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}
