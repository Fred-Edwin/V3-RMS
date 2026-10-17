import * as React from 'react';

import { WorkforceKpiStrip, type ComingUpEvent, type WorkforceKpiCell } from '../../_shared';
import { AttentionList, type AttentionItem } from '../components/attention-list';
import { ComingUpSection } from '../components/coming-up-section';
import { PeopleByBranch, type BranchCount } from '../components/people-by-branch';
import { defineHomeCard } from '../lib/card-registry';
import { useComingUpData, useHrAttention, useHrKpis, usePeopleByBranchData } from './people-data';

/**
 * The HR Manager's Home (Paper Chapter 1 step 02): the strip, "Needs your attention", "People by branch" and "Coming up".
 * Seen by whoever holds the HR capabilities named on each card; no role name appears here. Data: slice 1a (People), 1b (heads),
 * 4 (approvals), 5 (leave), 6 (pay run). Until then each card leaves the page.
 */

export interface KpiData {
  cells: readonly WorkforceKpiCell[];
}
export interface AttentionData {
  items: readonly AttentionItem[];
  viewAll?: { label: string; onClick: () => void };
}
export interface PeopleData {
  rows: readonly BranchCount[];
  note?: string;
}
export interface ComingUpData {
  events: readonly ComingUpEvent[];
}

export const hrKpisCard = defineHomeCard<KpiData>({
  id: 'workforce.hr-kpis',
  title: 'The numbers',
  surfaces: ['desktop'],
  slot: 'kpi',
  anyCapability: ['employee.write_sensitive'],
  order: 10,
  isEmpty: (d) => d.cells.length === 0,
  useData: useHrKpis,
  Card: ({ data }) => <WorkforceKpiStrip aria-label="The numbers" cells={[...data.cells]} />,
});

export const hrAttentionCard = defineHomeCard<AttentionData>({
  id: 'workforce.hr-attention',
  title: 'Needs your attention',
  surfaces: ['desktop'],
  slot: 'main',
  anyCapability: ['employee.write_sensitive'],
  order: 20,
  isEmpty: (d) => d.items.length === 0,
  useData: useHrAttention,
  Card: ({ data }) => <AttentionList items={data.items} viewAll={data.viewAll} />,
});

export const peopleByBranchCard = defineHomeCard<PeopleData>({
  id: 'workforce.people-by-branch',
  title: 'People by branch',
  surfaces: ['desktop'],
  slot: 'side',
  anyCapability: ['employee.write_sensitive'],
  order: 30,
  isEmpty: (d) => d.rows.length === 0,
  useData: usePeopleByBranchData,
  Card: ({ data }) => <PeopleByBranch rows={data.rows} note={data.note} />,
});

/** Also the Accountant's and the Director's "coming up" (pay run steps, payday): one card, seen by every role that holds one of these. */
export const comingUpCard = defineHomeCard<ComingUpData>({
  id: 'workforce.coming-up',
  title: 'Coming up',
  surfaces: ['desktop'],
  slot: 'wide',
  anyCapability: ['employee.write_sensitive', 'payrun.approve', 'payrun.reopen'],
  order: 90,
  isEmpty: (d) => d.events.length === 0,
  useData: useComingUpData,
  Card: ({ data }) => <ComingUpSection events={data.events} />,
});
