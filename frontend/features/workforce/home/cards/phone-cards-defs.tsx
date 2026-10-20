'use client';

import * as React from 'react';

import { ClockCard } from '../../_shared';
import { ClockHomeCard, type Board, type MyDay } from '../../attendance';
import { LiveTeamCard } from '../components/live-team-card';
import { JobCardsSlot, ServiceTeamCard, WeekCard } from '../components/phone-cards';
import { defineHomeCard } from '../lib/card-registry';
import { useClockCardData, useTeamCardData, useWeekCardData } from './attendance-data';
import { noSource } from './no-source';

/**
 * The phone Home cards (Paper step 05), in the order the stack draws them: 01 the shift (the clock card), 02 Needs you (registered in
 * `needs-you-cards.tsx`; the department head's old "Waiting for you" card is deleted, heads approve nothing), 03 the job's cards (a dashed slot until the Orders redo), 04 the team, 05 this week. Staff see 01, 03 and 05; a department head all five;
 * a manager "the branch right now" in place of 01 and 05 (that is the desktop board, on a phone: slice 3).
 */

export type ClockCardData = Parameters<typeof ClockCard>[0];
export type TeamCardData = Parameters<typeof ServiceTeamCard>[0];
export type WeekCardData = Parameters<typeof WeekCard>[0];

/** The clock card's data: the live "my day" (the real page) or Paper's example props (the gallery). */
export type ClockSlot = { fixture: ClockCardData } | { live: { day: MyDay; reload: () => void } };
export type TeamSlot = { fixture: TeamCardData } | { live: { board: Board; reload: () => void } };

export const clockCard = defineHomeCard<ClockSlot>({
  id: 'workforce.clock',
  title: 'Your shift',
  surfaces: ['phone'],
  slot: 'main',
  anyCapability: ['time.own'],
  order: 10,
  // Past the end of the day's shifts with nothing to say, the card leaves; a shift the phone closed still shows its notice.
  isEmpty: (d) => ('live' in d ? !d.live.day.current && d.live.day.notices.length === 0 : false),
  // A shift that is about to end or has ended rises above the other cards.
  urgency: (d) => ('live' in d && d.live.day.current?.state === 'PROMPT_DUE' ? 1 : 10),
  useData: useClockCardData,
  Card: ({ data }) => ('live' in data ? <ClockHomeCard day={data.live.day} reload={data.live.reload} /> : <ClockCard {...data.fixture} />),
});

/** Always ready: the slot is a note, not data. It stays off the page until a person who has a job to show holds `time.own` AND the Orders redo exists. */
export const jobCardsCard = defineHomeCard<{ text?: string }>({
  id: 'workforce.job-cards-slot',
  title: 'Job cards',
  surfaces: ['phone'],
  slot: 'main',
  anyCapability: ['time.own'],
  order: 30,
  isEmpty: () => false,
  // No source: the Orders redo registers the real job cards and removes this slot. Shown in the dev gallery from fixtures.
  useData: noSource<{ text?: string }>(),
  Card: ({ data }) => <JobCardsSlot text={data.text} />,
});

export const teamTodayCard = defineHomeCard<TeamSlot>({
  id: 'workforce.team-today',
  title: 'Your team today',
  surfaces: ['phone'],
  slot: 'main',
  anyCapability: ['today.read'],
  order: 40,
  isEmpty: (d) => ('live' in d ? d.live.board.people.length === 0 : d.fixture.rows.length === 0 && d.fixture.lateCount === 0 && d.fixture.notInCount === 0),
  useData: useTeamCardData,
  Card: ({ data }) => ('live' in data ? <LiveTeamCard board={data.live.board} reload={data.live.reload} /> : <ServiceTeamCard {...data.fixture} />),
});

export const weekCard = defineHomeCard<WeekCardData>({
  id: 'workforce.this-week',
  title: 'This week',
  surfaces: ['phone'],
  slot: 'main',
  anyCapability: ['time.own'],
  order: 50,
  isEmpty: (d) => d.bars.length === 0,
  useData: useWeekCardData,
  Card: ({ data }) => <WeekCard {...data} />,
});
