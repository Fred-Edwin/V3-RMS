'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { TimerChip, WorkforceKpiStrip } from '../../_shared';
import { Label, Section } from '../../_shared/gallery/gallery-parts';
import { HOME_CARDS } from '../cards';
import { AttentionList } from '../components/attention-list';
import { BranchNowHeader, DepartmentChips, NeedsALook, OnTimeByDepartment } from '../components/branch-board';
import { ComingUpSection } from '../components/coming-up-section';
import { HomeButton } from '../components/home-button';
import { HomeLayout } from '../components/home-stack';
import { PeopleByBranch } from '../components/people-by-branch';
import { JobCardsSlot, ServiceTeamCard, WeekCard } from '../components/phone-cards';
import { PhoneBarAction, PhoneHomeBar } from '../components/phone-home-bar';
import { SectionHeader } from '../components/section-header';
import { WaitingForYouCard, WaitingForYouColumn } from '../components/waiting-for-you';
import { arrangeHome, visibleCards, type CardDataState, type HomeSurface } from '../lib/card-registry';
import type { WorkforceCapability } from '../../_shared';
import {
  ACCOUNTANT_STATES,
  BRANCH_BOARD,
  BRANCH_KPIS,
  BRANCH_STATES,
  BRANCH_NEEDS_YOU,
  BRANCH_WAITING,
  DIRECTOR_STATES,
  HEAD_STATES,
  HEAD_TEAM,
  HEAD_WAITING,
  HR_ATTENTION,
  HR_COMING_UP,
  HR_KPIS,
  HR_PEOPLE,
  HR_STATES,
  JOB_SLOT,
  STAFF_STATES,
  WEEK_HEAD,
  WEEK_STAFF,
} from '../fixtures/home-fixtures';

/**
 * Dev gallery for Workforce Home: every block with Paper's names and numbers, its states, and each role's full page built from the
 * real registered cards (so capability visibility and urgency order are what the product does). Not a product screen; `app/dev/` is
 * 404 in production. Each section carries its Paper node.
 */

const caps = (...c: WorkforceCapability[]) => (cap: WorkforceCapability): boolean => c.includes(cap);

/** One role's page from the real cards: who may see what is decided by the capabilities, exactly as in the product. */
function RolePage({ surface, can, states, heading }: { surface: HomeSurface; can: (c: WorkforceCapability) => boolean; states: Record<string, CardDataState<unknown>>; heading?: React.ReactNode }) {
  const visible = visibleCards(HOME_CARDS, surface, can);
  const arranged = arrangeHome(visible, states);
  return <HomeLayout arranged={arranged} surface={surface} heading={heading} />;
}

const Greeting = ({ title, line }: { title: string; line: string }) => (
  <div className="flex flex-col gap-1.5">
    <h1 className="m-0 font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">{title}</h1>
    <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{line}</p>
  </div>
);

const Desktop = ({ children, width = 1204 }: { children: React.ReactNode; width?: number }) => (
  <div className="overflow-x-auto">
    <div className="border border-wds-border bg-wds-canvas" style={{ width, maxWidth: '100%' }}>
      {children}
    </div>
  </div>
);
const Phone = ({ children }: { children: React.ReactNode }) => <div className="w-[390px] max-w-full border border-wds-border bg-wds-canvas">{children}</div>;

export const HOME_GALLERY_NAV = [
  ['pages', 'Whole pages'],
  ['phone-pages', 'Phone pages'],
  ['hr', 'HR blocks'],
  ['branch', 'Branch blocks'],
  ['phone', 'Phone blocks'],
  ['buttons', 'Buttons'],
  ['states', 'Page states'],
] as const;

