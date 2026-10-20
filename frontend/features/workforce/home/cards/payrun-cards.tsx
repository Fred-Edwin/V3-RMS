import * as React from 'react';

import { WorkforceKpiStrip } from '../../_shared';
import { AttentionList } from '../components/attention-list';
import { PeopleByBranch } from '../components/people-by-branch';
import { defineHomeCard } from '../lib/card-registry';
import type { AttentionData, KpiData, PeopleData } from './hr-cards';
import { noSource } from './no-source';
import { useCompanyHeadcount } from './people-data';

/**
 * The Accountant's and the Director's Homes. Paper draws only the HR and Branch Manager Homes; these two are described by the
 * reference table "What each role's Home shows" (Accountant: pay run steps waiting, rule confirmations; Director: overdue approvals,
 * company headcount, pay run status) and are built from the same blocks, so they look like their neighbours. The owner reviews them
 * against the table, not against a drawing.
 *
 * What sets each role apart is one capability: the Accountant approves pay runs, the Director can reopen one.
 */

export const payRunKpisCard = defineHomeCard<KpiData>({
  id: 'workforce.payrun-kpis',
  title: 'The pay run',
  surfaces: ['desktop'],
  slot: 'kpi',
  anyCapability: ['payroll.approve', 'payroll.approve_site_late'],
  order: 10,
  isEmpty: (d) => d.cells.length === 0,
  useData: noSource<KpiData>(),
  Card: ({ data }) => <WorkforceKpiStrip aria-label="The pay run" cells={[...data.cells]} />,
});

export const payRunStepsCard = defineHomeCard<AttentionData>({
  id: 'workforce.payrun-steps',
  title: 'Pay run steps and rule confirmations',
  surfaces: ['desktop'],
  slot: 'main',
  anyCapability: ['payroll.approve'],
  order: 20,
  isEmpty: (d) => d.items.length === 0,
  useData: noSource<AttentionData>(),
  Card: ({ data }) => <AttentionList title="Waiting on you" items={data.items} viewAll={data.viewAll} />,
});

export const overdueApprovalsCard = defineHomeCard<AttentionData>({
  id: 'workforce.overdue-approvals',
  title: 'Overdue approvals',
  surfaces: ['desktop'],
  slot: 'main',
  anyCapability: ['payroll.approve_site_late'],
  order: 20,
  isEmpty: (d) => d.items.length === 0,
  useData: noSource<AttentionData>(),
  Card: ({ data }) => <AttentionList title="Overdue approvals" items={data.items} viewAll={data.viewAll} />,
});

export const companyHeadcountCard = defineHomeCard<PeopleData>({
  id: 'workforce.company-headcount',
  title: 'Company headcount',
  surfaces: ['desktop'],
  slot: 'side',
  anyCapability: ['payroll.approve_site_late'],
  order: 30,
  isEmpty: (d) => d.rows.length === 0,
  useData: useCompanyHeadcount,
  Card: ({ data }) => <PeopleByBranch rows={data.rows} note={data.note} />,
});
