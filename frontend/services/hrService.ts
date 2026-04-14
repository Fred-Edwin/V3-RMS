import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import type {
  EmployeeProfile,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestsPage,
  DisciplinaryRecord,
  HrDocument,
  HrDashboard,
  LeaveCalendarEntry,
  CreateLeaveRequestInput,
  CreateDisciplinaryRecordInput,
  CreateEmployeeProfileInput,
  LeaveType,
  AttendanceStaffRow,
  AttendanceDayRow,
  AttendanceSummaryFilters,
} from '@/types/hr';

// ─── Employee Profiles ────────────────────────────────────────────────────────

export async function createEmployeeProfile(
  input: CreateEmployeeProfileInput,
  token: string,
): Promise<EmployeeProfile> {
  const data = await apiClient.post<{ profile: EmployeeProfile }>('/hr/profiles', input, token);
  return data.profile;
}

export async function listEmployeeProfiles(token: string): Promise<EmployeeProfile[]> {
  const data = await apiClient.get<{ profiles: EmployeeProfile[] }>('/hr/profiles', token);
  return data.profiles;
}

export async function getEmployeeProfile(userId: string, token: string): Promise<EmployeeProfile> {
  const data = await apiClient.get<{ profile: EmployeeProfile }>(`/hr/profiles/${userId}`, token);
  return data.profile;
}

export async function updateEmployeeProfile(
  userId: string,
  input: Partial<CreateEmployeeProfileInput>,
  token: string,
): Promise<EmployeeProfile> {
  const data = await apiClient.patch<{ profile: EmployeeProfile }>(`/hr/profiles/${userId}`, input, token);
  return data.profile;
}

// ─── Leave Balances ───────────────────────────────────────────────────────────

export async function getMyLeaveBalances(token: string): Promise<LeaveBalance[]> {
  const data = await apiClient.get<{ balances: LeaveBalance[] }>('/hr/leave/balances/my', token);
  return data.balances;
}

export async function getLeaveBalances(userId: string, token: string): Promise<LeaveBalance[]> {
  const data = await apiClient.get<{ balances: LeaveBalance[] }>(`/hr/leave/balances/${userId}`, token);
  return data.balances;
}

