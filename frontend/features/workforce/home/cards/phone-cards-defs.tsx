'use client';

import * as React from 'react';

import { ClockCard } from '../../_shared';
import { JobCardsSlot, ServiceTeamCard, WeekCard } from '../components/phone-cards';
import { WaitingForYouCard } from '../components/waiting-for-you';
import { defineHomeCard } from '../lib/card-registry';
import type { WaitingData } from './branch-cards';
import { noSource } from './no-source';

/**
 * The phone Home cards (Paper step 05), in the order the stack draws them: 01 the shift (the clock card), 02 Waiting for you,
 * 03 the job's cards (a dashed slot until the Orders redo), 04 the team, 05 this week. Staff see 01, 03 and 05; a department head all five;
 * a manager "the branch right now" in place of 01 and 05 (that is the desktop board, on a phone: slice 3).
 */

export type ClockCardData = Parameters<typeof ClockCard>[0];
export type TeamCardData = Parameters<typeof ServiceTeamCard>[0];
export type WeekCardData = Parameters<typeof WeekCard>[0];

export const clockCard = defineHomeCard<ClockCardData>({
  id: 'workforce.clock',
  title: 'Your shift',
  surfaces: ['phone'],
  slot: 'main',
  anyCapability: ['time.own'],
  order: 10,
  isEmpty: () => false,
  useData: noSource<ClockCardData>(),
  Card: ({ data }) => <ClockCard {...data} />,
});

export const waitingPhoneCard = defineHomeCard<WaitingData>({
  id: 'workforce.waiting-for-you.phone',
  title: 'Waiting for you',
  surfaces: ['phone'],
  slot: 'main',
  anyCapability: ['overtime.approve', 'casual.record'],
  order: 20,
  isEmpty: (d) => d.items.length === 0,
  useData: noSource<WaitingData>(),
  Card: ({ data }) => <WaitingForYouCard items={data.items} />,
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

export const teamTodayCard = defineHomeCard<TeamCardData>({
  id: 'workforce.team-today',
  title: 'Your team today',
  surfaces: ['phone'],
  slot: 'main',
  anyCapability: ['today.read'],
  order: 40,
  isEmpty: (d) => d.rows.length === 0 && d.lateCount === 0 && d.notInCount === 0,
  useData: noSource<TeamCardData>(),
  Card: ({ data }) => <ServiceTeamCard {...data} />,
});

export const weekCard = defineHomeCard<WeekCardData>({
  id: 'workforce.this-week',
  title: 'This week',
  surfaces: ['phone'],
  slot: 'main',
  anyCapability: ['time.own'],
  order: 50,
  isEmpty: (d) => d.bars.length === 0,
  useData: noSource<WeekCardData>(),
  Card: ({ data }) => <WeekCard {...data} />,
});
