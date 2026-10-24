import { dateOf } from '../../_shared/lib/nairobi-clock';
import type { SwitchView } from '../../_shared/types/attendance-types';

export const SWITCH_COPY = {
  subtitle: 'The new clock runs on one branch at a time. A branch that is off keeps the old clock exactly as it is.',
  onDescription: 'Staff at this branch will clock in on their phones, against their shifts.',
  offDescription: 'Staff at this branch go back to the old clock.',
  refused: 'The switch was not changed',
  since: (site: SwitchView): string => (site.enabled && site.enabledAt ? `On since ${dateOf(site.enabledAt)}` : 'Using the old clock'),
  done: (name: string, on: boolean): string => `${name} ${on ? 'now uses the new clock' : 'is back on the old clock'}. It is written to the audit log.`,
} as const;

/** The lines of the "what changes" box: the legacy clock stops answering when it goes on; it answers again at once when it goes off. */
export function switchLines(site: SwitchView): string[] {
  return site.enabled
    ? [
        'The old clock works again at once for this branch.',
        'Clock times taken today on the new clock are copied to the old clock, so nobody loses the day.',
        'Past days stay where they were recorded.',
        'It is written to the audit log with your name.',
      ]
    : [
        'The old clock stops answering for this branch. Anyone who taps it is told to use the new clock.',
        'Staff clock in on their phones against their shifts, with two minutes to undo and a question at the end of the shift.',
        'You cannot switch on while someone is clocked in on the old clock today; wait until they clock out.',
        'Finished old-clock records from today are carried across. Past days stay where they were recorded.',
        'It is written to the audit log with your name.',
      ];
}
