import { apiClient } from '@/lib/apiClient';
import type { ApiResponseEnvelope } from '@/types/api';
import type {
  BatchCreateAssignmentInput,
  BatchCreateAssignmentResult,
  BatchDeleteAssignmentInput,
  BatchDeleteAssignmentResult,
  ClockInOutInput,
  ClockOverrideInput,
  CopyWeekInput,
  CopyWeekResult,
  CreateShiftAssignmentInput,
  CreateShiftInput,
  ListShiftAssignmentsQuery,
  ReconcileWeekAssignmentInput,
  ReconcileWeekAssignmentResult,
  Shift,
  ShiftAssignment,
  ShiftAssignmentClockRecord,
  UndoClockOutInput,
  UpdateShiftInput,
} from '@/types/shift';

const toQueryString = (params: Record<string, string | undefined>): string => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

export const shiftService = {
  listShifts: (accessToken: string, organizationId?: string): Promise<Shift[]> => {
    return apiClient.get<Shift[]>(
      `/shifts${toQueryString({
        organizationId,
      })}`,
      accessToken,
    );
  },

  createShift: (data: CreateShiftInput, accessToken: string): Promise<Shift> => {
    return apiClient.post<Shift>('/shifts', data, accessToken);
  },

  updateShift: (id: string, data: UpdateShiftInput, accessToken: string): Promise<Shift> => {
    return apiClient.patch<Shift>(`/shifts/${id}`, data, accessToken);
  },

  deleteShift: async (id: string, accessToken: string, organizationId?: string): Promise<void> => {
    await apiClient.delete<void>(`/shifts/${id}${toQueryString({ organizationId })}`, accessToken);
  },

  listAssignments: (
    query: ListShiftAssignmentsQuery,
    accessToken: string,
  ): Promise<ShiftAssignment[]> => {
    return apiClient.get<ShiftAssignment[]>(
      `/shift-assignments${toQueryString({
        startDate: query.startDate,
        endDate: query.endDate,
        userId: query.userId,
        shiftId: query.shiftId,
        organizationId: query.organizationId,
      })}`,
      accessToken,
    );
  },

  createAssignment: (data: CreateShiftAssignmentInput, accessToken: string) => {
    return apiClient.post<{
      id: string;
      organizationId: string;
      shiftId: string;
      userId: string;
      date: string;
      createdAt: string;
      updatedAt: string;
    }>('/shift-assignments', data, accessToken);
  },

  batchCreateAssignments: (
    data: BatchCreateAssignmentInput,
    accessToken: string,
  ): Promise<BatchCreateAssignmentResult> => {
    return apiClient.post<BatchCreateAssignmentResult>('/shift-assignments/batch', data, accessToken);
  },

  deleteAssignment: async (id: string, accessToken: string, organizationId?: string): Promise<void> => {
    await apiClient.delete<void>(`/shift-assignments/${id}${toQueryString({ organizationId })}`, accessToken);
  },

  copyWeek: (data: CopyWeekInput, accessToken: string): Promise<CopyWeekResult> => {
    return apiClient.post<CopyWeekResult>('/shift-assignments/copy-week', data, accessToken);
  },

  batchDeleteAssignments: (
    data: BatchDeleteAssignmentInput,
    accessToken: string,
  ): Promise<BatchDeleteAssignmentResult> => {
    return apiClient.post<BatchDeleteAssignmentResult>('/shift-assignments/batch-delete', data, accessToken);
  },

  reconcileWeek: (
    data: ReconcileWeekAssignmentInput,
    accessToken: string,
  ): Promise<ReconcileWeekAssignmentResult> => {
    return apiClient.post<ReconcileWeekAssignmentResult>('/shift-assignments/reconcile-week', data, accessToken);
  },

  clockIn: (data: ClockInOutInput, accessToken: string): Promise<ApiResponseEnvelope<ShiftAssignmentClockRecord>> => {
    return apiClient.postWithEnvelope<ShiftAssignmentClockRecord>('/clock/in', data, accessToken);
  },

  clockOut: (data: ClockInOutInput, accessToken: string): Promise<ApiResponseEnvelope<ShiftAssignmentClockRecord>> => {
    return apiClient.postWithEnvelope<ShiftAssignmentClockRecord>('/clock/out', data, accessToken);
  },

  undoClockOut: (data: UndoClockOutInput, accessToken: string): Promise<ApiResponseEnvelope<ShiftAssignmentClockRecord>> => {
    return apiClient.postWithEnvelope<ShiftAssignmentClockRecord>('/clock/undo-out', data, accessToken);
  },

  clockOverride: (
    data: ClockOverrideInput,
    accessToken: string,
  ): Promise<ApiResponseEnvelope<ShiftAssignmentClockRecord>> => {
    return apiClient.postWithEnvelope<ShiftAssignmentClockRecord>('/clock/override', data, accessToken);
  },
};
