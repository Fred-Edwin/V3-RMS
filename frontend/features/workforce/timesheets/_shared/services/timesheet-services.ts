import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type {
  DayDecision,
  Day,
  InboxRequest,
  MyRota,
  MyTime,
  NewRequest,
  Overtime,
  OvertimeDecision,
  OvertimeListItem,
  Period,
  PeriodList,
  PeriodQuery,
  PeriodView,
  PersonPeriod,
  Report,
  Request,
  RequestDecision,
} from '../types/timesheet-types';

/** Every Timesheets endpoint used by the screens (T1 T2 T4 T6, O1 O2, P1 to P4, R1 to R6, M1 M2), one function each. */

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/timesheets';

function query(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params).filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '');
  return pairs.length === 0 ? '' : `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}`;
}

export interface Page<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
}

export const timesheetReads = {
  /** T1: the branch's recent periods. The current one is created on the way. `siteId` is for the company-wide roles. */
  periods: (siteId?: string): Promise<PeriodList> => apiClient.get(`${BASE}/periods${query({ siteId })}`, token()),
  /** T2 */
  period: (id: string, q: PeriodQuery): Promise<PeriodView> =>
    apiClient.get(`${BASE}/periods/${id}${query({ search: q.search, departmentId: q.departmentId, filter: q.filter, from: q.from, to: q.to, page: q.page, pageSize: q.pageSize })}`, token()),
  /** T4 */
  person: (periodId: string, employeeId: string): Promise<PersonPeriod> => apiClient.get(`${BASE}/periods/${periodId}/people/${employeeId}`, token()),
  /** O1 */
  overtime: (status: 'PENDING' | 'DECIDED' | 'ALL', siteId?: string, periodId?: string): Promise<Page<OvertimeListItem>> =>
    apiClient.get(`${BASE}/overtime${query({ status, siteId, periodId, pageSize: 100 })}`, token()),
  /** P1 */
  report: (periodId: string): Promise<Report> => apiClient.get(`${BASE}/periods/${periodId}/report`, token()),
  /** R1 */
  inbox: (state: 'WAITING' | 'ANSWERED' | 'ALL', search: string | undefined, page: number, pageSize: number, siteId?: string): Promise<Page<InboxRequest> & { canAct: boolean }> =>
    apiClient.get(`${BASE}/requests${query({ state, search, page, pageSize, siteId })}`, token()),
  /** R4 */
  myRequests: (): Promise<{ requests: Request[] }> => apiClient.get(`${BASE}/me/requests`, token()),
  /** M1 */
  myTime: (periodId?: string): Promise<MyTime> => apiClient.get(`${BASE}/me/time${query({ periodId })}`, token()),
  /** M2 */
  myRota: (): Promise<MyRota> => apiClient.get(`${BASE}/me/rota`, token()),
};

export const timesheetWrites = {
  /** T6 */
  decideDay: (dayId: string, body: DayDecision): Promise<Day> => apiClient.post(`${BASE}/days/${dayId}/decision`, body, token()),
  /** O2 */
  decideOvertime: (itemId: string, body: OvertimeDecision): Promise<Overtime> => apiClient.post(`${BASE}/overtime/${itemId}/decision`, body, token()),
  /** P2 */
  sign: (periodId: string, pin: string): Promise<Period> => apiClient.post(`${BASE}/periods/${periodId}/sign`, { pin }, token()),
  /** P3 */
  close: (periodId: string, confirmCarry: boolean): Promise<Period> => apiClient.post(`${BASE}/periods/${periodId}/close`, { confirmCarry }, token()),
  /** P4 */
  reopen: (periodId: string, reason: string): Promise<Period> => apiClient.post(`${BASE}/periods/${periodId}/reopen`, { reason }, token()),
  /** R2 */
  decideRequest: (id: string, body: RequestDecision): Promise<Request> => apiClient.post(`${BASE}/requests/${id}/decision`, body, token()),
  /** R5 */
  createRequest: (body: NewRequest): Promise<Request> => apiClient.post(`${BASE}/me/requests`, body, token()),
  /** R6 */
  withdrawRequest: (id: string): Promise<Request> => apiClient.post(`${BASE}/me/requests/${id}/withdraw`, {}, token()),
};
