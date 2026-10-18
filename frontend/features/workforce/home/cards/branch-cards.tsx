'use client';

import * as React from 'react';

import { WorkforceKpiStrip } from '../../_shared';
import type { Board } from '../../attendance';
import { DepartmentChips, NeedsALook, OnTimeByDepartment, type DepartmentChip, type DepartmentLine, type LookRow } from '../components/branch-board';
import { LiveBoard } from '../components/live-board';
import { WaitingForYouColumn, type WaitingItem } from '../components/waiting-for-you';
import { defineHomeCard } from '../lib/card-registry';
import { useBoardCardData, useBranchKpis, useWaitingCardData } from './attendance-data';
import type { KpiData } from './hr-cards';

/**
 * The Branch Manager's and Store Manager's Home, "the branch right now" (Paper step 03): the strip, the board (department chips,
 * "Needs a look", "On time and working") and "Waiting for you". The Store Manager sees the same cards for the Central Store: it is the
 * same capability. Data: slice 3 (Attendance) for the strip and the board, slice 4 for Waiting for you.
 */

export interface BoardData {
  chips: readonly DepartmentChip[];
  looks: readonly LookRow[];
  departments: readonly DepartmentLine[];
  /** "Morning · 06:00 to 14:00 · 31 rostered". */
  shiftLine?: string;
}

/** The board card's data: the live board (the real page) or Paper's example (the gallery). */
export type BoardSlot = { fixture: BoardData } | { live: { board: Board; reload: () => void } };

function BoardCard({ data }: { data: BoardData }) {
  const [department, setDepartment] = React.useState('all');
  // A chip filters both lists to one department; a person's role line ends with their department ("Steward · Service").
  const chosen = data.chips.find((c) => c.key === department);
  const looks = department === 'all' || !chosen ? data.looks : data.looks.filter((l) => l.role.endsWith(chosen.label));
  const departments = department === 'all' || !chosen ? data.departments : data.departments.filter((d) => d.name === chosen.label);
  return (
    <div className="flex flex-col gap-5">
      <DepartmentChips chips={data.chips} value={department} onChange={setDepartment} />
      <NeedsALook rows={looks} shiftLine={data.shiftLine} />
      <OnTimeByDepartment rows={departments} />
    </div>
  );
}

export const branchKpisCard = defineHomeCard<KpiData>({
  id: 'workforce.branch-kpis',
  title: 'The numbers',
  surfaces: ['desktop'],
  slot: 'kpi',
  anyCapability: ['today.act'],
  order: 10,
  isEmpty: (d) => d.cells.length === 0,
  useData: useBranchKpis,
  Card: ({ data }) => <WorkforceKpiStrip aria-label="The branch right now" cells={[...data.cells]} />,
});

export const todayBoardCard = defineHomeCard<BoardSlot>({
  id: 'workforce.today-board',
  title: 'Today board',
  surfaces: ['desktop'],
  slot: 'main',
  anyCapability: ['today.act'],
  order: 20,
  isEmpty: (d) => ('live' in d ? d.live.board.people.length === 0 : d.fixture.looks.length === 0 && d.fixture.departments.length === 0),
  useData: useBoardCardData,
  Card: ({ data }) => ('live' in data ? <LiveBoard board={data.live.board} reload={data.live.reload} /> : <BoardCard data={data.fixture} />),
});

export interface WaitingData {
  items: readonly WaitingItem[];
  openAll?: { label: string; onClick: () => void };
}

export const waitingDesktopCard = defineHomeCard<WaitingData>({
  id: 'workforce.waiting-for-you.desktop',
  title: 'Waiting for you',
  surfaces: ['desktop'],
  slot: 'side',
  sideWidth: 360,
  anyCapability: ['today.act'],
  order: 30,
  isEmpty: (d) => d.items.length === 0,
  useData: useWaitingCardData,
  Card: ({ data }) => <WaitingForYouColumn items={data.items} openAll={data.openAll} />,
});
