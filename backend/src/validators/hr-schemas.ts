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
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CASUAL']).optional(),
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
  kraPIN: z.string().min(1).optional().nullable(),
  shifNhifNumber: z.string().min(1).optional().nullable(),
  nssfNumber: z.string().min(1).optional().nullable(),
  bankName: z.string().min(1).optional().nullable(),
  accountNumber: z.string().min(1).optional().nullable(),
  accountName: z.string().min(1).optional().nullable(),
  bankBranch: z.string().min(1).optional().nullable(),
  helbNumber: z.string().min(1).optional().nullable(),
});

/**
 * Self-service profile update — personal fields only. `.strict()` rejects any
 * extra key, so HR-only fields (employmentType, contractTypeId, startDate,
 * endDate, probationEndDate, jobTitle, reportingManagerId, notes) fail
 * validation instead of being silently ignored.
 */
export const selfServiceProfileSchema = z
  .object({
    nationalId: z.string().min(1).optional().nullable(),
    dateOfBirth: z.string().datetime().optional().nullable(),
    personalPhone: z.string().min(1).optional().nullable(),
    personalEmail: z.string().email().optional().nullable(),
    physicalAddress: z.string().min(1).optional().nullable(),
    emergencyName: z.string().min(1).optional().nullable(),
    emergencyRelation: z.string().min(1).optional().nullable(),
    emergencyPhone: z.string().min(1).optional().nullable(),
    kraPIN: z.string().min(1).optional().nullable(),
    shifNhifNumber: z.string().min(1).optional().nullable(),
    nssfNumber: z.string().min(1).optional().nullable(),
    bankName: z.string().min(1).optional().nullable(),
    accountNumber: z.string().min(1).optional().nullable(),
    accountName: z.string().min(1).optional().nullable(),
    bankBranch: z.string().min(1).optional().nullable(),
    helbNumber: z.string().min(1).optional().nullable(),
  })
  .strict();

export const updatePaymentDetailsSchema = z.object({
  kraPIN: z.string().min(1).optional().nullable(),
  shifNhifNumber: z.string().min(1).optional().nullable(),
  nssfNumber: z.string().min(1).optional().nullable(),
  bankName: z.string().min(1).optional().nullable(),
  accountNumber: z.string().min(1).optional().nullable(),
  accountName: z.string().min(1).optional().nullable(),
  bankBranch: z.string().min(1).optional().nullable(),
  helbNumber: z.string().min(1).optional().nullable(),
});

// ─── Contract Types ───────────────────────────────────────────────────────────

const leavePolicyEntrySchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SICK', 'EMERGENCY', 'UNPAID']),
  totalDays: z.number().int().min(0).max(365),
});

const leavePoliciesArraySchema = z
  .array(leavePolicyEntrySchema)
  .min(1, 'At least one leave policy entry is required')
  .refine(
    (policies) => new Set(policies.map((p) => p.leaveType)).size === policies.length,
    'Duplicate leave types are not allowed',
  );

export const createContractTypeSchema = z.object({
  name: z.string().min(1).max(100),
  durationMonths: z.number().int().min(1).max(120).optional().nullable(),
  leavePolicies: leavePoliciesArraySchema,
});

export const updateContractTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  durationMonths: z.number().int().min(1).max(120).optional().nullable(),
  isActive: z.boolean().optional(),
  leavePolicies: leavePoliciesArraySchema.optional(),
});

export const contractTypesQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional(),
});

export const assignContractSchema = z.object({
  contractTypeId: z.string().uuid().nullable(),
});

// ─── HR Document upload ───────────────────────────────────────────────────────

export const uploadHrDocumentSchema = z.object({
  employeeUserId: z.string().uuid(),
  documentType: z.enum([
    'CONTRACT',
    'ID_COPY',
    'NATIONAL_ID_FRONT',
    'NATIONAL_ID_BACK',
    'CERTIFICATE',
    'MEDICAL_CERTIFICATE',
    'INCIDENT_REPORT',
    'WARNING_LETTER',
    'OTHER',
  ]),
  leaveRequestId: z.string().uuid().optional(),
  disciplinaryRecordId: z.string().uuid().optional(),
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
  reason: z.string().min(1, 'Reason is required').max(3000),
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
  /** Only return resolved requests reviewed in the last N days (pending always included). */
  resolvedSinceDays: z.coerce.number().int().min(1).max(365).optional(),
  /** Exclude requests the requesting user has already acknowledged. */
  excludeAcknowledgedByMe: z.coerce.boolean().optional(),
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

export const userIdParamSchema = z.object({
  userId: z.string().uuid('userId param must be a valid UUID'),
});

export const hrRouteIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const leaveTypeParamSchema = z.object({
  leaveType: z.string().min(1, 'leaveType param is required'),
});
