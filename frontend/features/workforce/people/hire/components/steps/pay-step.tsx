'use client';

import * as React from 'react';

import { RadioCards } from '../../../../_shared';
import { PAY_PANEL } from '../../lib/hire-copy';
import { isCasual } from '../../lib/hire-model';
import { HireField, HireSelect, NumberField } from '../hire-field';
import { SwitchRow } from '../switch-row';
import type { StepProps } from './who-step';

/**
 * Step 3, Pay (Paper `RMY-0`; the casual version `SMV-0`). The pay type follows how they are employed (monthly salary, or the
 * casual's daily rate), so the other card is shown but cannot be chosen here: change the employment on the Job step.
 */
export function PayStep({ state, errors, set, departmentLabel }: StepProps & { departmentLabel: string }) {
  const casual = isCasual(state);
  return (
    <>
      <RadioCards
        legend="PAY TYPE"
        legendStyle="caps"
        columns={2}
        options={[
          { value: 'MONTHLY', title: 'Monthly salary', description: casual ? undefined : 'Paid once a month by bank or M-Pesa', disabled: casual },
          { value: 'DAILY', title: 'Daily rate', description: 'Casuals, paid each day from petty cash', disabled: !casual },
        ]}
        value={casual ? 'DAILY' : 'MONTHLY'}
        onChange={() => undefined}
      />
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <HireField label={casual ? 'Daily rate' : 'Monthly pay'} error={errors.amount}>
          {(ids) => <NumberField ids={ids} before="KES" maxLength={13} value={state.amount} onChange={(v) => set({ amount: v })} autoFocus />}
        </HireField>
        {casual ? (
          <HireField label="Standard day" error={errors.dayHours}>
            {(ids) => <NumberField ids={ids} after="h" maxLength={6} value={state.dayHours} onChange={(v) => set({ dayHours: v })} />}
          </HireField>
        ) : (
          <HireField label="Standard week" error={errors.weekHours}>
            {(ids) => <NumberField ids={ids} after="h" maxLength={6} value={state.weekHours} onChange={(v) => set({ weekHours: v })} />}
          </HireField>
        )}
      </div>
      {casual ? (
        <HireField label="Department pool" helper="The department's head records their days. The Branch Manager approves them.">
          {(ids) => <HireSelect ids={ids} value="pool" onChange={() => undefined} disabled options={[{ value: 'pool', label: departmentLabel }]} />}
        </HireField>
      ) : (
        <>
          <SwitchRow
            title="Eligible for overtime"
            description="Approved extra time is paid at the rate the Accountant confirms"
            checked={state.overtimeEligible}
            onChange={(v) => set({ overtimeEligible: v })}
          />
          <HireField label="Lateness policy" helper="The Director sets lateness rules; they apply from the day they start.">
            {(ids) => <HireSelect ids={ids} value="default" onChange={() => undefined} disabled options={[{ value: 'default', label: PAY_PANEL.latenessDefault }]} />}
          </HireField>
        </>
      )}
    </>
  );
}
