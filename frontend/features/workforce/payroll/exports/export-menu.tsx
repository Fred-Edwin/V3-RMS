'use client';

import * as React from 'react';

import { ApiError } from '@/types/api';

import { Callout, ChoiceChips, DialogButton, KitDialog, RadioCards, useStillLoading } from '../../_shared';
import { dayMonthTime, monthName, newKey } from '../_shared/lib/format';
import { refusalWords } from '../_shared/lib/month-view';
import { downloadExport } from '../_shared/services/payroll-writes';
import type { ExportFormat } from '../_shared/types/action-types';
import type { MonthView } from '../_shared/types/month-types';
import { FORMAT_WORDS, buttonLabel, exportOptions, firstOn, stampLine } from './export-options';
import { saveFile } from './save-file';

/**
 * Export (spec S9): the register, summary, statutory schedules and all payslips. A dialog, as Timesheets does it. The file says
 * "Draft, not approved" until approval. Working shows `Preparing…`; after 10 seconds it says it is a big month. A refusal (too many people,
 * too many tries, too slow) reads in the server's words and the button is free again. The bank file is not here: it is on Totals, at pay out.
 */
export function ExportMenu({ view, onClose }: { view: MonthView; onClose: () => void }) {
  const options = React.useMemo(() => exportOptions(view.state), [view.state]);
  const [kind, setKind] = React.useState<string | null>(firstOn(options)?.kind ?? null);
  const chosen = options.find((o) => o.kind === kind) ?? null;
  const [format, setFormat] = React.useState<ExportFormat>(chosen?.formats[0] ?? 'pdf');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);
  const [online, setOnline] = React.useState(true);
  const slow = useStillLoading(busy, 10_000);
  const key = React.useRef(newKey());

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

  const pick = (value: string): void => {
    setKind(value);
    const next = options.find((o) => o.kind === value);
    if (next && !next.formats.includes(format)) setFormat(next.formats[0] ?? 'pdf');
    key.current = newKey();
  };
  const approvedStage = view.stages.find((s) => s.key === 'APPROVED');
  const stamp = stampLine(view.state, view.documentNumber, approvedStage?.at ? dayMonthTime(approvedStage.at) : null);

  const run = async (): Promise<void> => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const file = await downloadExport(view.monthKey, chosen.kind, format, key.current);
      saveFile(file.blob, file.filename);
      setSaved(file.filename);
      key.current = newKey();
    } catch (err) {
      setError(err instanceof ApiError ? refusalWords(err.code, err.message) : 'The file could not be made. Try again.');
      if (err instanceof ApiError && err.code === 'EXPORT_RATE_LIMIT') key.current = newKey();
    } finally {
      setBusy(false);
    }
  };

  return (
    <KitDialog open busy={busy} width={520} onOpenChange={(o) => !o && onClose()} title={`Export ${monthName(view.monthKey)} · payroll`} description="Every export is recorded in the audit log.">
      <RadioCards
        legend="What to export"
        legendStyle="caps"
        value={kind}
        onChange={pick}
        options={options.map((o) => ({ value: o.kind, title: `${o.title} · ${o.badge}`, description: o.offReason ?? o.description, disabled: o.offReason !== null }))}
      />
      {chosen && chosen.formats.length > 1 ? (
        <ChoiceChips legend="Format" legendStyle="caps" size="sm" value={format} onChange={(v) => setFormat(v as ExportFormat)} options={chosen.formats.map((f) => ({ value: f, label: FORMAT_WORDS[f] }))} />
      ) : chosen ? (
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">This one is only available as {FORMAT_WORDS[chosen.formats[0] ?? 'pdf']}.</p>
      ) : null}
      {chosen ? (
        <Callout tone={stamp.tone} size="sm">
          {stamp.text}
        </Callout>
      ) : null}
      {!online ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">You are offline. Exports need a connection.</p> : null}
      {error ? (
        <p role="alert" className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-error-fg">
          {error}
        </p>
      ) : null}
      {saved && !busy ? (
        <p role="status" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          Saved {saved}.
        </p>
      ) : null}
      {slow ? (
        <p role="status" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          This is a big month. It can take a little while.
        </p>
      ) : null}
      <div className="flex justify-end gap-2 pb-1">
        <DialogButton kind="cancel" onClick={onClose} disabled={busy}>
          Close
        </DialogButton>
        <DialogButton kind="primary" onClick={() => void run()} disabled={busy || !chosen || !online}>
          {busy ? 'Preparing…' : chosen ? buttonLabel(chosen, format) : 'Nothing is calculated yet.'}
        </DialogButton>
      </div>
    </KitDialog>
  );
}
