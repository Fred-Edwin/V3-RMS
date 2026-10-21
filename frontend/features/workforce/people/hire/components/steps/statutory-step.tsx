'use client';

import * as React from 'react';

import { RadioCards } from '../../../../_shared';
import { firstNameOf } from '../../lib/hire-copy';
import { HireField, HireInput, NumberField } from '../hire-field';
import type { StepProps } from './who-step';

/** Step 4, Statutory and bank (Paper `RV0-0`): KRA PIN and the numbers HR has; NSSF and SHA are left for the person to add themselves. */
export function StatutoryStep({ state, errors, set }: StepProps) {
  const first = firstNameOf(state.name);
  const willAdd = `${first} will add this`;
  return (
    <>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <HireField label="KRA PIN" error={errors.kraPin}>{(ids) => <HireInput ids={ids} mono value={state.kraPin} autoFocus onChange={(e) => set({ kraPin: e.target.value.toUpperCase() })} />}</HireField>
        <HireField label="NSSF number" error={errors.nssfNumber}>{(ids) => <HireInput ids={ids} mono value={state.nssfNumber} placeholder={willAdd} onChange={(e) => set({ nssfNumber: e.target.value })} />}</HireField>
        <HireField label="SHA number" error={errors.shaNumber}>{(ids) => <HireInput ids={ids} mono value={state.shaNumber} placeholder={willAdd} onChange={(e) => set({ shaNumber: e.target.value })} />}</HireField>
        <HireField label="HELB number" note="if any">{(ids) => <HireInput ids={ids} mono value={state.helbNumber} placeholder="None" onChange={(e) => set({ helbNumber: e.target.value })} />}</HireField>
      </div>
      <RadioCards
        legend="HOW ARE THEY PAID OUT?"
        legendStyle="caps"
        columns={2}
        // Cash is for casual staff paid by the day, who have no statutory step; the server refuses it here too (Q3).
        options={[
          { value: 'BANK', title: 'Bank account' },
          { value: 'MPESA', title: 'M-Pesa' },
        ]}
        value={state.payoutMethod}
        onChange={(v) => set({ payoutMethod: v as typeof state.payoutMethod })}
      />
      {state.payoutMethod === 'BANK' ? (
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <HireField label="Bank" error={errors.bankName}>{(ids) => <HireInput ids={ids} value={state.bankName} onChange={(e) => set({ bankName: e.target.value })} />}</HireField>
          <HireField label="Account number" error={errors.accountNumber}>
            {(ids) => <NumberField ids={ids} code decimal={false} maxLength={20} value={state.accountNumber} onChange={(v) => set({ accountNumber: v })} />}
          </HireField>
        </div>
      ) : null}
      {state.payoutMethod === 'MPESA' ? (
        <HireField label="M-Pesa phone" error={errors.mpesaPhone}>{(ids) => <HireInput ids={ids} mono type="tel" value={state.mpesaPhone} onChange={(e) => set({ mpesaPhone: e.target.value })} />}</HireField>
      ) : null}
    </>
  );
}
