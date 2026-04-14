// ─── Enums ────────────────────────────────────────────────────────────────────

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CASUAL';
export type LeaveType = 'ANNUAL' | 'SICK' | 'EMERGENCY' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DisciplinaryCategory =
  | 'INSUBORDINATION'
  | 'ATTENDANCE'
  | 'MISCONDUCT'
  | 'PERFORMANCE'
  | 'POLICY_VIOLATION'
  | 'OTHER';
export type DisciplinaryAction =
  | 'VERBAL_WARNING'
  | 'WRITTEN_WARNING'
  | 'FINAL_WARNING'
  | 'SUSPENSION'
  | 'TERMINATION';
export type HrDocumentType =
  | 'CONTRACT'
  | 'ID_COPY'
  | 'CERTIFICATE'
  | 'MEDICAL_CERTIFICATE'
  | 'INCIDENT_REPORT'
  | 'WARNING_LETTER'
  | 'OTHER';

// ─── Employee Profile ─────────────────────────────────────────────────────────

export interface EmployeeProfileUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string | null;
  isActive: boolean;
  organization: { id: string; name: string } | null;
}

export interface EmployeeProfile {
  id: string;
  userId: string;
  nationalId: string | null;
  dateOfBirth: string | null;
  personalPhone: string | null;
  personalEmail: string | null;
  physicalAddress: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  employmentType: EmploymentType;
  startDate: string;
  endDate: string | null;
  probationEndDate: string | null;
  jobTitle: string | null;
  reportingManagerId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user: EmployeeProfileUser;
  reportingManager: { id: string; name: string; role: string } | null;
  leaveBalances: LeaveBalance[];
}

// ─── Leave Balance ────────────────────────────────────────────────────────────

export interface LeaveBalance {
  id: string;
  employeeProfileId: string;
  leaveType: LeaveType;
  totalDays: number;
  usedDays: string; // Decimal returned as string from Prisma
  pendingDays: string;
  leaveYear: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Leave Request ────────────────────────────────────────────────────────────

export interface LeaveRequestUser {
  id: string;
  name: string;
  role: string;
  organizationId: string | null;
}

export interface LeaveRequest {
  id: string;
  employeeProfileId: string;
  leaveBalanceId: string;
  organizationId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string;
  status: LeaveStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  cancelledAt: string | null;
  cancelledById: string | null;
  createdAt: string;
  updatedAt: string;
  employeeProfile: {
    id: string;
    user: LeaveRequestUser;
  };
  leaveBalance: LeaveBalance;
  reviewedBy: { id: string; name: string; role: string } | null;
  cancelledBy: { id: string; name: string; role: string } | null;
}

export interface LeaveRequestsPage {
  items: LeaveRequest[];
  total: number;
  page: number;
  limit: number;
}

// ─── Disciplinary Record ──────────────────────────────────────────────────────

export interface DisciplinaryRecord {
  id: string;
  employeeProfileId: string;
  organizationId: string;
  incidentDate: string;
  actionDate: string;
  category: DisciplinaryCategory;
  description: string;
  actionTaken: DisciplinaryAction;
  outcome: string;
  issuedById: string;
  witnesses: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  appealed: boolean;
  appealOutcome: string | null;
  expiresAt: string | null;
  createdAt: string;
  issuedBy: { id: string; name: string; role: string };
}

// ─── HR Document ──────────────────────────────────────────────────────────────

export interface HrDocument {
  id: string;
  employeeProfileId: string;
  leaveRequestId: string | null;
  disciplinaryRecordId: string | null;
  documentType: HrDocumentType;
  fileName: string;
  fileUrl: string;
  uploadedById: string;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

// ─── HR Dashboard ─────────────────────────────────────────────────────────────

export interface HrDashboardStats {
  activeStaff: number;
  onLeaveToday: number;
  pendingLeave: number;
  activeWarnings: number;
  probationEnding: EmployeeProfile[];
}

export interface HrDashboard {
  stats: HrDashboardStats;
  pendingRequests: LeaveRequest[];
  onLeaveToday: LeaveRequest[];
}

// ─── Calendar entry ───────────────────────────────────────────────────────────

export interface LeaveCalendarEntry {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: string;
  employeeProfile: {
    id: string;
    user: { id: string; name: string; role: string };
  };
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateLeaveRequestInput {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface CreateDisciplinaryRecordInput {
  employeeUserId: string;
  incidentDate: string;
  actionDate: string;
  category: DisciplinaryCategory;
  description: string;
  actionTaken: DisciplinaryAction;
  outcome: string;
  witnesses?: string;
  expiresAt?: string;
}

export interface CreateEmployeeProfileInput {
  userId: string;
  employmentType: EmploymentType;
  startDate: string;
  nationalId?: string;
  dateOfBirth?: string;
  personalPhone?: string;
  personalEmail?: string;
  physicalAddress?: string;
  emergencyName?: string;
  emergencyRelation?: string;
  emergencyPhone?: string;
  endDate?: string;
  probationEndDate?: string;
  jobTitle?: string;
  reportingManagerId?: string;
  notes?: string;
}
