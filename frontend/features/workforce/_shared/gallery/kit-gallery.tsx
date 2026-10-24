'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import {
  AvatarStack,
  CompletenessRing,
  ComingUpTimeline,
  DialogButton,
  FilterBar,
  FilterChip,
  LifeTimeline,
  PersonAvatar,
  PresenceDot,
  ProbationBar,
  SingleDateField,
  StatusTag,
  WORKFORCE_TAGS,
  WorkforceKpiStrip,
  WorkforceTag,
  probationColour,
  probationTextClass,
  type WorkforceTagKey,
} from '..';
import { Label, Section } from './gallery-parts';
import { DialogSections } from './sections/dialog-sections';
import { LayoutSections } from './sections/layout-sections';
import { MORE_NAV, MoreSections } from './sections/more-sections';
import { NotificationSections, StatesSections } from './sections/states-sections';

/**
 * Dev gallery for the Workforce kit: every piece in every state, labelled with
 * its Paper node. Not a product screen. Hover, focus (Tab) and press are live:
 * use the mouse and keyboard on the pieces below. Sections 8, 9, 11 and 12 are in
 * `sections/layout-sections.tsx`, `sections/dialog-sections.tsx` and `sections/states-sections.tsx`.
 */

const TAG_KEYS = Object.keys(WORKFORCE_TAGS) as WorkforceTagKey[];

