import type { AppRole } from './auth';

export type ShiftRole = Extract<AppRole, 'WAITER' | 'CHEF' | 'BARISTA'>;
export type ClockMethod = 'GPS' | 'OVERRIDE';

export interface Shift {
  id: string;
  organizationId: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftAssignmentClockRecord {
  id: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInMethod: ClockMethod;
  clockOutMethod: ClockMethod | null;
  overrideById: string | null;
  overrideNote: string | null;
}

export interface ShiftAssignmentUser {
  id: string;
  name: string;
  role: ShiftRole;
  isActive: boolean;
}

export interface ShiftAssignment {
  id: string;
  organizationId: string;
  shiftId: string;
  userId: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    isActive: boolean;
  };
  user: ShiftAssignmentUser;
  clockRecord: ShiftAssignmentClockRecord | null;
}

export interface CreateShiftInput {
  name: string;
  startTime: string;
  endTime: string;
}

export interface UpdateShiftInput {
  name?: string;
  startTime?: string;
  endTime?: string;
}

export interface ListShiftAssignmentsQuery {
  startDate: string;
  endDate: string;
  userId?: string;
  shiftId?: string;
  organizationId?: string;
}

export interface CreateShiftAssignmentInput {
  userId: string;
  shiftId: string;
  date: string;
}

export interface ClockInOutInput {
  latitude: number;
  longitude: number;
  shiftAssignmentId: string;
}

export interface ClockOverrideInput {
  userId: string;
  shiftAssignmentId: string;
  action: 'CLOCK_IN' | 'CLOCK_OUT';
  reason: string;
}

export interface BatchCreateAssignmentInput {
  shiftId: string;
  userIds: string[];
  dates: string[];
}

export interface BatchCreateAssignmentResult {
  created: number;
  skipped: number;
  errors: { userId: string; date: string; reason: string }[];
}