export async function updateLeaveBalance(
  userId: string,
  leaveType: LeaveType,
  totalDays: number,
  leaveYear: number,
  token: string,
): Promise<LeaveBalance> {
  const data = await apiClient.put<{ balance: LeaveBalance }>(
    `/hr/leave/balances/${userId}/${leaveType}`,
    { totalDays, leaveYear },
    token,
  );
  return data.balance;
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

export async function submitLeaveRequest(
  input: CreateLeaveRequestInput,
  token: string,
): Promise<LeaveRequest> {
  const data = await apiClient.post<{ request: LeaveRequest }>('/hr/leave/request', input, token);
  return data.request;
}

export async function getMyLeaveRequests(
  page = 1,
  limit = 20,
  token: string,
): Promise<LeaveRequestsPage> {
  return apiClient.get<LeaveRequestsPage>(`/hr/leave/requests/my?page=${page}&limit=${limit}`, token);
}

export async function listLeaveRequests(
  params: { organizationId?: string; status?: string; leaveType?: string; page?: number; limit?: number },
  token: string,
): Promise<LeaveRequestsPage> {
  const q = new URLSearchParams();
  if (params.organizationId) q.set('organizationId', params.organizationId);
  if (params.status) q.set('status', params.status);
  if (params.leaveType) q.set('leaveType', params.leaveType);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return apiClient.get<LeaveRequestsPage>(`/hr/leave/requests?${q.toString()}`, token);
}

export async function approveLeaveRequest(
  id: string,
  comment: string | undefined,
  token: string,
): Promise<{ request: LeaveRequest; shiftConflicts: unknown[] }> {
  return apiClient.post(`/hr/leave/requests/${id}/approve`, { comment }, token);
}

export async function rejectLeaveRequest(
  id: string,
  comment: string | undefined,
  token: string,
): Promise<{ request: LeaveRequest }> {
  return apiClient.post(`/hr/leave/requests/${id}/reject`, { comment }, token);
}

export async function cancelLeaveRequest(
  id: string,
  token: string,
): Promise<{ request: LeaveRequest }> {
  return apiClient.post(`/hr/leave/requests/${id}/cancel`, {}, token);
}

export async function getLeaveCalendar(
  params: { organizationId?: string; year: number; month: number },
  token: string,
): Promise<LeaveCalendarEntry[]> {
  const q = new URLSearchParams({ year: String(params.year), month: String(params.month) });
  if (params.organizationId) q.set('organizationId', params.organizationId);
  const data = await apiClient.get<{ entries: LeaveCalendarEntry[] }>(
    `/hr/leave/calendar?${q.toString()}`,
    token,
  );
  return data.entries;
}

// ─── Disciplinary Records ─────────────────────────────────────────────────────

export async function createDisciplinaryRecord(
  input: CreateDisciplinaryRecordInput,
  token: string,
): Promise<DisciplinaryRecord> {
  const data = await apiClient.post<{ record: DisciplinaryRecord }>('/hr/disciplinary', input, token);
  return data.record;
}

export async function getDisciplinaryRecords(
  userId: string,
  token: string,
): Promise<DisciplinaryRecord[]> {
  const data = await apiClient.get<{ records: DisciplinaryRecord[] }>(`/hr/disciplinary/${userId}`, token);
  return data.records;
}

export async function acknowledgeDisciplinaryRecord(
  id: string,
  token: string,
): Promise<DisciplinaryRecord> {
  const data = await apiClient.post<{ record: DisciplinaryRecord }>(
    `/hr/disciplinary/${id}/acknowledge`,
    {},
    token,
  );
  return data.record;
}

// ─── HR Documents ─────────────────────────────────────────────────────────────

export async function uploadHrDocument(
  params: {
    file: File;
    employeeUserId: string;
    documentType: string;
    leaveRequestId?: string;
    disciplinaryRecordId?: string;
  },
  token: string,
): Promise<HrDocument> {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('employeeUserId', params.employeeUserId);
  formData.append('documentType', params.documentType);
  if (params.leaveRequestId) formData.append('leaveRequestId', params.leaveRequestId);
  if (params.disciplinaryRecordId) formData.append('disciplinaryRecordId', params.disciplinaryRecordId);

  const response = await fetch(
    `${env.apiUrl}/hr/documents/upload`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Upload failed');
  }

  const data = await response.json() as { document: HrDocument };
  return data.document;
}

export async function getHrDocuments(userId: string, token: string): Promise<HrDocument[]> {
  const data = await apiClient.get<{ documents: HrDocument[] }>(`/hr/documents/${userId}`, token);
  return data.documents;
}

// ─── Attendance Analytics ─────────────────────────────────────────────────────

export async function getAttendanceSummary(
  filters: AttendanceSummaryFilters,
  token: string,
): Promise<AttendanceStaffRow[]> {
  const q = new URLSearchParams({ startDate: filters.startDate, endDate: filters.endDate });
  if (filters.organizationId) q.set('organizationId', filters.organizationId);
  if (filters.userId) q.set('userId', filters.userId);
  const data = await apiClient.get<{ rows: AttendanceStaffRow[] }>(
    `/hr/attendance?${q.toString()}`,
    token,
  );
  return data.rows;
}

export async function getStaffAttendanceDetail(
  userId: string,
  filters: { startDate: string; endDate: string },
  token: string,
): Promise<AttendanceDayRow[]> {
  const q = new URLSearchParams({ startDate: filters.startDate, endDate: filters.endDate });
  const data = await apiClient.get<{ days: AttendanceDayRow[] }>(
    `/hr/attendance/${userId}?${q.toString()}`,
    token,
  );
  return data.days;
}

// ─── HR Dashboard ─────────────────────────────────────────────────────────────

export async function getHrDashboard(
  organizationId: string | undefined,
  token: string,
): Promise<HrDashboard> {
  const q = organizationId ? `?organizationId=${organizationId}` : '';
  return apiClient.get<HrDashboard>(`/hr/dashboard${q}`, token);
}
