'use client';

import * as React from 'react';

import { Picker } from '@/components/ui2/picker';
import { cn } from '@/lib/cn';

import { FIELD_CLASS, FormField, KeyValueRows, PinField, RadioCards, SingleDateField } from '../../_shared';
import { toldPhrase } from '../lib/rules-words';
import type { Preview, SiteRef } from '../types/rules-types';

/** One NOW → NEW pair of the dialog's grey block. `control` is the screen's own input; `label` names it when a row sets two numbers (D28). */
export interface DialogPair {
  label?: string;
  now: string;
  control: React.ReactNode;
}

function PairCells({ pair, solo }: { pair: DialogPair; solo: boolean }) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex min-w-[96px] flex-col gap-1.5">
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{pair.label ? `NOW · ${pair.label.toUpperCase()}` : 'NOW'}</span>
        <span aria-label={`Now ${pair.now}`} className={cn('font-wds-mono text-wds-text-ink', pair.now.length > 12 ? 'max-w-[190px] text-[14px] leading-5' : 'text-[20px] leading-6')}>
          {pair.now}
        </span>
      </div>
      <span aria-hidden className="pb-2 text-[14px] text-wds-text-faint">
        →
      </span>
      <div className={cn('flex flex-col gap-1.5', solo ? 'w-[120px]' : 'w-[160px]')}>
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{pair.label ? `NEW · ${pair.label.toUpperCase()}` : 'NEW'}</span>
        {pair.control}
      </div>
    </div>
  );
}

/** The grey block: NOW → NEW (one or two pairs, D28) and FROM. Screen-reader order: "Now 5 minutes. New value. From date." */
export function NowNewBlock({
  pairs,
  from,
  onFrom,
  minDate,
  dateError,
  dateHelper,
}: {
  pairs: DialogPair[];
  from: string | null;
  onFrom: (day: string) => void;
  minDate?: string;
  dateError?: string;
  dateHelper?: string;
}) {
  const date = <SingleDateField label="From" value={from} onChange={onFrom} minDate={minDate} maxDate="2100-01-01" error={dateError} helper={dateHelper} className="w-[200px]" />;
  const solo = pairs.length === 1;
  return (
    <section aria-label="Now, new value and start day" className="flex flex-wrap items-end gap-x-5 gap-y-4 border border-wds-border bg-wds-neutral-50 p-4">
      {pairs.length === 0 ? null : solo ? <PairCells pair={pairs[0] as DialogPair} solo /> : <div className="flex w-full flex-col gap-4">{pairs.map((p) => <PairCells key={p.label ?? p.now} pair={p} solo={false} />)}</div>}
      {date}
    </section>
  );
}

/** "Applies to": every site or one site. Only for a viewer who can write the company rule, on rows a site may own. */
export function AppliesTo({
  scope,
  onScope,
  siteId,
  onSite,
  sites,
}: {
  scope: 'every' | 'one';
  onScope: (scope: 'every' | 'one') => void;
  siteId: string | null;
  onSite: (id: string) => void;
  sites: SiteRef[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <RadioCards
        legend="Applies to"
        legendStyle="sentence"
        columns={2}
        value={scope}
        onChange={(v) => onScope(v === 'one' ? 'one' : 'every')}
        options={[
          { value: 'every', title: 'Every site', description: 'The company rule' },
          { value: 'one', title: 'One site', description: 'Only that site follows it' },
        ]}
      />
      {scope === 'one' ? (
        <Picker
          aria-label="Which site"
          value={siteId ?? ''}
          onValueChange={onSite}
          placeholder="Choose a site"
          options={sites.map((s) => ({ value: s.organizationId, label: s.organizationName }))}
          className="h-10 w-full"
        />
      ) : null}
    </div>
  );
}

/** Why? Required, 1 to 500 characters; the counter appears at 400. */
export function WhyField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <FormField label="Why?" hint="required" helper={value.length >= 400 ? `${value.length} of 500` : 'It is recorded with your name.'}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          rows={2}
          maxLength={500}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(FIELD_CLASS, 'h-auto min-h-[60px] resize-y py-2')}
        />
      )}
    </FormField>
  );
}

/** The server's impact rows, then "Becomes: Version N, from <day>". Skeleton while the first answer loads. */
export function ImpactRows({ preview, loading, becomesFrom }: { preview: Preview | null; loading: boolean; becomesFrom: string }) {
  if (!preview) {
    return loading ? <div aria-busy className="h-[84px] animate-pulse bg-wds-neutral-100" /> : null;
  }
  const rows = [...preview.impact.map((r) => ({ label: r.label, value: r.value })), ...(preview.becomes ? [{ label: 'Becomes', value: `Version ${preview.becomes.version}, from ${becomesFrom}`, bold: true }] : [])];
  if (rows.length === 0) return null;
  return <KeyValueRows aria-label="What it would change" rows={rows} className={cn(loading && 'opacity-60')} />;
}

/** The PIN. Never submits on its own: the last digit enables Save, the button signs. */
export function PinSection({ pin, onPin, invalid, disabled, message }: { pin: string; onPin: (v: string) => void; invalid: boolean; disabled: boolean; message: string | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">Your PIN</span>
      <PinField value={pin} onChange={onPin} label="Your PIN" invalid={invalid} disabled={disabled} />
      <p role="alert" aria-live="polite" className={cn('m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg', !message && 'sr-only')}>
        {message ?? ''}
      </p>
    </div>
  );
}

/** "Who is told" caption (D1): pay changes are told without figures. */
export function toldCaption(preview: Preview | null): string {
  if (!preview || !preview.canSave) return 'Who is told is shown once the change is ready to save. The reason and your name are kept in the audit log.';
  if (preview.told.length === 0) return 'Nobody else is told. The change, the reason and your name are kept in the audit log.';
  const who = toldPhrase(preview.told);
  const only = preview.told.length === 1 ? preview.told[0] : undefined;
  const verb = only && (only.count <= 1 || ['DIRECTOR', 'ACCOUNTANT', 'HR_MANAGER'].includes(only.role)) ? 'is' : 'are';
  return preview.toldWithoutFigures
    ? `${who} ${verb} told it changed. The values, the reason and your name are kept in the audit log.`
    : `${who} ${verb} told, with old and new. The old value, the new value, the reason and your name are kept in the audit log.`;
}
