'use client';

import * as React from 'react';

import { formatApiErrorMessage } from '@/types/api';

import { DialogButton, KitDialog, RadioCards, useStillLoading } from '../../../_shared';
import { approvedStamp, monthLabel, rangeLabel } from '../../_shared/lib/month-words';
import { downloadExport } from '../../_shared/services/month-services';
import type { MonthView } from '../../_shared/types/month-types';
import { exportFileHint, saveFile } from '../lib/export-file';

/**
 * Export (spec S3): the month as a landscape PDF or an Excel working copy, for the whole month or the days now selected, or for one
 * person from the full-month page. Shows plainly whether the file will say "Draft, not approved" or carry the signature. The server
 * names the file; a refusal shows in its own words with the button free again.
 */
export function ExportMenu({
  month,
  siteId,
  range,
  person,
  onClose,
}: {
  month: MonthView;
  siteId: string | undefined;
  /** The days selected on the page; null is the whole month. */
  range: { from: string; to: string } | null;
  /** A one-person extract (the full-month page). */
  person?: { id: string; name: string };
  onClose: () => void;
}) {
  const [format, setFormat] = React.useState<'pdf' | 'xlsx'>('pdf');
  const [scope, setScope] = React.useState<'month' | 'range'>(range ? 'range' : 'month');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ message: string; code: string } | null>(null);
  const [online, setOnline] = React.useState(true);
  const slow = useStillLoading(busy, 10_000);
  const key = React.useRef<string>(crypto.randomUUID());

  React.useEffect(() => {
    const sync = (): void => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const approved = month.state === 'APPROVED' && month.approval;
  const monthName = monthLabel(month.monthKey);
  const rangeText = range ? rangeLabel(range.from, range.to) : null;
  const heading = person ? `EXPORT ${person.name.toUpperCase()} · ${monthName.toUpperCase()}` : `EXPORT ${monthName.toUpperCase()} · ${month.organization.name.toUpperCase()}`;

  const run = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const useRange = scope === 'range' && range;
      const file = await downloadExport(month.monthKey, {
        format,
        scope: useRange ? 'range' : 'month',
        ...(useRange ? { from: range.from, to: range.to } : {}),
        ...(person ? { employeeId: person.id } : {}),
        ...(siteId ? { site: siteId } : {}),
        idempotencyKey: key.current,
      });
      saveFile(file.blob, file.filename);
      key.current = crypto.randomUUID();
      onClose();
    } catch (err) {
      setError({ message: formatApiErrorMessage(err, 'The file could not be made. Try again.'), code: (err as { code?: string }).code ?? '' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KitDialog open onOpenChange={(o) => !o && onClose()} busy={busy} width={440} title={person ? 'Export this month' : 'Export'} description={heading} footer={
      <>
        <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={busy}>
          Cancel
        </DialogButton>
        <DialogButton kind="primary" size="lg" onClick={() => void run()} disabled={busy || !online}>
          {busy ? 'Preparing…' : `Download ${format === 'pdf' ? 'PDF' : 'Excel'}`}
        </DialogButton>
      </>
    }>
      <RadioCards
        legend="Format"
        columns={2}
        value={format}
        onChange={(v) => setFormat(v as 'pdf' | 'xlsx')}
        disabled={busy}
        options={[
          { value: 'pdf', title: 'PDF · landscape', description: 'Formatted and ready to print or file' },
          { value: 'xlsx', title: 'Excel', description: 'Every column, for your own sums' },
        ]}
      />
      <RadioCards
        legend="What to include"
        value={scope}
        onChange={(v) => setScope(v as 'month' | 'range')}
        disabled={busy}
        options={[
          { value: 'month', title: `Whole month · ${rangeLabel(month.window.start, month.window.end)}` },
          { value: 'range', title: rangeText ? `The range now selected · ${rangeText}` : 'The range now selected', description: rangeText ? undefined : 'Pick a range first', disabled: !range },
        ]}
      />
      <p className={approved ? 'm-0 font-wds-sans text-[13px] leading-[18px] text-wds-success-fg' : 'm-0 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg'}>{exportFileHint(approved ? { at: approvedStamp(approved.approvedAt), number: approved.documentNumber } : null)}</p>
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Each export is recorded in the audit log. No pay figures are in the file.</p>
      {slow ? <p role="status" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">Still preparing. A big month takes a little longer.</p> : null}
      {!online ? <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">You are offline. Connect to download the file.</p> : null}
      {error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {error.message}
          {error.code ? <span className="ml-1 font-wds-mono text-[11px] text-wds-text-secondary">({error.code})</span> : null}
        </p>
      ) : null}
    </KitDialog>
  );
}
