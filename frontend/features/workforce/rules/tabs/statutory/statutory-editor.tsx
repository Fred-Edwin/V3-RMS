'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { DialogButton, FIELD_CLASS, FormField } from '../../../_shared';
import { RuleChangeDialog } from '../../change/change-dialog';
import { bandLabel, bandProblem, bandValue, flatBand, fromDraft, toDraft, type BandDraft } from '../../lib/statutory-view';
import type { StatutoryTable, StatutoryValues } from '../../types/rules-types';
import type { EditorProps } from '../tab-types';

/** What is being edited: its code and name, the shape of its figures, and the table now (null = a new one). */
export interface StatutoryTarget {
  code: StatutoryTable['code'];
  name: string;
  kind: 'BANDS' | 'RATE' | 'FLAT';
  existing: StatutoryTable | null;
}

const MONEY = /^\d{1,10}(\.\d{1,2})?$/;
const RATE = /^\d{1,3}(\.\d{1,4})?$/;

const summary = (t: StatutoryTable | null, kind: StatutoryTarget['kind']): string => {
  const band = t?.bands[0];
  if (!t || !band) return 'None';
  return kind === 'BANDS' ? `${t.bands.length} bands` : bandValue(band);
};

/** One table of statutory figures: PAYE bands, a flat relief, or a single rate. The Accountant's save confirms (the dialog says so). */
export function StatutoryEditor({ page, target, onSaved, onStale, onClose }: EditorProps & { target: StatutoryTarget }) {
  const tables = (page.values as unknown as StatutoryValues).tables;
  const existing = target.existing;
  const [name, setName] = React.useState(target.name);
  const [rows, setRows] = React.useState<BandDraft[]>(() => (target.kind === 'BANDS' ? (existing ? toDraft(existing.bands) : [{ width: '', rate: '' }]) : []));
  const [single, setSingle] = React.useState(() => {
    const band = existing?.bands[0];
    return band ? (target.kind === 'FLAT' ? (band.flatAmount ?? '') : String(Number(band.ratePercent ?? 0))) : '';
  });

  let bands = null;
  let problem: string | undefined;
  if (target.kind === 'BANDS') {
    problem = bandProblem(rows) ?? undefined;
    if (!problem) bands = fromDraft(rows);
  } else if (target.kind === 'FLAT') {
    if (!MONEY.test(single) || Number(single) <= 0) problem = 'Use an amount above 0, with up to 2 decimals';
    else bands = [flatBand(single)];
  } else if (!RATE.test(single) || Number(single) > 100) problem = 'Use a rate from 0 to 100, with up to 4 decimals';
  else bands = [{ fromAmount: '0', toAmount: null, ratePercent: String(Number(single)), flatAmount: null }];
  if (!problem && name.trim().length === 0) problem = 'Give the deduction a name';

  const next: StatutoryTable | null = bands ? { code: target.code, name: name.trim() || target.name, bands, note: existing?.note ?? null } : null;
  const same = next !== null && existing !== null && JSON.stringify(next) === JSON.stringify(existing);
  const values = next && !same ? { tables: existing ? tables.map((t) => (t === existing ? next : t)) : [...tables, next] } : null;
  const setRow = (i: number, patch: Partial<BandDraft>): void => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <RuleChangeDialog
      page={page}
      title={existing ? `Change ${target.name}` : target.kind === 'BANDS' ? 'Add PAYE bands' : 'Add a deduction'}
      helper="Saving confirms these rates. A month already approved never changes. Old versions stay for ever, so a past payslip can always be explained."
      pairs={[{ now: summary(existing, target.kind), control: <span className="font-wds-mono text-[14px] leading-5 text-wds-text-ink">{next ? summary(next, target.kind) : '—'}</span> }]}
      extra={
        <>
          {target.code === 'OTHER' && !existing ? (
            <FormField label="Name of the deduction" hint="required">
              {({ id, describedBy }) => <input id={id} aria-describedby={describedBy} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={cn(FIELD_CLASS, 'h-10')} />}
            </FormField>
          ) : null}
          {target.kind === 'BANDS' ? (
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">Bands, KES a month</legend>
              {rows.map((row, i) => {
                const last = i === rows.length - 1;
                return (
                  <div key={i} className="flex items-end gap-2">
                    <FormField label={last ? 'Above the bands before' : `Band ${i + 1}: width`} className="flex-1">
                      {({ id }) => <input id={id} inputMode="decimal" disabled={last} placeholder={last ? 'No upper limit' : undefined} value={last ? '' : row.width} onChange={(e) => setRow(i, { width: e.target.value })} className={cn(FIELD_CLASS, 'h-10 font-wds-mono')} />}
                    </FormField>
                    <FormField label="Rate %" className="w-[110px]">
                      {({ id }) => <input id={id} inputMode="decimal" value={row.rate} onChange={(e) => setRow(i, { rate: e.target.value })} className={cn(FIELD_CLASS, 'h-10 font-wds-mono')} />}
                    </FormField>
                    {rows.length > 1 ? (
                      <DialogButton kind="cancel" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} aria-label={`Remove band ${i + 1}`} className="text-wds-error-fg">
                        Remove this band
                      </DialogButton>
                    ) : null}
                  </div>
                );
              })}
              <div>
                <DialogButton kind="cancel" onClick={() => setRows((r) => [...r.slice(0, -1), { width: '', rate: r[r.length - 1]?.rate ?? '' }, { width: '', rate: '' }])}>
                  Add a band
                </DialogButton>
              </div>
              {bands ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{bands.map((b, i) => `${bandLabel(bands, i)} ${bandValue(b)}`).join(' · ')}</p> : null}
            </fieldset>
          ) : (
            <FormField label={target.kind === 'FLAT' ? 'Amount a month, KES' : 'Rate, %'} error={problem && single.length > 0 ? problem : undefined}>
              {({ id, describedBy, invalid }) => <input id={id} aria-describedby={describedBy} aria-invalid={invalid} inputMode="decimal" value={single} onChange={(e) => setSingle(e.target.value)} className={cn(FIELD_CLASS, 'h-10 w-[160px] font-wds-mono')} />}
            </FormField>
          )}
        </>
      }
      values={values}
      draftMessage={problem ?? 'Nothing to change yet'}
      onSaved={onSaved}
      onStale={onStale}
      onClose={onClose}
    />
  );
}
