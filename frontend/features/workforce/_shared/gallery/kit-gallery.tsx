'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import {
  AvatarStack,
  ChangeDialog,
  CompletenessRing,
  ComingUpTimeline,
  DialogButton,
  EMPTY_REASON,
  EmptyState,
  ErrorBlock,
  FileSoFarPanel,
  FilterBar,
  FilterChip,
  InboxRow,
  KitDialog,
  LifeTimeline,
  ListDetailLayout,
  ListRow,
  ListSkeleton,
  NOTIFICATION_DELIVERY,
  NOTIFICATION_KIND_LABEL,
  NOTIFICATION_KIND_TONE,
  NOTIFICATION_PARTS,
  NOTIFICATION_ROWS,
  OfflineStrip,
  OldToNew,
  PersonAvatar,
  PresenceDot,
  ProbationBar,
  ReasonChips,
  SCREEN_KEYS,
  STATES_COPY,
  SavedOnPhoneMarker,
  SingleDateField,
  StatusTag,
  StepRail,
  UndoToast,
  WORKFORCE_TAGS,
  WizardFooter,
  WizardLayout,
  WizardTopBar,
  DraftIndicator,
  WorkforceKpiStrip,
  WorkforcePinDialog,
  WorkforceTag,
  probationColour,
  probationTextClass,
  statesCopy,
  type ReasonValue,
  type WorkforceTagKey,
} from '..';
import { Label, Section } from './gallery-parts';
import { SecretsSection } from './section-secrets';

/**
 * Dev gallery for the Workforce kit: every piece in every state, labelled with
 * its Paper node. Not a product screen. Hover, focus (Tab) and press are live:
 * use the mouse and keyboard on the pieces below.
 */


const TAG_KEYS = Object.keys(WORKFORCE_TAGS) as WorkforceTagKey[];

