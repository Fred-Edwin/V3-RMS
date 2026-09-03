import type { AppRole } from './auth';

export type ShiftRole = Extract<
  AppRole,
  'WAITER' | 'CHEF' | 'BARISTA' | 'STEWARD' | 'HOUSEKEEPING'
>;
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
  departmentTag?: string | null;
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
  organizationId?: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface UpdateShiftInput {
  organizationId?: string;
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
  organizationId?: string;
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
  action: 'CLOCK_IN' | 'CLOCK_OUT' | 'VOID_CLOCK_OUT';
  reason: string;
}

export interface UndoClockOutInput {
  shiftAssignmentId: string;
}

export interface BatchCreateAssignmentInput {
  organizationId?: string;
  shiftId: string;
  userIds: string[];
  dates: string[];
}

export interface BatchCreateAssignmentResult {
  created: number;
  skipped: number;
  errors: { userId: string; date: string; reason: string }[];
}

export interface CopyWeekInput {
  organizationId?: string;
  sourceWeekStart: string; // YYYY-MM-DD (Monday)
  targetWeekStart: string; // YYYY-MM-DD (Monday)
}

export interface CopyWeekResult {
  created: number;
  skipped: number;
}

export interface BatchDeleteAssignmentInput {
  organizationId?: string;
  ids: string[];
}

export interface BatchDeleteAssignmentResult {
  deleted: number;
}

export interface ReconcileWeekAssignmentInput {
  organizationId?: string;
  weekStart: string;
  changes: Array<{
    userId: string;
    date: string;
    shiftId: string | null;
  }>;
}

export interface ReconcileWeekAssignmentResult {
  saved: number;
  skipped: number;
  errors: { userId: string; date: string; reason: string }[];
  assignments: ShiftAssignment[];
}
