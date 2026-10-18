import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type {
  Board,
  ClockForBody,
  ClockOutBody,
  ClockResult,
  DayHistory,
  FixBody,
  FixResult,
  FixView,
  LatenessReport,
  MyDay,
  StayOnBody,
  SwitchView,
  TapBody,
} from '../types/attendance-types';

/** Every Attendance endpoint (C1 to C5, B1 B2, F1 to F3, L1, S1 to S3), one function each. Screens never build a path. */

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/attendance';

function query(params: Record<string, string | boolean | undefined>): string {
  const pairs = Object.entries(params).filter((entry): entry is [string, string | boolean] => entry[1] !== undefined && entry[1] !== '');
  return pairs.length === 0 ? '' : `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}`;
}

export const attendanceReads = {
  /** C1 */
  me: (): Promise<MyDay> => apiClient.get(`${BASE}/me`, token()),
  /** B1 */
  board: (date?: string, siteId?: string): Promise<Board> => apiClient.get(`${BASE}/board${query({ date, siteId })}`, token()),
  /** F1 */
  day: (employeeId: string, date: string): Promise<DayHistory> => apiClient.get(`${BASE}/day${query({ employeeId, date })}`, token()),
  /** L1 */
  lateness: (from: string, to: string, employeeId?: string, siteId?: string): Promise<LatenessReport> =>
    apiClient.get(`${BASE}/lateness${query({ from, to, employeeId, siteId, includeOnTime: undefined })}`, token()),
  /** S1 */
  switchOf: (siteId?: string): Promise<SwitchView> => apiClient.get(`${BASE}/switch${query({ siteId })}`, token()),
  /** S3 */
  switches: async (): Promise<SwitchView[]> => (await apiClient.get<{ sites: SwitchView[] }>(`${BASE}/switch/sites`, token())).sites,
};

export const attendanceWrites = {
  /** C2 */
  clockIn: (body: TapBody): Promise<ClockResult> => apiClient.post(`${BASE}/clock-in`, body, token()),
  /** C3 */
  clockOut: (body: ClockOutBody): Promise<ClockResult> => apiClient.post(`${BASE}/clock-out`, body, token()),
  /** C4 */
  undo: (clientEventId: string): Promise<unknown> => apiClient.post(`${BASE}/undo`, { clientEventId }, token()),
  /** C5 */
  stayOn: (body: StayOnBody): Promise<unknown> => apiClient.post(`${BASE}/shift-end`, body, token()),
  /** B2 */
  clockFor: (body: ClockForBody): Promise<unknown> => apiClient.post(`${BASE}/clock-for`, body, token()),
  /** F2 */
  previewFix: (body: FixBody): Promise<FixView> => apiClient.post(`${BASE}/fixes/preview`, body, token()),
  /** F3 */
  applyFix: (body: FixBody): Promise<FixResult> => apiClient.post(`${BASE}/fixes`, body, token()),
  /** S2 */
  setSwitch: (siteId: string, enabled: boolean): Promise<SwitchView> => apiClient.put(`${BASE}/switch`, { siteId, enabled }, token()),
};
