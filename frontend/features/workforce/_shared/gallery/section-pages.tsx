'use client';

import * as React from 'react';

import {
  Callout,
  ChecklistRows,
  DialogButton,
  KeyValueRows,
  NoteRows,
  PageHeader,
  Panel,
  PeriodStepper,
  SegmentedControl,
  SettingRows,
  StatBoxes,
  UnderlineTabs,
} from '..';
import { Label, Section } from './gallery-parts';

const RULE_TABS = ['Lateness', 'Overtime', 'Attendance', 'Leave', 'Probation', 'Casual work', 'Conduct', 'Statutory', 'Holidays', 'Week and breaks'].map((l) => ({ value: l, label: l }));

/** Page header, stepper, tabs, segmented control, callouts, panels, rows, stat boxes. */
export function PagesSection() {
  const [tab, setTab] = React.useState('Lateness');
  const [seg, setSeg] = React.useState('requests');
  const [week, setWeek] = React.useState(0);
  const weeks = ['Mon 12 to Sun 18 October 2026', 'Mon 19 to Sun 25 October 2026', 'Mon 26 October to Sun 1 November 2026'];
  const [undone, setUndone] = React.useState(false);
  return (
    <Section id="pages" title="15 · Page header, tabs, callouts, panels and rows" node="16DF-0 / 1KEL-0 / 1KEU-0 / 1D6Z-0 / 1B9X-0 / 1S4P-0 / 1ISM-0 / 19XC-0 / 1KFG-0 / 1JA8-0 / 1CPM-0 / 1BBV-0 / 1IRJ-0 / 17WK-0" note="Paper's titles are 24 px (28 px on Rules), not 26. Everything here takes its words as props. Tabs and the segmented control move with the arrow keys.">
      <div>
        <Label>PageHeader · md with the stepper, and lg with actions (the brown button last)</Label>
        <div className="flex flex-col gap-8 bg-wds-surface p-6">
          <PageHeader title="Rota · Nyeri Town" subtitle={<PeriodStepper label={weeks[week] ?? ''} onPrevious={() => setWeek((w) => Math.max(0, w - 1))} onNext={() => setWeek((w) => Math.min(weeks.length - 1, w + 1))} previousDisabled={week === 0} nextDisabled={week === weeks.length - 1} />} />
          <PageHeader
            size="lg"
            title="Rules · Lateness"
            subtitle="Applies to every site unless a Branch Manager sets their own · version 2, in force since 1 September 2026"
            actions={
              <>
                <DialogButton kind="cancel">Version history</DialogButton>
                <DialogButton kind="primary">Change this rule</DialogButton>
              </>
            }
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Label>UnderlineTabs (10 tabs scroll on a phone)</Label>
          <div className="bg-wds-surface px-2">
            <UnderlineTabs label="Rule groups" items={RULE_TABS} value={tab} onChange={setTab} />
          </div>
        </div>
        <div>
          <Label>SegmentedControl</Label>
          <SegmentedControl
            label="Leave view"
            value={seg}
            onChange={setSeg}
            items={[
              { value: 'requests', label: 'Requests' },
              { value: 'calendar', label: 'Calendar' },
              { value: 'balances', label: 'Balances' },
            ]}
          />
        </div>
      </div>

      <div>
        <Label>Callout · tint (neutral, info, success, warning, error), bar, dashed, banner with action</Label>
        <div className="grid gap-4 lg:grid-cols-2">
          <Callout size="sm" bullet>
            Clashes are shown, never copied. Nothing is visible to staff until you press Publish and tell staff.
          </Callout>
          <Callout tone="info" title="Early in">Joy clocked in 14 minutes before her shift.</Callout>
          <Callout tone="success" title="All set">Every timesheet for the period is approved.</Callout>
          <Callout tone="warning" title="This payslip is Joy Chebet's">If you are not Joy Chebet, stop here. Opening someone else's payslip is recorded with your name.</Callout>
          <Callout tone="error" title="Not in yet">Her shift started at 06:00, 42 minutes ago. No clock-in and no message from her.</Callout>
          <Callout variant="dashed" kicker="WHAT PREPARING DOES">Reads the closed timesheets and pay profiles, works out each line, and opens the review with only the unusual lines. It changes nothing for staff.</Callout>
          <Callout variant="bar" tone="error" kicker="RECORDED, NOT LOCKED" title="3 wrong codes were recorded">Nothing is locked, and the payslips stay private. This phone, the time and the person signed in are recorded.</Callout>
          <Callout variant="bar" tone="warning" kicker="PAY · PROBLEM" title="3 wrong codes on your payslips" action={<DialogButton kind="primary">Open</DialogButton>} />
          {undone ? (
            <Callout variant="bar" tone="neutral" title="Clock-in undone" />
          ) : (
            <Callout variant="bar" tone="success" title="Clocked in at 05:58" actionAt="end" action={<DialogButton kind="cancel" onClick={() => setUndone(true)}>Undo · 1:52</DialogButton>} />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Label>Panel · with count and caption</Label>
          <Panel title="Needs a look" count={5} caption="UPDATED 09:40">
            <KeyValueRows topRule={false} rows={[{ label: 'Open', value: '3', mono: true }, { label: 'Closed today', value: '2', mono: true }]} />
          </Panel>
        </div>
        <div>
          <Label>SettingRows</Label>
          <SettingRows
            caption="THE RULE TODAY"
            rows={[
              { title: 'Grace period', description: 'Arriving up to this many minutes late is not recorded as late', value: '5 min', mono: true },
              { title: 'What happens after the grace period', description: 'Record only · deduct after a number of late days', value: 'Deduct after 3 late days a month' },
              { title: 'Make up the time the same day', description: 'Staying on cancels the lateness', value: 'Off', muted: true },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-6">
        <div>
          <Label>StatBoxes · figures (30 px, with a toned detail line)</Label>
          <StatBoxes
            variant="figures"
            cells={[
              { label: 'GROSS PAY (KES)', value: '4,126,400', detail: 'basic 3,977,800 + overtime 148,600' },
              { label: 'STATUTORY (KES)', value: '934,120', detail: 'PAYE, NSSF, SHA, housing levy' },
              { label: 'NET TO PAY (KES)', value: '3,168,500', detail: 'up 2.4% on September', tone: 'success' },
            ]}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <Label>StatBoxes · compact, with an amber cell</Label>
            <StatBoxes cells={[{ label: 'Shifts copied', value: '116' }, { label: 'People', value: '31' }, { label: 'Left out, need you', value: '2', tone: 'warning' }]} />
          </div>
          <div>
            <Label>StatBoxes · times, planned / worked / extra</Label>
            <StatBoxes variant="times" cells={[{ label: 'PLANNED', value: '14:00 → 22:00' }, { label: 'WORKED', value: '13:58 → 23:31' }, { label: 'EXTRA', value: '1 h 30', tone: 'warning' }]} />
          </div>
        </div>
        <div>
          <Label>StatBoxes · before and after (green “after”)</Label>
          <StatBoxes
            variant="compare"
            cells={[
              { label: 'RECORDED', value: 'In 05:58 · Out 11:20', detail: '5 h 22 min', tone: 'error' },
              { label: 'AFTER YOUR FIX', value: 'In 05:58 · Out 14:00', detail: '8 h 2 min (7 h 32 paid)', tone: 'success' },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Label>ChecklistRows (done, open, problem)</Label>
          <ChecklistRows
            rows={[
              { title: 'Timesheets are closed', detail: '2 periods, 4 sites, 0 still open.' },
              { title: 'Pay profiles are complete', detail: 'Brian Kariuki is missing one.', state: 'problem' },
              { title: 'Statutory tables confirmed', detail: 'Waiting for Accountant.', state: 'open' },
            ]}
          />
        </div>
        <div>
          <Label>NoteRows (square marker, right note)</Label>
          <NoteRows
            aria-label="Left out"
            rows={[
              { text: 'Mark Njoroge · Wed 14 (Barista)', note: 'On approved leave', marker: 'warning' },
              { text: 'Joy Chebet · Sat 17 (Barista)', note: 'Sent to Nyeri Highway that day', marker: 'warning' },
              { text: 'Peter Karanja · Sun 18 (Kitchen hand)', note: 'Fine', marker: 'success' },
            ]}
          />
        </div>
      </div>
    </Section>
  );
}
