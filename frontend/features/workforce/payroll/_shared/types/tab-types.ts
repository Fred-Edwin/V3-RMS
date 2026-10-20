/** The Payroll tabs' answers (API_CONTRACT §40, P3 to P9 and §41, P26). Money is text with two decimals. */

import type { MonthState } from './month-types';

export interface RuleCard {
  ruleKey: 'OVERTIME' | 'LATENESS' | 'ABSENCE' | 'LEAVE' | 'HOLIDAYS';
  version: number;
  effectiveFrom: string | null;
  rows: { key: string; label: string; value: string }[];
  figures: Record<string, number | string>;
  largest: { name: string; text: string } | null;
}

export interface RulesApplied {
  monthKey: string;
  state: MonthState;
  cards: RuleCard[];
}

export interface TaxBand {
  from: string | null;
  to: string | null;
  ratePercent: string | null;
  flatAmount: string | null;
}

export interface TaxTable {
  code: string;
  name: string;
  kind: 'BANDS' | 'RATE' | 'OTHER';
  base: string;
  reducesTaxable: boolean;
  isIncomeTax: boolean;
  bands: TaxBand[];
  reliefMonthly: string | null;
  employerRatePercent: string | null;
  employeeShare: { people: number; amount: string };
  employerShare: { people: number; amount: string } | null;
  example: { employeeId: string; name: string; text: string } | null;
  notUsed: boolean;
}

export interface TaxView {
  monthKey: string;
  tablesVersionLabel: string | null;
  confirmedBy: { name: string; role: string } | null;
  confirmedAt: string | null;
  totalTakenOff: string;
  employerContributions: string;
  tables: TaxTable[];
}

export interface CasualView {
  monthKey: string;
  state: MonthState;
  source: 'SHEETS' | 'NONE';
  days: number;
  workers: number;
  paidTotal: string;
  inMonthlyRun: boolean;
  byDepartment: { siteId: string; siteName: string; departmentId: string; departmentName: string; days: number; workers: number; total: string }[];
  latestSheets: { id: string; number: string | null; date: string; siteName: string; departmentName: string; total: string; workers: number }[];
  waiting: { id: string; siteId: string; departmentId: string; date: string; status: string }[];
  message: string | null;
}

export interface TotalsRow {
  people: number;
  basic: string;
  gross: string;
  taxStatutory: string;
  other: string;
  net: string;
  employerShare: string;
}

export interface TotalsView {
  monthKey: string;
  state: MonthState;
  runNumber: number;
  bySite: (TotalsRow & { siteId: string; name: string })[];
  total: TotalsRow;
  employerContributions: string | null;
  casual: string;
  totalCost: string;
}

export interface PayslipRow {
  payslipId: string;
  employeeId: string;
  name: string;
  siteId: string;
  siteName: string;
  department: string | null;
  net: string;
  version: number;
  status: 'READY' | 'PUBLISHED';
  documentNumber: string | null;
  corrected: boolean;
  leftOut: false;
}

export interface LeftOutRow {
  employeeId: string;
  name: string;
  siteId: string;
  siteName: string;
  leftOut: true;
  status: string;
  net: null;
}

export interface PayslipList {
  monthKey: string;
  state: MonthState;
  locked: boolean;
  rows: PayslipRow[];
  leftOut: LeftOutRow[];
  counts: { all: number; corrected: number; leftOut: number };
  page: number;
  pageSize: number;
  total: number;
}

export interface PayslipLine {
  code: string;
  label: string;
  kind: string;
  amount: string;
  taxable: boolean;
  base: string | null;
  baseAmount: string | null;
  rate: string | null;
  quantity: string | null;
  unit: string | null;
  source: unknown;
  workingText: string;
  share: 'EMPLOYEE' | 'EMPLOYER' | null;
}

export interface PayslipDetail {
  payslipId: string;
  monthKey: string;
  state: MonthState;
  version: number;
  replacesVersion: number | null;
  replacedBy: number | null;
  versions: { payslipId: string; version: number; createdAt: string; reason: string | null; correctedAt: string | null }[];
  status: 'READY' | 'PUBLISHED';
  documentNumber: string | null;
  published: boolean;
  employee: { employeeId: string; name: string; employeeNumber: string | null; department: string | null; siteName: string; payoutMethod: string };
  totals: { basic: string; gross: string; statutory: string; incomeTax: string; otherDeductions: string; net: string; employerShare: string; taxablePay: string };
  lines: PayslipLine[];
}

export interface EstimateSite {
  siteId: string;
  people: number;
  earned: string;
  expected: string;
  vsLast: string | null;
}

export interface StoredEstimate {
  expectedGross: string;
  earnedSoFar: string;
  vsLastMonth: { amount: string; percent: string } | null;
  bySite: EstimateSite[];
  toDecideOvertime: { minutes: number; value: string };
  missingProfiles: number;
  notEstimated: number;
  asOf: string;
  dayOfMonth: number;
  daysInMonth: number;
  sites: { siteId: string; name: string; onNewSystem: boolean }[];
}

export type EstimateView = { monthKey: string; ready: false; computedAt: null; estimate: null } | { monthKey: string; ready: true; computedAt: string; estimate: StoredEstimate };
