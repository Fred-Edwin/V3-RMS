import { z } from 'zod';

// ─── Employee Profile ─────────────────────────────────────────────────────────

export const createEmployeeProfileSchema = z.object({
  userId: z.string().uuid(),
  nationalId: z.string().min(1).optional(),
  dateOfBirth: z.string().datetime().optional(),
  personalPhone: z.string().min(1).optional(),
  personalEmail: z.string().email().optional(),
  physicalAddress: z.string().min(1).optional(),
  emergencyName: z.string().min(1).optional(),
  emergencyRelation: z.string().min(1).optional(),
  emergencyPhone: z.string().min(1).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CASUAL']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  probationEndDate: z.string().datetime().optional(),
  jobTitle: z.string().min(1).optional(),
  reportingManagerId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const updateEmployeeProfileSchema = z.object({
  nationalId: z.string().min(1).optional(),
  dateOfBirth: z.string().datetime().optional(),
  personalPhone: z.string().min(1).optional(),
  personalEmail: z.string().email().optional(),
  physicalAddress: z.string().min(1).optional(),
  emergencyName: z.string().min(1).optional(),
  emergencyRelation: z.string().min(1).optional(),
  emergencyPhone: z.string().min(1).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CASUAL']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  probationEndDate: z.string().datetime().optional().nullable(),
  jobTitle: z.string().min(1).optional(),
  reportingManagerId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
});

// ─── Leave Balances ───────────────────────────────────────────────────────────

export const updateLeaveBalanceSchema = z.object({
  totalDays: z.number().int().min(0),
  leaveYear: z.number().int().min(2024).max(2100),
});

// ─── Leave Request ────────────────────────────────────────────────────────────

export const createLeaveRequestSchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(1, 'Reason is required').max(1000),
});

export const reviewLeaveRequestSchema = z.object({
  comment: z.string().max(500).optional(),
});

// ─── Disciplinary Record ──────────────────────────────────────────────────────

export const createDisciplinaryRecordSchema = z.object({
  employeeUserId: z.string().uuid(),
  incidentDate: z.string().datetime(),
  actionDate: z.string().datetime(),
  category: z.enum([
    'INSUBORDINATION',
    'ATTENDANCE',
    'MISCONDUCT',
    'PERFORMANCE',
    'POLICY_VIOLATION',
    'OTHER',
  ]),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  actionTaken: z.enum([
    'VERBAL_WARNING',
    'WRITTEN_WARNING',
    'FINAL_WARNING',
    'SUSPENSION',
    'TERMINATION',
  ]),
  outcome: z.string().min(1).max(2000),
  witnesses: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

// ─── HR Dashboard query params ────────────────────────────────────────────────

export const hrDashboardQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export const leaveCalendarQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2024).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const leaveRequestsQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  leaveType: z.enum(['ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
});

// ─── Attendance Analytics ─────────────────────────────────────────────────────

export const attendanceSummaryQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
  organizationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export const attendanceDetailQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
});
