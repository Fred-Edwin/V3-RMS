import { apiClient } from '@/lib/apiClient';
import type {
  ClockInOutInput,
  ClockOverrideInput,
  CreateShiftAssignmentInput,
  CreateShiftInput,
  ListShiftAssignmentsQuery,
  Shift,
  ShiftAssignment,
  ShiftAssignmentClockRecord,
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

  deleteShift: async (id: string, accessToken: string): Promise<void> => {
    await apiClient.delete<void>(`/shifts/${id}`, accessToken);
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

  deleteAssignment: async (id: string, accessToken: string): Promise<void> => {
    await apiClient.delete<void>(`/shift-assignments/${id}`, accessToken);
  },

  clockIn: (data: ClockInOutInput, accessToken: string): Promise<ShiftAssignmentClockRecord> => {
    return apiClient.post<ShiftAssignmentClockRecord>('/clock/in', data, accessToken);
  },

  clockOut: (data: ClockInOutInput, accessToken: string): Promise<ShiftAssignmentClockRecord> => {
    return apiClient.post<ShiftAssignmentClockRecord>('/clock/out', data, accessToken);
  },

  clockOverride: (data: ClockOverrideInput, accessToken: string): Promise<ShiftAssignmentClockRecord> => {
    return apiClient.post<ShiftAssignmentClockRecord>('/clock/override', data, accessToken);
  },
};
