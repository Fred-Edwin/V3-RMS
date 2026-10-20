'use client';

import { useEffect, useRef } from 'react';

import { useRemote, type Remote } from '../../../_shared';
import { payrollReads, type PayslipsQuery } from '../services/payroll-reads';
import type { CorrectionInputs, PayoutView, ReviewList, ReviewQuery } from '../types/action-types';
import type { MonthList, MonthView } from '../types/month-types';
import type { CasualView, EstimateView, PayslipDetail, PayslipList, RulesApplied, TaxView, TotalsView } from '../types/tab-types';

/** One hook per Payroll read. `refresh` changes after an act: the old answer stays on screen while the new one loads (no flash). */

function reloadOn<T>(remote: Remote<T>, token: number): Remote<T> {
  const seen = useRef(token);
  const reload = remote.reload;
  useEffect(() => {
    if (token === seen.current) return;
    seen.current = token;
    reload();
  }, [token, reload]);
  return remote;
}

export const useMonthList = (page: number, refresh: number, enabled: boolean): Remote<MonthList> =>
  reloadOn(useRemote(() => payrollReads.list(page), `months:${page}`, enabled), refresh);

export const useMonthView = (monthKey: string | null, refresh: number, enabled: boolean): Remote<MonthView> =>
  reloadOn(useRemote(() => payrollReads.month(monthKey ?? ''), `month:${monthKey}`, enabled && monthKey !== null), refresh);

export const useRulesApplied = (monthKey: string, refresh: number): Remote<RulesApplied> => reloadOn(useRemote(() => payrollReads.rules(monthKey), `rules:${monthKey}`), refresh);
export const useTax = (monthKey: string, refresh: number): Remote<TaxView> => reloadOn(useRemote(() => payrollReads.tax(monthKey), `tax:${monthKey}`), refresh);
export const useCasual = (monthKey: string, refresh: number): Remote<CasualView> => reloadOn(useRemote(() => payrollReads.casual(monthKey), `casual:${monthKey}`), refresh);
export const useTotals = (monthKey: string, refresh: number): Remote<TotalsView> => reloadOn(useRemote(() => payrollReads.totals(monthKey), `totals:${monthKey}`), refresh);
export const usePayout = (monthKey: string, refresh: number, enabled: boolean): Remote<PayoutView> =>
  reloadOn(useRemote(() => payrollReads.payout(monthKey), `payout:${monthKey}`, enabled), refresh);
export const useEstimate = (monthKey: string, enabled: boolean): Remote<EstimateView> => useRemote(() => payrollReads.estimate(monthKey), `estimate:${monthKey}`, enabled);

export const usePayslipList = (monthKey: string, q: PayslipsQuery, refresh: number): Remote<PayslipList> =>
  reloadOn(useRemote(() => payrollReads.payslips(monthKey, q), `payslips:${monthKey}:${q.q ?? ''}:${q.siteId ?? ''}:${q.status ?? ''}:${q.page}:${q.rows}`), refresh);

export const useReview = (monthKey: string, q: ReviewQuery, refresh: number): Remote<ReviewList> =>
  reloadOn(useRemote(() => payrollReads.review(monthKey, q), `review:${monthKey}:${q.kind ?? ''}:${q.state ?? ''}:${q.severity ?? ''}:${q.q ?? ''}:${q.page}:${q.rows}`), refresh);

export const usePayslipDetail = (monthKey: string, payslipId: string | null): Remote<PayslipDetail> =>
  useRemote(() => payrollReads.payslip(monthKey, payslipId ?? ''), `payslip:${monthKey}:${payslipId}`, payslipId !== null);

export const useCorrectionInputs = (monthKey: string, payslipId: string, version: number): Remote<CorrectionInputs> =>
  useRemote(() => payrollReads.correctionInputs(monthKey, payslipId, version), `correction:${monthKey}:${payslipId}:${version}`);
