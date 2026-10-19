'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FIELD_CLASS } from '../../_shared';
import type { RuleValues, RulesPage, SavedVersion } from '../types/rules-types';
import type { DialogPair } from './change-parts';
import { RuleChangeDialog } from './change-dialog';

/** One number the person types. `nullable` adds a "No cap"-style switch that stores nothing (null). */
export interface NumSpec {
  label?: string;
  min: number;
  max: number;
  /** Decimal places allowed; 0 or left out = a whole number. */
  decimals?: number;
  /** Only multiples of this are allowed (0.5 hours). */
  step?: number;
  /** Words for the null state ("No cap"). When set, the person can switch the number off. */
  nullable?: string;
  /** Spoken name of the input. */
  name: string;
}

export interface NumbersConfig {
  title: string;
  helper: string;
  appliesTo?: boolean;
  specs: NumSpec[];
  /** The current numbers, in the unit the person types (days, not hours). */
  read: (values: RuleValues) => (number | null)[];
  /** The NOW text of each ("5 min"). */
  now: (values: RuleValues) => string[];
  /** The rows to set from the typed numbers. */
  build: (numbers: (number | null)[]) => RuleValues;
  /** The row's field names, for "use the company rule again". */
  fields?: string[];
}

export function numberError(spec: NumSpec): string {
  if (spec.step) return `Use a number from ${spec.min} to ${spec.max} in steps of ${spec.step}`;
  const places = spec.decimals ? ` with up to ${spec.decimals} decimals` : '';
  return spec.decimals ? `Use a number from ${spec.min} to ${spec.max}${places}` : `Use a whole number from ${spec.min} to ${spec.max}`;
}

/** The typed text as a number, or null when it is empty or not allowed. */
export function parseTyped(text: string, spec: NumSpec): number | null {
  const trimmed = text.trim();
  const pattern = spec.decimals ? new RegExp(`^\\d+(\\.\\d{1,${spec.decimals}})?$`) : /^\d+$/;
  if (!pattern.test(trimmed)) return null;
  const n = Number(trimmed);
  if (spec.step && Math.abs(n / spec.step - Math.round(n / spec.step)) > 1e-9) return null;
  return n >= spec.min && n <= spec.max ? n : null;
}

const asText = (n: number | null): string => (n === null ? '' : String(n));

function NumberInput({ spec, text, off, invalid, disabled, autoFocus, onText, onOff }: { spec: NumSpec; text: string; off: boolean; invalid: boolean; disabled: boolean; autoFocus: boolean; onText: (v: string) => void; onOff?: (off: boolean) => void }) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <input
        id={id}
        aria-label={`New value: ${spec.name}`}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-err` : undefined}
        inputMode={spec.decimals ? 'decimal' : 'numeric'}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled || off}
        value={off ? '' : text}
        placeholder={off ? spec.nullable : undefined}
        onChange={(e) => onText(e.target.value)}
        className={cn(FIELD_CLASS, 'h-10 font-wds-mono text-[16px]')}
      />
      {spec.nullable && onOff ? (
        <label className="flex items-center gap-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          <input type="checkbox" checked={off} disabled={disabled} onChange={(e) => onOff(e.target.checked)} className="h-4 w-4 accent-[var(--wds-primary)]" />
          {spec.nullable}
        </label>
      ) : null}
      {invalid ? (
        <span id={`${id}-err`} role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {numberError(spec)}
        </span>
      ) : null}
    </div>
  );
}

/** A row that changes one or two numbers: the numbers' dialog (Paper steps 02, 08). The draft starts at today's value, so Save waits for a change. */
export function NumbersEditor({ config, page, onSaved, onStale, onClose }: { config: NumbersConfig; page: RulesPage; onSaved: (s: SavedVersion) => void; onStale: () => void; onClose: () => void }) {
  const current = config.read(page.values);
  const [texts, setTexts] = React.useState<string[]>(() => current.map(asText));
  const [offs, setOffs] = React.useState<boolean[]>(() => current.map((n, i) => n === null && Boolean(config.specs[i]?.nullable)));

  const parsed = config.specs.map((spec, i): number | null | 'bad' => {
    if (offs[i]) return null;
    const n = parseTyped(texts[i] ?? '', spec);
    return n === null ? 'bad' : n;
  });
  const bad = parsed.findIndex((p) => p === 'bad');
  const numbers = parsed.map((p) => (p === 'bad' ? null : p));
  const same = bad === -1 && numbers.every((n, i) => n === (current[i] ?? null));

  let values: RuleValues | null = null;
  let draftMessage: string | undefined;
  if (bad !== -1) draftMessage = numberError(config.specs[bad] as NumSpec);
  else if (same) draftMessage = 'Nothing to change yet';
  else values = config.build(numbers);

  const nowTexts = config.now(page.values);
  const pairs: DialogPair[] = config.specs.map((spec, i) => ({
    label: spec.label,
    now: nowTexts[i] ?? '',
    control: (
      <NumberInput
        spec={spec}
        text={texts[i] ?? ''}
        off={offs[i] ?? false}
        invalid={bad === i && (texts[i] ?? '').length > 0}
        disabled={false}
        autoFocus={i === 0}
        onText={(v) => setTexts((t) => t.map((x, j) => (j === i ? v : x)))}
        onOff={spec.nullable ? (v) => setOffs((o) => o.map((x, j) => (j === i ? v : x))) : undefined}
      />
    ),
  }));

  return <RuleChangeDialog page={page} title={config.title} helper={config.helper} pairs={pairs} values={values} draftMessage={draftMessage} appliesTo={config.appliesTo} onSaved={onSaved} onStale={onStale} onClose={onClose} />;
}
