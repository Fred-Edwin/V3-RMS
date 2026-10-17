'use client';

import * as React from 'react';

import { ActionCards, AddChip, ChoiceChips, FIELD_CLASS, FormField, OptionList, RadioCards, ReasonChips, RemovableChip, TimeField, EMPTY_REASON, type ReasonValue } from '..';
import { Label, Section } from './gallery-parts';

/** Forms and choice controls. */
export function ChoicesSection() {
  const [brk, setBrk] = React.useState<string | null>('30');
  const [why, setWhy] = React.useState<string | null>('Busy, customers waiting');
  const [who, setWho] = React.useState<string | null>('site');
  const [fix, setFix] = React.useState<string | null>('remove');
  const [decision, setDecision] = React.useState<string | null>('all');
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const [depts, setDepts] = React.useState(['Pastry']);
  const [starts, setStarts] = React.useState('04:00');
  const [ends, setEnds] = React.useState('1');
  const [name, setName] = React.useState('Early bake');
  const [picked, setPicked] = React.useState('nothing yet');
  const breakMinutes = Number(brk ?? 0);
  return (
    <Section id="choices" title="16 · Forms and choice controls" node="18DN-0 / 1AUB-0 / 1CPF-0 / 19FR-0 / 1B9N-0 / 1AMN-0" note="Chips, the option list and the radio cards are real radios: arrow keys move, Space or Enter chooses. Action cards are buttons; one is brown. Press Tab to see the focus ring, and leave the “Ends” field with a half-typed time to see it fill in.">
      <div className="grid gap-8 bg-wds-surface p-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Label>FormField + TimeField</Label>
          <FormField label="Name" helper="It appears in every rota cell.">
            {({ id, describedBy, invalid }) => (
              <input id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} />
            )}
          </FormField>
          <div className="flex gap-3">
            <TimeField label="Starts" value={starts} onChange={setStarts} className="w-[130px]" />
            <TimeField label="Ends" value={ends} onChange={setEnds} className="w-[130px]" helper="Later the same day." />
          </div>
          <FormField label="With an error" hint="required" error="Give the shift a name.">
            {({ id, describedBy, invalid }) => <input id={id} autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid || undefined} defaultValue="" className={FIELD_CLASS} />}
          </FormField>
          <FormField label="Disabled">{({ id }) => <input id={id} autoComplete="off" disabled defaultValue="Locked" className={FIELD_CLASS} />}</FormField>
        </div>

        <div className="flex flex-col gap-6">
          <Label>ChoiceChips · Removable and add chips</Label>
          <ChoiceChips
            legend="Unpaid break"
            options={['None', '15 min', '30 min', '45 min', '60 min'].map((l, i) => ({ value: String([0, 15, 30, 45, 60][i]), label: l }))}
            value={brk}
            onChange={setBrk}
            trailing={`Paid hours: ${(8 - breakMinutes / 60).toLocaleString('en-KE', { maximumFractionDigits: 2 })} h`}
          />
          <ChoiceChips
            legend="Your decision"
            options={[{ value: 'all', label: 'Approve all 1 h 30' }, { value: 'part', label: 'Approve part: 1 h 00' }, { value: 'no', label: 'Decline' }]}
            value={decision}
            onChange={setDecision}
          />
          <ReasonChips
            legend="If you decline, say why"
            legendStyle="sentence"
            hint="required"
            options={['Not agreed beforehand', 'No work was waiting', 'Over the weekly limit'].map((l) => ({ key: l, label: l }))}
            value={reason}
            onChange={setReason}
            name="gallery-decline"
          />
          <div>
            <p className="m-0 mb-2.5 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">Departments</p>
            <div className="flex flex-wrap gap-2">
              {depts.map((d) => (
                <RemovableChip key={d} label={d} onRemove={() => setDepts((cur) => cur.filter((x) => x !== d))} />
              ))}
              <AddChip onClick={() => setDepts((cur) => [...cur, `Department ${cur.length + 1}`])}>+ Department</AddChip>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Label>RadioCards · two columns, and stacked</Label>
          <RadioCards
            legend="Who can use it"
            columns={2}
            options={[{ value: 'site', title: 'Nyeri Town only', description: 'What a Branch Manager can add' }, { value: 'all', title: 'Every site', description: 'HR or the Director only' }]}
            value={who}
            onChange={setWho}
          />
          <RadioCards
            legend="How do you want to fix it?"
            options={[{ value: 'remove', title: 'Remove the 11:20 clock-out. She stays on shift and clocks out as usual.' }, { value: 'set', title: 'Set the clock-out to a time I choose.' }]}
            value={fix}
            onChange={setFix}
          />
        </div>

        <div className="flex max-w-[342px] flex-col gap-6">
          <Label>OptionList (phone, with tick) · ActionCards</Label>
          <OptionList legend="Why are you staying?" tick options={['Busy, customers waiting', 'Covering a colleague', 'Closing or clean-up tasks', 'My manager asked me to'].map((l) => ({ value: l, label: l }))} value={why} onChange={setWhy} />
          <ActionCards
            label="What do you want to do"
            items={[
              { key: 'in', title: 'Clock in for her', description: 'She is here but could not clock in. You say when she arrived.', primary: true, onSelect: () => setPicked('clock in') },
              { key: 'abs', title: 'Mark absent today', description: 'She is not coming. Unpaid unless you add a reason later.', onSelect: () => setPicked('absent') },
              { key: 'wait', title: 'Wait, she has told me', description: 'Snooze this alert for 30 minutes.', disabled: true, disabledReason: 'Already snoozed once.', onSelect: () => setPicked('wait') },
            ]}
          />
          <p className="m-0 font-mono text-[11px] text-wds-text-secondary">Last card pressed: {picked}</p>
        </div>
      </div>
    </Section>
  );
}
