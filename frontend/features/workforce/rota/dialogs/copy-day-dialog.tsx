'use client';

import * as React from 'react';

import { Callout, DIALOG_LEADS, DialogButton, FormField, KitDialog } from '../../_shared';
import { Picker } from '@/components/ui2/picker';
import { copyDayChanges } from '../_shared/lib/rota-edits';
import { isPastDay, longDay } from '../_shared/lib/rota-dates';
import type { GridPerson, WeekView } from '../_shared/types/rota-types';

/**
 * "Copy day": one day's shifts onto another day of the same week, for the people in view. It fills empty cells only (the same rule as
 * "start from last week"), skips anyone on leave that day, and goes through the same autosave as any edit.
 */
export function CopyDayDialog({
  week,
  people,
  title,
  onCopy,
  onClose,
}: {
  week: WeekView;
  people: readonly GridPerson[];
  title: string;
  onCopy: (changes: ReturnType<typeof copyDayChanges>) => void;
  onClose: () => void;
}) {
  const days = week.days.map((d) => d.date);
  const [from, setFrom] = React.useState(days.find((d) => d >= week.today) ?? days[0] ?? '');
  const [to, setTo] = React.useState(days.find((d) => d > from && !isPastDay(d, week.today)) ?? '');
  const changes = from && to ? copyDayChanges(week, people, from, to) : [];
  const why = !to ? 'Choose the day to copy onto.' : from === to ? 'Choose two different days.' : changes.length === 0 ? `Nothing to copy: ${longDay(to)} already has shifts for everyone who works ${longDay(from)}.` : undefined;
  const options = days.map((d) => ({ value: d, label: longDay(d) }));
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      width={480}
      title="Copy a day"
      description={DIALOG_LEADS.copyDay(title)}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton
            kind="primary"
            size="lg"
            disabled={why !== undefined}
            title={why}
            onClick={() => {
              onCopy(changes);
              onClose();
            }}
          >
            {changes.length > 0 ? `Copy ${changes.length} ${changes.length === 1 ? 'shift' : 'shifts'}` : 'Copy day'}
          </DialogButton>
        </>
      }
    >
      <FormField label="Copy from">{(ids) => <Picker id={ids.id} aria-label="Copy from" value={from} onValueChange={setFrom} options={options} chips={false} />}</FormField>
      <FormField label="Copy onto">
        {(ids) => <Picker id={ids.id} aria-label="Copy onto" value={to} onValueChange={setTo} options={options.filter((o) => !isPastDay(o.value, week.today))} placeholder="Choose a day" chips={false} />}
      </FormField>
      {why ? (
        <Callout tone="neutral" size="sm" role="status">
          {why}
        </Callout>
      ) : null}
    </KitDialog>
  );
}
