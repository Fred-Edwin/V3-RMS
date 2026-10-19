'use client';

import * as React from 'react';

import { RadioCards, type RadioCardOption } from '../../_shared';
import type { RuleValues, RulesPage, SavedVersion } from '../types/rules-types';
import { RuleChangeDialog } from './change-dialog';

/** A row that picks one of a few options (On or Off, the week's first day). */
export interface ChoiceConfig {
  title: string;
  helper: string;
  legend: string;
  options: readonly RadioCardOption[];
  columns?: 1 | 2 | 3;
  appliesTo?: boolean;
  /** The option now in force. */
  read: (values: RuleValues) => string;
  /** The rows to set for an option. */
  build: (value: string) => RuleValues;
  /** The first day a new week can start on, for a week-start change (the date error reads "Pick a Sunday"). */
  weekStartName?: (value: string) => string;
}

export function ChoiceEditor({ config, page, onSaved, onStale, onClose }: { config: ChoiceConfig; page: RulesPage; onSaved: (s: SavedVersion) => void; onStale: () => void; onClose: () => void }) {
  const current = config.read(page.values);
  const [value, setValue] = React.useState(current);
  const label = (v: string): string => config.options.find((o) => o.value === v)?.title ?? v;
  const same = value === current;

  return (
    <RuleChangeDialog
      page={page}
      title={config.title}
      helper={config.helper}
      pairs={[{ now: label(current), control: <span className="font-wds-mono text-[14px] leading-5 text-wds-text-ink">{label(value)}</span> }]}
      extra={<RadioCards legend={config.legend} columns={config.columns ?? 2} options={config.options} value={value} onChange={setValue} />}
      values={same ? null : config.build(value)}
      draftMessage="Nothing to change yet"
      appliesTo={config.appliesTo}
      weekStartName={config.weekStartName?.(value)}
      onSaved={onSaved}
      onStale={onStale}
      onClose={onClose}
    />
  );
}
