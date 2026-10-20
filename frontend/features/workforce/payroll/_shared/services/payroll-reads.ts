import { apiClient as rawClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import { fromWire } from '../lib/wire';

import type { PayoutView, ReviewList, ReviewQuery, CorrectionInputs } from '../types/action-types';
import type { MonthList, MonthView } from '../types/month-types';
import type { CasualView, EstimateView, PayslipDetail, PayslipList, RulesApplied, TaxView, TotalsView } from '../types/tab-types';

/** Every Payroll read (API_CONTRACT §40 P1 to P10, §41 P23 and P26), one function each. */

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
/** The read client: the wire's "organization" words become "site" before any screen sees them. */
const apiClient = { get: async <T>(url: string, accessToken?: string): Promise<T> => fromWire<T>(await rawClient.get<unknown>(url, accessToken)) };
export const BASE = '/workforce/payroll';

export function query(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params).filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '');
  return pairs.length === 0 ? '' : `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}`;
}

export interface PayslipsQuery {
  q?: string;
  siteId?: string;
  status?: 'all' | 'corrected';
  page: number;
  rows: number;
}

export const payrollReads = {
  /** P1: the months, newest first, 5 a page. */
  list: (page: number, rows = 5): Promise<MonthList> => apiClient.get(`${BASE}/months${query({ page, rows })}`, token()),
  /** P2 */
  month: (monthKey: string): Promise<MonthView> => apiClient.get(`${BASE}/months/${monthKey}`, token()),
  /** P3 */
  rules: (monthKey: string): Promise<RulesApplied> => apiClient.get(`${BASE}/months/${monthKey}/rules-applied`, token()),
  /** P4 */
  tax: (monthKey: string): Promise<TaxView> => apiClient.get(`${BASE}/months/${monthKey}/tax`, token()),
  /** P5 */
  casual: (monthKey: string): Promise<CasualView> => apiClient.get(`${BASE}/months/${monthKey}/casual`, token()),
  /** P6 */
  totals: (monthKey: string): Promise<TotalsView> => apiClient.get(`${BASE}/months/${monthKey}/totals`, token()),
  /** P7 */
  payslips: (monthKey: string, q: PayslipsQuery): Promise<PayslipList> =>
    apiClient.get(`${BASE}/months/${monthKey}/payslips${query({ q: q.q, siteId: q.siteId, status: q.status === 'corrected' ? 'corrected' : undefined, page: q.page, rows: q.rows })}`, token()),
  /** P8 */
  payslip: (monthKey: string, payslipId: string): Promise<PayslipDetail> => apiClient.get(`${BASE}/months/${monthKey}/payslips/${payslipId}`, token()),
  /** P9 */
  estimate: (monthKey: string): Promise<EstimateView> => apiClient.get(`${BASE}/months/${monthKey}/estimate`, token()),
  /** P10 */
  review: (monthKey: string, q: ReviewQuery): Promise<ReviewList> =>
    apiClient.get(`${BASE}/months/${monthKey}/review${query({ kind: q.kind, state: q.state, severity: q.severity, q: q.q, page: q.page, rows: q.rows })}`, token()),
  /** P26 */
  payout: (monthKey: string): Promise<PayoutView> => apiClient.get(`${BASE}/months/${monthKey}/payout`, token()),
  /** The figures of one site's timesheet month, which the Director's late approval must send back (the 1A MO2 read; only the totals are used). */
  siteTimesheetTotals: async (monthKey: string, siteId: string): Promise<{ workedMinutes: number; overtimeAuthorisedMinutes: number; headcount: number }> => {
    const m = await apiClient.get<{ kpis: { workedMinutes: number; headcount: number; overtime: { approvedMinutes: number } } }>(`/workforce/timesheets/months/${monthKey}${query({ site: siteId })}`, token());
    return { workedMinutes: m.kpis.workedMinutes, overtimeAuthorisedMinutes: m.kpis.overtime.approvedMinutes, headcount: m.kpis.headcount };
  },
  /** P23 */
  correctionInputs: (monthKey: string, payslipId: string, version: number): Promise<CorrectionInputs> =>
    apiClient.get(`${BASE}/months/${monthKey}/payslips/${payslipId}/correction-inputs${query({ version })}`, token()),
};
