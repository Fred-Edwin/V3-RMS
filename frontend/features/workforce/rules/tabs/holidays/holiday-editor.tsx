'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { DialogButton, FIELD_CLASS, FormField, SingleDateField } from '../../../_shared';
import { nairobiToday } from '../../../rota';
import { RuleChangeDialog } from '../../change/change-dialog';
import { dayAndMonth } from '../../lib/rules-words';
import type { HolidaysValues } from '../../types/rules-types';
import type { EditorProps } from '../tab-types';

type Holiday = HolidaysValues['holidays'][number];

const bySort = (list: Holiday[]): Holiday[] => [...list].sort((a, b) => a.date.localeCompare(b.date));

/** Add a holiday (`holiday` null), or change or remove one. The whole list is sent; the Director's save confirms it (D4). */
export function HolidayEditor({ page, holiday, onSaved, onStale, onClose }: EditorProps & { holiday: Holiday | null }) {
  const list = (page.values as unknown as HolidaysValues).holidays;
  const [date, setDate] = React.useState<string | null>(holiday?.date ?? null);
  const [name, setName] = React.useState(holiday?.name ?? '');
  const [removing, setRemoving] = React.useState(false);

  const others = list.filter((h) => h.date !== holiday?.date);
  const clash = date ? others.find((h) => h.date === date) : undefined;
  const trimmed = name.trim();
  const unchanged = holiday !== null && date === holiday.date && trimmed === holiday.name;

  let values = null;
  let draftMessage: string | undefined;
  if (removing) values = { holidays: bySort(others) };
  else if (!date) draftMessage = 'Pick the date of the holiday';
  else if (clash) draftMessage = `There is already a holiday on ${dayAndMonth(clash.date)}: ${clash.name}`;
  else if (trimmed.length === 0 || trimmed.length > 80) draftMessage = 'Give the holiday a name of 1 to 80 characters';
  else if (unchanged) draftMessage = 'Nothing to change yet';
  else values = { holidays: bySort([...others, { date, name: trimmed }]) };

  return (
    <RuleChangeDialog
      page={page}
      title={holiday ? (removing ? 'Remove this holiday' : 'Change a holiday') : 'Add a holiday'}
      helper="Wendo is open every day, so a holiday changes only what hours worked are paid. A month already approved never changes."
      pairs={[{ now: holiday ? dayAndMonth(holiday.date) : 'None', control: <span className="font-wds-mono text-[14px] leading-5 text-wds-text-ink">{removing ? 'Removed' : date ? dayAndMonth(date) : '—'}</span> }]}
      extra={
        removing ? (
          <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{holiday?.name} on {holiday ? dayAndMonth(holiday.date) : ''} will no longer be a public holiday.</p>
        ) : (
          <>
            <SingleDateField label="Date of the holiday" plainLabel value={date} onChange={setDate} minDate={nairobiToday()} maxDate="2100-01-01" error={clash ? draftMessage : undefined} />
            <FormField label="Name" hint="required" helper="1 to 80 characters">
              {({ id, describedBy, invalid }) => (
                <input id={id} aria-describedby={describedBy} aria-invalid={invalid} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={cn(FIELD_CLASS, 'h-10')} />
              )}
            </FormField>
            {holiday ? (
              <div>
                <DialogButton kind="cancel" onClick={() => setRemoving(true)} className="text-wds-error-fg">
                  Remove this holiday
                </DialogButton>
              </div>
            ) : null}
          </>
        )
      }
      values={values}
      draftMessage={draftMessage}
      onSaved={onSaved}
      onStale={onStale}
      onClose={onClose}
    />
  );
}