export function HomeGallery() {
  const [last, setLast] = React.useState('nothing yet');
  const press = (what: string) => () => setLast(what);
  return (
    <div className="min-h-screen bg-wds-canvas px-6 py-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-8">
          <h1 className="m-0 font-wds-sans text-[26px] font-semibold leading-8 tracking-[-0.02em] text-wds-text-ink">Workforce Home</h1>
          <p className="mb-0 mt-1 max-w-2xl font-wds-sans text-[14px] leading-5 text-wds-text-secondary">
            Every Home block with Paper’s examples, in every state, and each role’s page built from the real registered cards. Chapter 1 · Role homes and navigation (Paper OOK-0). Last pressed: <span className="font-wds-mono">{last}</span>
          </p>
          <nav aria-label="Sections" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-wds-mono text-[11px] text-wds-text-secondary">
            {HOME_GALLERY_NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="underline-offset-2 hover:underline">
                {label}
              </a>
            ))}
          </nav>
        </header>

        <Section id="pages" title="Desktop Homes, one per role" node="OOZ-0 / PPM-0 / OPQ-0" note="Built from the registered cards with fixture data. HR and the Branch Manager are drawn in Paper; the Store Manager is the Branch Manager's page for the Central Store; the Accountant and Director follow the reference table (no drawing). Width is Paper's content width at 1440.">
          <div>
            <Label>HR Manager · OOZ-0</Label>
            <Desktop>
              <RolePage surface="desktop" can={caps('employee.write_sensitive', 'overtime.approve', 'leave.approve', 'needs_you.read')} states={{ ...HR_STATES, 'workforce.needs-you': { status: 'ready', data: BRANCH_NEEDS_YOU } }} heading={<Greeting title="Good morning, Mercy" line="Sunday 4 October. 11 things are waiting on people, and 3 of them are waiting on you." />} />
            </Desktop>
          </div>
          <div>
            <Label>Branch Manager · PPM-0</Label>
            <Desktop>
              <RolePage surface="desktop" can={caps('today.act', 'overtime.approve', 'leave.approve', 'needs_you.read')} states={BRANCH_STATES} heading={<BranchNowHeader title="Nyeri Town, right now" subtitle="Sunday 4 October, 10:42. The morning shift ends at 14:00." />} />
            </Desktop>
          </div>
          <div>
            <Label>Store Manager · the same cards, for the Central Store</Label>
            <Desktop>
              <RolePage surface="desktop" can={caps('today.act', 'overtime.approve', 'clock_mistake.resolve', 'needs_you.read')} states={BRANCH_STATES} heading={<BranchNowHeader title="Central Store, right now" subtitle="Sunday 4 October, 10:42. The morning shift ends at 14:00." />} />
            </Desktop>
          </div>
          <div>
            <Label>Accountant · reference table (no drawing)</Label>
            <Desktop>
              <RolePage surface="desktop" can={caps('payroll.approve', 'timesheet.read', 'needs_you.read')} states={ACCOUNTANT_STATES} heading={<Greeting title="Good morning, Anne" line="Sunday 4 October. 2 steps are waiting on you before the October pay run." />} />
            </Desktop>
          </div>
          <div>
            <Label>Director · reference table (no drawing)</Label>
            <Desktop>
              <RolePage surface="desktop" can={caps('payroll.approve_site_late', 'leave.approve', 'rota.read', 'needs_you.remind')} states={DIRECTOR_STATES} heading={<Greeting title="Good morning, Wendo" line="Sunday 4 October. 2 approvals are overdue." />} />
            </Desktop>
          </div>
        </Section>

        <Section id="phone-pages" title="Phone Homes" node="QG8-0" note="The staff member and the department head, from the real cards. The two slots in the dark band (shift pill, job's primary action) are shown filled here and empty in the product until Attendance and the Orders redo fill them.">
          <div className="flex flex-wrap items-start gap-8">
            <div>
              <Label>Staff · Brian Otieno, waiter · cards 01, 03, 05</Label>
              <Phone>
                <PhoneHomeBar kicker="WENDO RMS · NYERI TOWN" onMenu={press('menu')} shiftPill={<TimerChip tone="green" time="4:46" label="Shift ends in" />} primaryAction={<PhoneBarAction label="New order" onClick={press('new order')} />} name="Brian Otieno" greeting="Good morning, Brian" subtitle="Sunday 4 October · Nyeri Town" />
                <div className="-mt-9">
                  <RolePage surface="phone" can={caps('time.own')} states={STAFF_STATES} />
                </div>
              </Phone>
            </div>
            <div>
              <Label>Department head · Nancy Wangari, Service · cards 01 to 05</Label>
              <Phone>
                <PhoneHomeBar kicker="WENDO RMS · NYERI TOWN" onMenu={press('menu')} somethingWaits shiftPill={<TimerChip tone="green" time="4:38" label="Shift ends in" />} primaryAction={<PhoneBarAction label="New order" onClick={press('new order')} />} name="Nancy Wangari" greeting="Good morning, Nancy" subtitle="Head of Service · Nyeri Town" />
                <div className="-mt-9">
                  <RolePage surface="phone" can={caps('time.own', 'overtime.approve', 'casual.record', 'today.read')} states={HEAD_STATES} />
                </div>
              </Phone>
            </div>
            <div>
              <Label>Slots left empty (the product today)</Label>
              <Phone>
                <PhoneHomeBar kicker="WENDO RMS · NYERI TOWN" onMenu={press('menu')} name="Brian Otieno" greeting="Good morning, Brian" subtitle="Sunday 4 October · Nyeri Town" />
              </Phone>
            </div>
          </div>
        </Section>

        <Section id="hr" title="HR blocks" node="PME-0 / PNM-0 / POH-0 / SVM-0" note="Section line: 36 px, ink rule, 15 px title. Rows are 60 px; the square is 8 px.">
          <div>
            <Label>KPI strip (the kit&apos;s, with HR&apos;s cells)</Label>
            <WorkforceKpiStrip cells={[...HR_KPIS.cells]} aria-label="The numbers" />
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
            <div>
              <Label>Needs your attention</Label>
              <AttentionList items={HR_ATTENTION.items} viewAll={HR_ATTENTION.viewAll} />
              <Label>The same, without a button (the person may not act)</Label>
              <AttentionList items={HR_ATTENTION.items.slice(0, 2).map((i) => ({ ...i, action: undefined }))} />
            </div>
            <div>
              <Label>People by branch</Label>
              <PeopleByBranch rows={HR_PEOPLE.rows} note={HR_PEOPLE.note} />
              <Label>Section line variants</Label>
              <div className="flex flex-col gap-3">
                <SectionHeader title="With a link" link={{ label: 'View all 11', onClick: press('view all') }} />
                <SectionHeader title="With a count" count={4} caption="Morning · 06:00 to 14:00" size="sm" />
                <SectionHeader title="Success count" count={27} countTone="success" caption="By department" size="sm" />
              </div>
            </div>
          </div>
          <div>
            <Label>Coming up</Label>
            <ComingUpSection events={HR_COMING_UP.events} />
          </div>
        </Section>

        <Section id="branch" title="Branch Manager blocks" node="PUM-0 / Q4S-0 / PXC-0" note="The department chips take the kit's FilterChip with a status square. Click a chip to see it chosen (the page's own board filters the lists).">
          <div>
            <Label>Header with LIVE</Label>
            <BranchNowHeader title="Nyeri Town, right now" subtitle="Sunday 4 October, 10:42. The morning shift ends at 14:00." />
          </div>
          <div>
            <Label>KPI strip</Label>
            <WorkforceKpiStrip cells={[...BRANCH_KPIS.cells]} aria-label="The branch right now" />
          </div>
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] [&>*]:min-w-0">
            <div className="flex flex-col gap-5">
              <DepartmentChips chips={BRANCH_BOARD.chips} value="all" onChange={press('chip')} />
              <NeedsALook rows={BRANCH_BOARD.looks} shiftLine={BRANCH_BOARD.shiftLine} />
              <OnTimeByDepartment rows={BRANCH_BOARD.departments} />
            </div>
            <WaitingForYouColumn items={BRANCH_WAITING.items} openAll={BRANCH_WAITING.openAll} />
          </div>
        </Section>

        <Section id="phone" title="Phone blocks" node="QKM-0 / QKK-0 / QHU-0 / QJV-0" note="The clock card is the kit's `ClockCard`; the shift pill is the kit's `TimerChip`. Each phone block is 356 px wide in Paper (390 minus the 16 px gutter).">
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex w-[358px] max-w-full flex-col gap-4">
              <Label>Waiting for you (card)</Label>
              <WaitingForYouCard items={HEAD_WAITING.items} />
              <Label>Job cards slot</Label>
              <JobCardsSlot text={JOB_SLOT.text} />
            </div>
            <div className="flex w-[358px] max-w-full flex-col gap-4">
              <Label>Service team today</Label>
              <ServiceTeamCard {...HEAD_TEAM} />
              <Label>Without the link, nobody late</Label>
              <ServiceTeamCard {...HEAD_TEAM} open={undefined} lateCount={0} notInCount={0} rows={[]} present={10} />
            </div>
            <div className="flex w-[358px] max-w-full flex-col gap-4">
              <Label>This week, staff (overtime waiting, today ringed)</Label>
              <WeekCard {...WEEK_STAFF} />
              <Label>This week, head</Label>
              <WeekCard {...WEEK_HEAD} />
            </div>
          </div>
        </Section>

        <Section id="buttons" title="Home buttons" node="PMO-0 / PXK-0 / QK2-0 / Q5U-0" note="Outlined, brown and red, at the three sizes. Hover, pressed and keyboard focus are built beyond Paper in the kit's style. A disabled button here would only show while a request is running; a button a person may not use is never drawn.">
          <div className="flex flex-wrap items-center gap-3 bg-wds-surface p-5">
            <HomeButton size="row" onClick={press('row outlined')}>Review</HomeButton>
            <HomeButton size="compact" onClick={press('compact outlined')}>Clock in for her</HomeButton>
            <HomeButton size="compact" kind="primary" onClick={press('compact primary')}>Approve</HomeButton>
            <HomeButton size="compact" kind="danger" onClick={press('compact danger')}>Mark absent</HomeButton>
            <HomeButton size="card" kind="primary" onClick={press('card primary')}>Approve</HomeButton>
            <HomeButton size="card" onClick={press('card outlined')}>Decline</HomeButton>
            <HomeButton size="compact" kind="primary" disabled>Saving…</HomeButton>
          </div>
        </Section>

        <Section id="states" title="Page states" node="1Q6R-0" note="The page's own states from the States kit: loading, nothing to show (every registered card is empty or has no data yet, which is what the product shows today), and a card that failed while the others stay.">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <Label>Loading (cards have not answered)</Label>
              <Desktop width={560}>
                <HomeLayout arranged={arrangeHome(visibleCards(HOME_CARDS, 'desktop', caps('employee.write_sensitive')), {})} surface="desktop" heading={<Greeting title="Good morning, Mercy" line="Sunday 4 October." />} />
              </Desktop>
            </div>
            <div>
              <Label>Nothing to show (the product today)</Label>
              <Desktop width={560}>
                <HomeLayout
                  arranged={arrangeHome(visibleCards(HOME_CARDS, 'desktop', caps('employee.write_sensitive')), Object.fromEntries(HOME_CARDS.map((c) => [c.id, { status: 'no-source' } as CardDataState<unknown>])))}
                  surface="desktop"
                  heading={<Greeting title="Good morning, Mercy" line="Sunday 4 October." />}
                />
              </Desktop>
            </div>
            <div>
              <Label>One card failed, the rest stay</Label>
              <Desktop width={560}>
                <RolePage surface="desktop" can={caps('employee.write_sensitive')} states={{ ...HR_STATES, 'workforce.hr-attention': { status: 'error' }, 'workforce.hr-kpis': { status: 'no-source' }, 'workforce.coming-up': { status: 'no-source' } }} heading={<Greeting title="Good morning, Mercy" line="Sunday 4 October." />} />
              </Desktop>
            </div>
            <div className={cn('self-start')}>
              <Label>Phone: nothing to show</Label>
              <Phone>
                <HomeLayout arranged={arrangeHome([], {})} surface="phone" />
              </Phone>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
