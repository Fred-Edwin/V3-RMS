'use client';

import * as React from 'react';

import { CodeBoxes, KeyValueRows, PinField } from '../..';
import { Label, Section } from '../gallery-parts';

/** PinField (signed acts) and CodeBoxes (payslip code), Paper 1J7K-0 and 1PNG-0. */
export function SecretsSection() {
  const [pin, setPin] = React.useState('');
  const [wrong, setWrong] = React.useState('');
  const [signed, setSigned] = React.useState('nothing yet');
  const [code, setCode] = React.useState('');
  return (
    <Section id="secrets" title="13 · PIN field and code boxes" node="1J7K-0 / 1DAK-0 / 1KGT-0 / 1PNG-0" note="PinField is one wide bordered field with a dot per digit, for signing. The fourth digit signs (a callback); Enter never does. CodeBoxes are four separate boxes for the payslip code, red on a wrong code. The signing dialog itself is in section 9.">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex max-w-[484px] flex-col gap-3.5 bg-wds-surface p-7">
          <Label>PinField · default</Label>
          <KeyValueRows rows={[{ label: 'People paid', value: '85', mono: true }, { label: 'Net to pay', value: 'KES 3,168,500', mono: true }]} />
          <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">Your PIN, to sign the approval</span>
          <PinField value={pin} onChange={setPin} label="Your PIN, to sign the approval" onComplete={(v) => setSigned(`signed with ${v.length} digits`)} />
          <p className="m-0 font-mono text-[11px] text-wds-text-secondary">Last digit: {signed}</p>
        </div>
        <div className="flex max-w-[484px] flex-col gap-3.5 bg-wds-surface p-7">
          <Label>PinField · wrong PIN, disabled</Label>
          <PinField value={wrong} onChange={setWrong} label="Wrong PIN example" invalid />
          <p className="m-0 font-wds-sans text-[12px] leading-[17px] text-wds-error-fg">That PIN is not right.</p>
          <PinField value="1234" onChange={() => undefined} label="Disabled PIN example" disabled />
        </div>
        <div className="flex max-w-[484px] flex-col gap-3.5 bg-wds-surface p-7">
          <Label>CodeBoxes · default</Label>
          <CodeBoxes value={code} onChange={setCode} label="Payslip code" />
        </div>
        <div className="flex max-w-[484px] flex-col gap-3.5 bg-wds-surface p-7">
          <Label>CodeBoxes · wrong code</Label>
          <CodeBoxes value="1234" onChange={() => undefined} label="Wrong payslip code" invalid />
        </div>
      </div>
    </Section>
  );
}