export function KitGallery() {
  // KPI / chips
  const [chip, setChip] = React.useState('all');
  const [last, setLast] = React.useState('nothing yet');

  // date
  const [start, setStart] = React.useState<string | null>(null);
  const [lastDay, setLastDay] = React.useState<string | null>(null);

  return (
    <main className="mx-auto max-w-[1180px] bg-wds-canvas px-4 py-8 font-wds-sans text-wds-text sm:px-8">
      <h1 className="m-0 mb-1 font-wds-sans text-[26px] font-semibold tracking-[-0.02em] text-wds-text-ink">Workforce kit</h1>
      <p className="mb-8 mt-0 max-w-3xl text-[13px] leading-[19px] text-wds-text-secondary">
        Every shared Workforce piece in every state, labelled with its Paper node. Hover (mouse), focus (Tab) and press are live. This is a dev page, not a product screen, and it is hidden in production.
      </p>
      <nav aria-label="Kit sections" className="mb-10 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {[
          ['rules', 'Behaviour rules'],
          ['kpi', 'KPI strip'],
          ['tags', 'Tags'],
          ['chips', 'Chips and bar'],
          ['avatar', 'Avatar'],
          ['ring', 'Ring and bar'],
          ['timeline', 'Timelines'],
          ['layouts', 'Layouts'],
          ['dialogs', 'Dialogs and toast'],
          ['date', 'Date field'],
          ['states', 'States kit'],
          ['notifications', 'Notifications'],
          ...MORE_NAV,
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-wds-text-secondary underline-offset-2 hover:text-wds-text-ink hover:underline focus-visible:shadow-wds-ring focus-visible:outline-none">
            {label}
          </a>
        ))}
      </nav>

      {/* ------------------------------------------------------------------ 1 */}
      <Section id="rules" title="1 · Behaviour rules" node="1Q58-0" note="Rules 04 and 09 are inside the pieces: one brown button per screen (the footer of a dialog or wizard has the only one), a button a role may not use is hidden, never greyed (an action is passed only if allowed), Escape closes a dialog and gives focus back, and Enter never completes a signed act.">
        <div>
          <Label>Pressed, disabled with a reason, focus ring (Tab to a button)</Label>
          <div className="flex flex-wrap items-center gap-3">
            <DialogButton kind="primary">Brown (the one per screen)</DialogButton>
            <DialogButton kind="cancel">Outlined</DialogButton>
            <DialogButton kind="danger">Red (destructive only)</DialogButton>
            <DialogButton kind="primary" disabled title="Choose a reason first">Disabled</DialogButton>
            <span className="text-[12px] text-wds-text-secondary">Disabled always shows why, here: “Choose a reason first”.</span>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ 2 */}
      <Section id="kpi" title="2 · KPI strip" node="QX1-0 / SUY-0" note="Actionable cells get a 2 px warning top border, a warning number and an arrow, and are buttons. The others are plain.">
        <div>
          <Label>Desktop</Label>
          <WorkforceKpiStrip
            aria-label="People summary"
            cells={[
              { key: 'a', label: 'PEOPLE ON FILE', value: '89', detail: '77 active, 12 exited' },
              { key: 'b', label: 'NEEDS FINISHING', value: '3', detail: 'bank, contract or photo missing', actionable: true, onSelect: () => setLast('Needs finishing') },
              { key: 'c', label: 'NO CONTRACT YET', value: '4', detail: 'monthly staff without one', actionable: true, onSelect: () => setLast('No contract yet') },
              { key: 'd', label: 'JOINED THIS MONTH', value: '5', detail: '2 still in probation' },
            ]}
          />
          <p className="mt-2 text-[12px] text-wds-text-secondary">Last cell pressed: {last}</p>
        </div>
        <div className="max-w-[390px]">
          <Label>Phone (cells stack)</Label>
          <WorkforceKpiStrip
            cells={[
              { key: 'a', label: 'ON TIME', value: '19/20', detail: 'shifts this month' },
              { key: 'b', label: 'OVERTIME', value: '25 m', detail: 'approved' },
            ]}
          />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ 3 */}
      <Section id="tags" title="3 · Status pills and tags" node="R3E-0 / 11LC-0 / QJ9-0" note="Square corners, 1 px border, 12 px text. Colour is the status; the words come from the screen or the default table below. “Late”, “Overtime”, “Pending”, “Approved”, “Declined”, “Contract missing” and “No login” use the matching status colour but are not drawn as tags in the chapters read for this kit (see README).">
        <div>
          <Label>Every variant (row size)</Label>
          <div className="flex flex-wrap gap-2">
            {TAG_KEYS.map((k) => (
              <WorkforceTag key={k} tag={k} />
            ))}
            <WorkforceTag tag="probationEnds" label="Probation ends 14 Oct" />
          </div>
        </div>
        <div>
          <Label>Header size (3 px) and checklist chips</Label>
          <div className="flex flex-wrap gap-2">
            <StatusTag tone="warning" size="header">On probation</StatusTag>
            <StatusTag tone="neutral" size="header">Monthly</StatusTag>
            <StatusTag tone="neutral" size="header">Clocks in</StatusTag>
            <StatusTag tone="success" size="header" mark="done">Identity</StatusTag>
            <StatusTag tone="success" size="header" mark="done">Bank</StatusTag>
            <StatusTag tone="warning" size="header" mark="open">Contract</StatusTag>
            <StatusTag tone="warning" size="header" mark="open">Emergency contact</StatusTag>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ 4 */}
      <Section id="chips" title="4 · Filter chips with counts and the filter bar" node="R2T-0" note="Search first, then chips, then column dropdowns at the right (UI_BUILD_RULES 4a). A real table feeds this from ui2 data-table, which owns the URL state; this is the look and the keyboard.">
        <FilterBar
          search={
            <input
              aria-label="Search employees"
              autoComplete="off"
              placeholder="Find a person"
              className="h-8 w-[260px] border border-wds-border bg-wds-surface px-2.5 text-[13px] focus-visible:border-wds-primary focus-visible:shadow-wds-ring focus-visible:outline-none"
            />
          }
          chips={
            <>
              <FilterChip label="All" count={89} selected={chip === 'all'} onClick={() => setChip('all')} />
              <FilterChip label="Needs finishing" count={3} tone="attention" selected={chip === 'nf'} onClick={() => setChip('nf')} />
              <FilterChip label="No contract yet" count={4} selected={chip === 'nc'} onClick={() => setChip('nc')} />
              <FilterChip label="Casual pool" count={6} selected={chip === 'cp'} onClick={() => setChip('cp')} />
              <FilterChip label="Exited" count={12} selected={chip === 'ex'} onClick={() => setChip('ex')} />
              <FilterChip label="Overtime" count={0} disabled disabledReason="Nothing to show: no overtime this week" />
            </>
          }
          trailing={
            <>
              <FilterChip label="Site · All" />
              <FilterChip label="Department · All" />
            </>
          }
        />
      </Section>

      {/* ------------------------------------------------------------------ 5 */}
      <Section id="avatar" title="5 · Avatar and presence dot" node="R3E-0 / 11LC-0 / QJ9-0" note="The tile colour comes from the name, so a person looks the same on every screen. A photo replaces the initials, and falls back to them if it does not load.">
        <div className="flex flex-wrap items-center gap-5">
          <PersonAvatar name="Brian Otieno" size="xs" />
          <PersonAvatar name="Brian Otieno" size="sm" />
          <PersonAvatar name="Joy Chebet" size="md" />
          <PersonAvatar name="Joy Chebet" size="lg" />
          <PersonAvatar name="Amina Hassan" size="sm" presence="on" />
          <PersonAvatar name="Faith Njeri" size="sm" presence="late" />
          <PersonAvatar name="Peter Karanja" size="sm" presence="off" />
          <AvatarStack names={['Brian Otieno', 'Joy Chebet', 'Amina Hassan', 'Faith Njeri', 'Peter Karanja', 'A B', 'C D', 'E F', 'G H']} />
          <PresenceDot presence="on" />
          <PresenceDot presence="late" />
          <PresenceDot presence="off" label="Not in" />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ 6 */}
      <Section id="ring" title="6 · Completeness ring and probation bar" node="11LC-0 / RD3-0" note="Ring: red under 50, amber 50 to 84, green 85 to 99, solid green with a tick at 100. Bar: green with more than 30 days left, amber at 30 or fewer, red at 7 or fewer.">
        <div className="flex flex-wrap items-center gap-8">
          {[20, 49, 50, 67, 84, 85, 99, 100].map((p) => (
            <div key={p} className="flex flex-col items-center gap-1">
              <CompletenessRing percent={p} />
              <span className="font-wds-mono text-[10px] text-wds-text-secondary">{p}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1">
            <CompletenessRing percent={20} size={64} variant="progress" />
            <span className="font-wds-mono text-[10px] text-wds-text-secondary">progress 20</span>
          </div>
        </div>
        <div className="flex max-w-[560px] flex-col gap-5">
          {[
            { day: 20, total: 90 },
            { day: 60, total: 90 },
            { day: 61, total: 90 },
            { day: 80, total: 90 },
            { day: 83, total: 90 },
            { day: 88, total: 90 },
          ].map(({ day, total }) => {
            const left = total - day;
            return (
              <div key={day} className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <span className={cn('text-[30px] font-semibold leading-[34px] tracking-[-0.025em]', probationTextClass(left))}>Day {day}</span>
                  <span className="text-[13px] text-wds-text-secondary">of {total} · {left} days left · {probationColour(left)}</span>
                </div>
                <ProbationBar dayNumber={day} totalDays={total} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ 7 */}
      <Section id="timeline" title="7 · Timelines" node="11LC-0 / POH-0">
        <div className="overflow-x-auto border border-wds-border bg-wds-surface px-5 py-3.5">
          <Label>Life at Wendo</Label>
          <div className="min-w-[860px]">
            <LifeTimeline
              events={[
                { key: '1', date: '14 JUL', text: 'Hired as Barista, probation began' },
                { key: '2', date: '15 JUL', text: 'ID and KRA PIN received' },
                { key: '3', date: '2 OCT', text: "Victor's report: good" },
                { key: '4', date: '14 OCT', text: 'Probation decision', state: 'future' },
              ]}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="mb-2 flex items-baseline justify-between border-b border-wds-text-ink pb-2">
              <span className="text-[15px] font-semibold text-wds-text-ink">Coming up</span>
              <span className="font-wds-mono text-[11px] text-wds-text-secondary">NEXT 4 WEEKS</span>
            </div>
            <ComingUpTimeline
              className="pt-[18px]"
              events={[
                { key: '1', date: '12 OCT', text: 'Faith Njeri starts leave' },
                { key: '2', date: '14 OCT', text: "Joy Chebet's probation ends" },
                { key: '3', date: '25 OCT', text: 'October timesheets close' },
                { key: '4', date: '28 OCT', text: 'Pay run goes to the Accountant' },
                { key: '5', date: '30 OCT', text: 'Payday', tone: 'good' },
              ]}
            />
          </div>
        </div>
      </Section>

      <LayoutSections />
      <DialogSections />

      {/* ----------------------------------------------------------------- 10 */}
      <Section id="date" title="10 · Single-day date field" node="1S6R-0 (rule 13)" note="Opens the approved picker in single-day mode: one click picks the day, no To field, calendar icon on the field. A start date may be in the future; a last day may not.">
        <div className="grid max-w-[620px] gap-6 sm:grid-cols-2">
          <SingleDateField label="STARTS ON" value={start} onChange={setStart} maxDate="2027-12-31" helper="Can be in the future." />
          <SingleDateField label="LAST DAY" value={lastDay} onChange={setLastDay} helper="Today or earlier." />
          <SingleDateField label="WITH AN ERROR" value={null} onChange={() => undefined} error="Pick the day it starts." />
        </div>
      </Section>

      <StatesSections />
      <NotificationSections />

      <MoreSections />
    </main>
  );
}
