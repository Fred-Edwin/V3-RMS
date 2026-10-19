'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FIELD_CLASS, FormField, RadioCards } from '../../_shared';
import { RuleChangeDialog } from '../change/change-dialog';
import { numberError, parseTyped, type NumSpec } from '../change/number-editor';
import type { LatenessValues } from '../types/rules-types';
import type { EditorProps } from './tab-types';

type Policy = LatenessValues['policy'];

const COUNT: NumSpec = { min: 1, max: 31, name: 'late days a month' };

export function policyWords(v: Pick<LatenessValues, 'policy' | 'afterLatesPerMonth'>): string {
  if (v.policy === 'AFTER_N_LATES') return `Deduct after ${v.afterLatesPerMonth ?? '?'} late day${v.afterLatesPerMonth === 1 ? '' : 's'} a month`;
  return v.policy === 'FROM_FIRST_MINUTE' ? 'Deduct from the first minute' : 'Record only';
}

/** "What happens after the grace period": three choices, and a number of late days for the middle one. */
export function LatenessPolicyEditor({ page, onSaved, onStale, onClose }: EditorProps) {
  const now = page.values as unknown as LatenessValues;
  const [policy, setPolicy] = React.useState<Policy>(now.policy);
  const [count, setCount] = React.useState(String(now.afterLatesPerMonth ?? 3));

  const parsed = policy === 'AFTER_N_LATES' ? parseTyped(count, COUNT) : null;
  const badCount = policy === 'AFTER_N_LATES' && parsed === null;
  const newCount = policy === 'AFTER_N_LATES' ? parsed : null;
  const same = policy === now.policy && (policy !== 'AFTER_N_LATES' || newCount === now.afterLatesPerMonth);

  let values = null;
  let draftMessage: string | undefined;
  if (badCount) draftMessage = 'Say after how many lates';
  else if (same) draftMessage = 'Nothing to change yet';
  else values = { policy, afterLatesPerMonth: newCount };

  return (
    <RuleChangeDialog
      page={page}
      title="Change what happens after the grace period"
      helper="Late marks are always recorded. This decides whether pay is reduced for them."
      pairs={[{ now: policyWords(now), control: <span className="font-wds-mono text-[14px] leading-5 text-wds-text-ink">{policyWords({ policy, afterLatesPerMonth: newCount })}</span> }]}
      extra={
        <>
          <RadioCards
            legend="After the grace period"
            columns={1}
            value={policy}
            onChange={(v) => setPolicy(v as Policy)}
            options={[
              { value: 'RECORD_ONLY', title: 'Record only', description: 'The late mark is kept; pay is not reduced.' },
              { value: 'AFTER_N_LATES', title: 'Deduct after a number of late days', description: 'Pay is reduced once the person is late on this many days in a month.' },
              { value: 'FROM_FIRST_MINUTE', title: 'Deduct from the first minute', description: 'Every late minute past the grace period counts.' },
            ]}
          />
          {policy === 'AFTER_N_LATES' ? (
            <FormField label="Late days in a month" helper="A whole number from 1 to 31." error={badCount && count.length > 0 ? numberError(COUNT) : undefined}>
              {({ id, describedBy, invalid }) => (
                <input id={id} aria-describedby={describedBy} aria-invalid={invalid} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className={cn(FIELD_CLASS, 'h-10 w-[120px] font-wds-mono text-[16px]')} />
              )}
            </FormField>
          ) : null}
        </>
      }
      values={values}
      draftMessage={draftMessage}
      appliesTo
      onSaved={onSaved}
      onStale={onStale}
      onClose={onClose}
    />
  );
}