export function KitGallery() {
  // KPI / chips
  const [chip, setChip] = React.useState('all');
  const [last, setLast] = React.useState('nothing yet');

  // list and detail
  const people = [
    { name: 'Brian Otieno', role: 'Waiter', presence: 'on' as const },
    { name: 'Joy Chebet', role: 'Barista', presence: 'late' as const },
    { name: 'Amina Hassan', role: 'Barista', presence: 'off' as const },
    { name: 'Peter Karanja', role: 'Kitchen hand' },
  ];
  const [sel, setSel] = React.useState('Joy Chebet');
  const [phoneDetail, setPhoneDetail] = React.useState(false);

  // dialogs
  const [reason, setReason] = React.useState<ReasonValue>(EMPTY_REASON);
  const [changeOpen, setChangeOpen] = React.useState(false);
  const [shellOpen, setShellOpen] = React.useState(false);
  const [pinOpen, setPinOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // undo
  const [undo, setUndo] = React.useState<number | null>(null);

  // date
  const [start, setStart] = React.useState<string | null>(null);
  const [lastDay, setLastDay] = React.useState<string | null>(null);

  // states
  const [retrying, setRetrying] = React.useState(false);
  const [showSkeleton, setShowSkeleton] = React.useState(true);

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
          ['secrets', 'PIN and code'],
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

      {/* ------------------------------------------------------------------ 8 */}
      <Section id="layouts" title="8 · List and detail, stepper wizard" node="R3E-0 / R5O-0" note="The chosen row has a caramel bar. On a phone the list and detail become one column (toggle below). The wizard shows steps left, form centre, “The file so far” right, and the footer with the one brown button.">
        <div>
          <Label>List and detail (desktop width)</Label>
          <ListDetailLayout
            className="min-h-[220px]"
            showDetail={phoneDetail}
            list={
              <div>
                {people.map((p) => (
                  <ListRow key={p.name} selected={sel === p.name} onSelect={() => { setSel(p.name); setPhoneDetail(true); }}>
                    <PersonAvatar name={p.name} size="sm" presence={p.presence} />
                    <span className="flex flex-col">
                      <span className="text-[14px] font-medium leading-[18px] text-wds-text-ink">{p.name}</span>
                      <span className="text-[12px] leading-4 text-wds-text-secondary">{p.role}</span>
                    </span>
                  </ListRow>
                ))}
              </div>
            }
            detail={
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <PersonAvatar name={sel} size="lg" />
                  <div>
                    <div className="text-[24px] font-semibold leading-[30px] tracking-[-0.02em] text-wds-text-ink">{sel}</div>
                    <div className="text-[14px] text-wds-text-secondary">Detail for the chosen row</div>
                  </div>
                </div>
                <button type="button" className="mt-4 text-[13px] text-wds-text-secondary underline md:hidden" onClick={() => setPhoneDetail(false)}>
                  ‹ Back to the list (phone only)
                </button>
              </div>
            }
          />
          <p className="mt-2 text-[12px] text-wds-text-secondary">Below 768 px wide this shows the list, then the detail after a tap.</p>
        </div>
        <div>
          <Label>Stepper wizard</Label>
          <div className="border border-wds-border">
            <WizardLayout
              topBar={<WizardTopBar crumbs={['Employees', 'Add employee']} draft={<DraftIndicator text="Saved as a draft as you go" />} />}
              rail={
                <StepRail
                  title="NEW EMPLOYEE"
                  steps={[
                    { key: 'who', label: 'Who', state: 'current' },
                    { key: 'job', label: 'Job', state: 'upcoming' },
                    { key: 'pay', label: 'Pay', state: 'upcoming' },
                    { key: 'bank', label: 'Statutory and bank', state: 'upcoming' },
                    { key: 'login', label: 'Login', state: 'upcoming' },
                  ]}
                />
              }
              form={
                <>
                  <div>
                    <h2 className="m-0 text-[24px] font-semibold leading-[30px] tracking-[-0.02em] text-wds-text-ink">Who is joining?</h2>
                    <p className="mb-0 mt-2 text-[14px] leading-5 text-wds-text-secondary">The basics. She can add her own photo and details on her phone.</p>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="font-wds-mono text-[11px] tracking-[0.06em] text-wds-text-secondary">FULL NAME</span>
                    <input autoComplete="off" className="h-10 border border-wds-border-strong bg-wds-surface px-3 text-[14px] focus-visible:border-wds-primary focus-visible:shadow-wds-ring focus-visible:outline-none" defaultValue="Wanjiru Kamau" />
                  </label>
                </>
              }
              panel={
                <FileSoFarPanel
                  title="THE FILE SO FAR"
                  percent={20}
                  note="She can be rostered once Who and Job are done. Pay and bank details are needed before payroll."
                  rows={[
                    { key: 'who', label: 'Who', value: 'In progress', tone: 'progress' },
                    { key: 'job', label: 'Job', value: 'Next · HR or Branch Manager' },
                    { key: 'pay', label: 'Pay', value: 'HR only' },
                    { key: 'bank', label: 'Statutory and bank', value: 'HR, then Wanjiru' },
                    { key: 'login', label: 'Login', value: 'HR' },
                  ]}
                />
              }
              footer={
                <WizardFooter
                  stepText="Step 1 of 5"
                  actions={
                    <>
                      <DialogButton kind="cancel" className="h-9">Save and close</DialogButton>
                      <DialogButton kind="primary" className="h-9 px-5">Continue to Job</DialogButton>
                    </>
                  }
                />
              }
            />
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ 9 */}
      <Section id="dialogs" title="9 · Reason chips, “what changes” dialog, PIN dialog, Undo toast" node="VM5-0 / 1Q58-0 (rules 02, 03, 06, 09)" note="Open each with the mouse or the keyboard. Escape closes and returns focus to the button. Enter in a field never completes anything. The PIN dialog asks the server for PIN status, so with no signed-in session it shows its own “couldn’t check” state.">
        <div className="max-w-[560px]">
          <Label>Reason chips (arrow keys move between them)</Label>
          <ReasonChips
            legend="REASON"
            options={[
              { key: 'cover', label: 'Cover for a gap' },
              { key: 'request', label: 'Staff request' },
              { key: 'sick', label: 'Sick' },
              { key: 'traffic', label: 'Morning traffic' },
            ]}
            value={reason}
            onChange={setReason}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DialogButton kind="cancel" onClick={() => setChangeOpen(true)}>Open “what changes” dialog</DialogButton>
          <DialogButton kind="cancel" onClick={() => setShellOpen(true)}>Open plain dialog shell</DialogButton>
          <DialogButton kind="cancel" onClick={() => setPinOpen(true)}>Open PIN dialog</DialogButton>
          <DialogButton kind="cancel" onClick={() => setUndo(Date.now())}>Show the Undo toast (30 s)</DialogButton>
        </div>
        <div>
          <Label>Old to new rows</Label>
          <div className="max-w-[420px] border border-wds-border bg-wds-surface px-4">
            <OldToNew label="Basic pay" from="KES 38,000" to="KES 42,000" />
            <OldToNew label="Starts on" from="Mon 5 Oct" to="Mon 2 Nov" />
          </div>
        </div>

        <ChangeDialog
          open={changeOpen}
          onOpenChange={setChangeOpen}
          title="Assign a head for Housekeeping"
          description="Nyeri Town. Two people work here, and approvals are with Faith Njeri for now."
          summaryCaption="WHAT CHANGES WHEN GRACE BECOMES HEAD"
          summaryLines={[
            'Overtime, leave and Reports for Housekeeping go to Grace instead of Faith Njeri. One item is waiting now and moves to her.',
            'Her phone gains Team today, Rota and Casuals. Her own job and pay do not change, and she sees her own pay only.',
            'Faith Njeri is told, and keeps the power to step in. This is written to the audit log with your name and the time.',
          ]}
          confirmLabel="Assign Grace as head"
          confirmDisabledReason={reason.choice ? undefined : 'Choose a reason (above) before you can assign.'}
          busy={saving}
          onConfirm={() => {
            setSaving(true);
            window.setTimeout(() => {
              setSaving(false);
              setChangeOpen(false);
            }, 900);
          }}
        >
          <ReasonChips
            name="dialog-reason"
            legend="REASON"
            options={[
              { key: 'cover', label: 'Cover for a gap' },
              { key: 'request', label: 'Staff request' },
            ]}
            value={reason}
            onChange={setReason}
          />
        </ChangeDialog>
        <KitDialog
          open={shellOpen}
          onOpenChange={setShellOpen}
          title="Plain dialog shell"
          description="Title, one line, a close ×, the scrim, footer buttons."
          footer={
            <>
              <DialogButton kind="cancel" onClick={() => setShellOpen(false)}>Cancel</DialogButton>
              <DialogButton kind="primary" onClick={() => setShellOpen(false)}>Save</DialogButton>
            </>
          }
        >
          <input autoComplete="off" aria-label="First field has focus when it opens" className="h-10 border border-wds-border-strong px-3 text-[14px] focus-visible:border-wds-primary focus-visible:shadow-wds-ring focus-visible:outline-none" placeholder="First field has focus when it opens" />
        </KitDialog>
        <WorkforcePinDialog
          open={pinOpen}
          onOpenChange={setPinOpen}
          title="Approve the October run?"
          summaryRows={[
            { label: 'People paid', value: '85', mono: true },
            { label: 'Net to pay', value: 'KES 3,168,500', mono: true },
            { label: 'Statutory tables', value: 'Confirmed by you, 19 Oct 09:15', tone: 'success' },
            { label: 'Prepared by', value: 'Mercy Achieng, not you' },
          ]}
          pinLabel="Your PIN, to sign the approval"
          caption="Mercy Achieng is told to publish. Staff cannot see anything yet. Recorded in the audit log with your name and the time."
          confirmLabel="Approve"
          onSubmit={() => setPinOpen(false)}
        />
        {undo !== null ? (
          <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
            <UndoToast key={undo} startedAt={undo} message="Approved Lucy Wambui's overtime." onUndo={() => setUndo(null)} onExpire={() => setUndo(null)} />
          </div>
        ) : null}
      </Section>

      {/* ----------------------------------------------------------------- 10 */}
      <Section id="date" title="10 · Single-day date field" node="1S6R-0 (rule 13)" note="Opens the approved picker in single-day mode: one click picks the day, no To field, calendar icon on the field. A start date may be in the future; a last day may not.">
        <div className="grid max-w-[620px] gap-6 sm:grid-cols-2">
          <SingleDateField label="STARTS ON" value={start} onChange={setStart} maxDate="2027-12-31" helper="Can be in the future." />
          <SingleDateField label="LAST DAY" value={lastDay} onChange={setLastDay} helper="Today or earlier." />
          <SingleDateField label="WITH AN ERROR" value={null} onChange={() => undefined} error="Pick the day it starts." />
        </div>
      </Section>

      {/* ----------------------------------------------------------------- 11 */}
      <Section id="states" title="11 · States kit" node="1Q6R-0 / 1Q84-0" note="Loading is bars in the shape of the rows; after 8 seconds a line appears. Empty has two kinds. An error replaces only the part that failed. Words come from the per-screen table below.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <Label>Loading · a list (wait 8 s for the extra line)</Label>
            {showSkeleton ? <ListSkeleton /> : <p className="text-[13px] text-wds-text-secondary">Hidden.</p>}
            <button type="button" className="mt-2 text-[12px] underline" onClick={() => { setShowSkeleton(false); window.setTimeout(() => setShowSkeleton(true), 50); }}>Restart the 8 second clock</button>
          </div>
          <div>
            <Label>Empty · nothing yet</Label>
            <EmptyState kind="nothingYet" title="No employees yet" line={statesCopy('people', 'nothingYet')} action={{ label: 'Add employee', onClick: () => undefined }} />
          </div>
          <div>
            <Label>Empty · nothing found</Label>
            <EmptyState kind="nothingFound" title="Nothing found" line={statesCopy('people', 'nothingFound', { term: 'Wanj' })} action={{ label: 'Clear the search', onClick: () => undefined }} />
          </div>
          <div>
            <Label>Error</Label>
            <ErrorBlock
              title="We could not load the rota."
              line="Nothing was changed. Try again, and if it keeps failing tell support the reference."
              reference="4F2A"
              retrying={retrying}
              onRetry={() => { setRetrying(true); window.setTimeout(() => setRetrying(false), 1200); }}
            />
          </div>
          <div>
            <Label>Offline strip</Label>
            <OfflineStrip stillWorks="Clock-ins still work and are sent when the signal returns." />
          </div>
          <div>
            <Label>Saved on this phone</Label>
            <SavedOnPhoneMarker what="Clock-in at 06:04, waiting to send" />
          </div>
        </div>
        <div>
          <Label>Per-screen copy table (typed, one row per screen)</Label>
          <div className="overflow-x-auto border border-wds-border bg-wds-surface">
            <table className="w-full min-w-[900px] border-collapse text-left text-[12px] leading-[17px]">
              <thead>
                <tr className="border-b border-wds-text-ink font-wds-mono text-[10px] tracking-[0.08em] text-wds-text-secondary">
                  <th className="px-5 py-3 font-normal">SCREEN</th>
                  <th className="px-5 py-3 font-normal">EMPTY, NOTHING YET</th>
                  <th className="px-5 py-3 font-normal">EMPTY, NOTHING FOUND</th>
                  <th className="px-5 py-3 font-normal">ERROR LINE</th>
                </tr>
              </thead>
              <tbody>
                {SCREEN_KEYS.map((k) => (
                  <tr key={k} className="border-b border-wds-neutral-100 align-top last:border-b-0">
                    <td className="px-5 py-3 font-semibold text-wds-text-ink">{STATES_COPY[k].screen}</td>
                    <td className="px-5 py-3 text-wds-text-ink">{STATES_COPY[k].nothingYet}</td>
                    <td className="px-5 py-3 text-wds-text-ink">{STATES_COPY[k].nothingFound}</td>
                    <td className="px-5 py-3 text-wds-text-ink">{STATES_COPY[k].error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------- 12 */}
      <Section id="notifications" title="12 · Notifications" node="19PW-0 / 19S3-0 / 19TC-0" note="The five-part template as an Inbox row, one per kind (the colour bar), then the wording table as the typed module. Anything that needs a decision goes to Waiting for you, not here.">
        <div className="grid gap-4 lg:grid-cols-2">
          <InboxRow areaKind="ROTA CHANGE" kind="changed" when="3 min" whenExact="Sat 17 Oct, 14:02" title="Sat 17 changed: day off is now Morning" whoAndWhy="Changed by Faith Njeri. Reason: cover for a gap." action={{ label: 'See my rota', onClick: () => undefined }} unread />
          <InboxRow areaKind="ROTA · PUBLISHED" kind="information" when="1 h" title="Your rota for 12 to 18 October is ready. 5 shifts, 40 h." action={{ label: 'See my rota', onClick: () => undefined, emphasis: 'outlined' }} />
          <InboxRow areaKind="OVERTIME" kind="done" when="Yesterday" title="1 h 30 min overtime approved." whoAndWhy="It will be on your October payslip." />
          <InboxRow areaKind="PAYSLIP · SECURITY" kind="problem" when="now" title="Your September payslip was opened on a phone you have not confirmed." whoAndWhy="Tecno phone, Nairobi, 14:05. If it was you, tap Yes, this is my phone." action={{ label: 'Open Activity on my record', onClick: () => undefined }} />
        </div>
        <div className="grid gap-x-8 gap-y-2 text-[12px] sm:grid-cols-2">
          {NOTIFICATION_PARTS.map((p) => (
            <p key={p.n} className="m-0 text-wds-text-secondary"><strong className="text-wds-text-ink">{p.n} {p.name}.</strong> {p.rule}</p>
          ))}
        </div>
        <div>
          <Label>Wording table · {NOTIFICATION_ROWS.length} events</Label>
          <div className="overflow-x-auto border border-wds-border bg-wds-surface">
            <table className="w-full min-w-[980px] border-collapse text-left text-[13px] leading-[19px]">
              <thead>
                <tr className="border-b border-wds-text-ink font-wds-mono text-[10px] tracking-[0.06em] text-wds-text-secondary">
                  <th className="w-[300px] px-4 py-2.5 font-normal">EVENT</th>
                  <th className="w-[250px] px-4 py-2.5 font-normal">WHO IS TOLD</th>
                  <th className="w-[130px] px-4 py-2.5 font-normal">KIND</th>
                  <th className="px-4 py-2.5 font-normal">WORDING</th>
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_ROWS.map((r) => (
                  <tr key={r.key} className="border-b border-wds-neutral-100 align-top">
                    <td className="px-4 py-2.5 text-wds-text-ink">{r.event}</td>
                    <td className="px-4 py-2.5 text-wds-text-secondary">{r.whoIsTold}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn(NOTIFICATION_KIND_TONE[r.kind] === 'info' && 'text-wds-info-fg', NOTIFICATION_KIND_TONE[r.kind] === 'amber' && 'text-wds-warning-fg', NOTIFICATION_KIND_TONE[r.kind] === 'success' && 'text-wds-success-fg', NOTIFICATION_KIND_TONE[r.kind] === 'error' && 'text-wds-error-fg')}>
                        {NOTIFICATION_KIND_LABEL[r.kind]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-wds-text-ink">{r.wording}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-2.5 text-wds-text-ink">Where and when</td>
                  <td className="px-4 py-2.5 text-wds-text-secondary">{NOTIFICATION_DELIVERY.where}</td>
                  <td className="px-4 py-2.5 text-wds-text-ink">All</td>
                  <td className="px-4 py-2.5 text-wds-text-secondary">{NOTIFICATION_DELIVERY.wording}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <SecretsSection />
    </main>
  );
}
