import * as React from 'react';

import { WorkforceKpiStrip } from '../../_shared';
import { PeopleByBranch } from '../components/people-by-branch';
import { defineHomeCard } from '../lib/card-registry';
import type { KpiData, PeopleData } from './hr-cards';
import { noSource } from './no-source';
import { useCompanyHeadcount } from './people-data';

/**
 * The Accountant's and the Director's Homes. Paper draws only the HR and Branch Manager Homes; these two are described by the
 * reference table "What each role's Home shows" and are built from the same blocks, so they look like their neighbours. The pay run steps,
 * rule confirmations and overdue approvals are now rows of the Needs you and Overdue cards (`needs-you-cards.tsx`, Segment 6a).
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
