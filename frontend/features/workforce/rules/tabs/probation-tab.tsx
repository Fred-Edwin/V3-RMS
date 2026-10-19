'use client';

import * as React from 'react';

import { Callout, ProbationBar } from '../../_shared';
import { NumbersEditor, type NumSpec } from '../change/number-editor';
import { RuleRows } from '../components/rule-rows';
import { SideLabel, TabColumns, WhoPanel, rowNames, whoEntries } from '../components/who-panel';
import type { ProbationValues, RuleValues } from '../types/rules-types';
import { numbersEditor } from './editor-factories';
import type { EditorProps, RuleRowDef, TabProps } from './tab-types';

const pr = (values: RuleValues): ProbationValues => values as unknown as ProbationValues;
const NEW_CONTRACTS = 'A new default applies to contracts that start from the day you choose. A probation already running keeps its end date.';
const monthsWords = (n: number): string => `${n} month${n === 1 ? '' : 's'}`;
const extensionWords = (v: ProbationValues): string => (v.maxExtensions === 0 || v.maxExtensionMonths === 0 ? 'None' : `up to ${monthsWords(v.maxExtensionMonths)}${v.maxExtensions > 1 ? `, ${v.maxExtensions} times` : ''}`);
const reportWords = (days: number[]): string => days.map((d, i) => `${i === 0 ? 'One' : 'one'} at day ${d}`).join(', ');

/** "Reports before the decision": one number per report day, so the editor is made from the days now in force. */
function ReportDaysEditor({ page, onSaved, onStale, onClose }: EditorProps) {
  const days = pr(page.values).reportDays;
  const specs: NumSpec[] = days.map((_, i) => ({ label: `Report ${i + 1} (day)`, min: 1, max: 365, name: `day of report ${i + 1}` }));
  return (
    <NumbersEditor
      page={page}
      onSaved={onSaved}
      onStale={onStale}
      onClose={onClose}
      config={{
        title: 'Change the report days',
        helper: 'The days after the start when the department head and the Branch Manager each add a line. Days must go up. People already on probation keep their dates.',
        specs,
        read: (v) => pr(v).reportDays,
        now: (v) => pr(v).reportDays.map((d) => `day ${d}`),
        build: (numbers) => ({ reportDays: numbers.map((n) => n ?? 0) }),
      }}
    />
  );
}

export const PROBATION_ROWS: readonly RuleRowDef[] = [
  {
    id: 'defaultMonths',
    title: 'Default probation',
    thing: 'the default probation',
    help: 'Counted from the start date on the contract',
    value: (p) => ({ text: monthsWords(pr(p.values).defaultMonths), mono: true }),
    Editor: numbersEditor({
      title: 'Change the default probation',
      helper: NEW_CONTRACTS,
      specs: [{ min: 0, max: 12, name: 'months of probation' }],
      read: (v) => [pr(v).defaultMonths],
      now: (v) => [monthsWords(pr(v).defaultMonths)],
      build: ([n]) => ({ defaultMonths: n }),
    }),
  },
  {
    id: 'extension',
    title: 'One extension, at most',
    thing: 'the extension',
    help: 'HR chooses the length, up to this. It can be used once.',
    value: (p) => ({ text: extensionWords(pr(p.values)), mono: true }),
    Editor: numbersEditor({
      title: 'Change the extension',
      helper: 'How long HR may extend a probation, and how many times. A probation already extended keeps its end date.',
      specs: [
        { label: 'Months, at most', min: 0, max: 12, name: 'months of extension' },
        { label: 'Times', min: 0, max: 3, name: 'number of extensions' },
      ],
      read: (v) => [pr(v).maxExtensionMonths, pr(v).maxExtensions],
      now: (v) => [monthsWords(pr(v).maxExtensionMonths), String(pr(v).maxExtensions)],
      build: ([months, times]) => ({ maxExtensionMonths: months, maxExtensions: times }),
    }),
  },
  {
    id: 'reminder',
    title: 'Reminder to HR before it ends',
    thing: 'the reminder to HR',
    help: 'In Needs you, then each week until decided',
    value: (p) => ({ text: `${pr(p.values).reminderDaysBeforeEnd} days`, mono: true }),
    Editor: numbersEditor({
      title: 'Change the reminder to HR',
      helper: 'How many days before a probation ends it appears in Needs you.',
      specs: [{ min: 1, max: 60, name: 'days before the end' }],
      read: (v) => [pr(v).reminderDaysBeforeEnd],
      now: (v) => [`${pr(v).reminderDaysBeforeEnd} days`],
      build: ([n]) => ({ reminderDaysBeforeEnd: n }),
    }),
  },
  { id: 'signedContract', title: 'Confirmation needs a signed contract', thing: 'the signed contract', help: 'A person is confirmed only once the contract is signed. This cannot be switched off.', value: () => ({ text: 'Always' }) },
  {
    id: 'reportDays',
    title: 'Reports before the decision',
    thing: 'the report days',
    help: 'The department head and the Branch Manager each add a line',
    value: (p) => ({ text: reportWords(pr(p.values).reportDays), mono: true }),
    Editor: ReportDaysEditor,
  },
];

const NAMES = rowNames(PROBATION_ROWS);

export function ProbationTab({ page, access, onSaved, onStale }: TabProps) {
  return (
    <TabColumns
      left={<RuleRows defs={PROBATION_ROWS} page={page} onSaved={onSaved} onStale={onStale} />}
      right={
        <>
          <section aria-label="How it shows on a file" className="flex flex-col gap-2">
            <SideLabel>HOW IT SHOWS ON A FILE</SideLabel>
            <div className="flex flex-col gap-2.5 border border-wds-border bg-wds-surface px-4 py-3.5">
              <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">A person on probation · day 80 of 90, as on 4 October</span>
              <ProbationBar dayNumber={80} totalDays={90} />
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Green with more than 30 days left, amber at 30 or fewer, red at 7 or fewer.</span>
            </div>
          </section>
          <WhoPanel title="WHO CHANGES IT, WHO DECIDES" entries={whoEntries(access, NAMES, false)} />
          <Callout tone="neutral" variant="dashed" title="HR decides each person">
            HR confirms, extends once, or ends a probation. The department head and the Branch Manager add a report. None of that is set here.
          </Callout>
        </>
      }
    />
  );
}
