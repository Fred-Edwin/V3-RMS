import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type { InboxRequest, MyRota, MyTime, NewRequest, OvertimeListItem, Request, RequestDecision } from '../types/timesheet-types';
import { query } from './month-services';

/**
 * The Timesheets endpoints that are not about months: the overtime list (O1), the requests inbox and answers (R1 to R6) and My time
 * (M1, M2), one function each. The months, a person's month, the overtime decision, approving and exports are in `month-services.ts`.
 */

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/timesheets';

export interface Page<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
}

export const timesheetReads = {
  /** O1 */
  overtime: (status: 'PENDING' | 'DECIDED' | 'ALL', siteId?: string, periodId?: string): Promise<Page<OvertimeListItem>> =>
    apiClient.get(`${BASE}/overtime${query({ status, siteId, periodId, pageSize: 100 })}`, token()),
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
  /** R2 */
  decideRequest: (id: string, body: RequestDecision): Promise<Request> => apiClient.post(`${BASE}/requests/${id}/decision`, body, token()),
  /** R5 */
  createRequest: (body: NewRequest): Promise<Request> => apiClient.post(`${BASE}/me/requests`, body, token()),
  /** R6 */
  withdrawRequest: (id: string): Promise<Request> => apiClient.post(`${BASE}/me/requests/${id}/withdraw`, {}, token()),
};
