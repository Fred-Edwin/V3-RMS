import { prisma } from '../config/database';
import type {
  EmploymentType,
  LeaveType,
  LeaveStatus,
  DisciplinaryCategory,
  DisciplinaryAction,
} from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateEmployeeProfileData {
  userId: string;
  nationalId?: string;
  dateOfBirth?: Date;
  personalPhone?: string;
  personalEmail?: string;
  physicalAddress?: string;
  emergencyName?: string;
  emergencyRelation?: string;
  emergencyPhone?: string;
  employmentType?: EmploymentType;
  startDate: Date;
  endDate?: Date;
  probationEndDate?: Date;
  jobTitle?: string;
  reportingManagerId?: string;
  notes?: string;
}

export interface UpdateEmployeeProfileData {
  nationalId?: string | null;
  dateOfBirth?: Date | null;
  personalPhone?: string | null;
  personalEmail?: string | null;
  physicalAddress?: string | null;
  emergencyName?: string | null;
  emergencyRelation?: string | null;
  emergencyPhone?: string | null;
  employmentType?: EmploymentType;
  startDate?: Date;
  endDate?: Date | null;
  probationEndDate?: Date | null;
  jobTitle?: string;
  reportingManagerId?: string | null;
  notes?: string;
  kraPIN?: string | null;
  shifNhifNumber?: string | null;
  nssfNumber?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  bankBranch?: string | null;
  helbNumber?: string | null;
}

/** Personal fields staff may edit on their own profile via self-service. */
export interface SelfServiceProfileData {
  nationalId?: string | null;
  dateOfBirth?: Date | null;
  personalPhone?: string | null;
  personalEmail?: string | null;
  physicalAddress?: string | null;
  emergencyName?: string | null;
  emergencyRelation?: string | null;
  emergencyPhone?: string | null;
  kraPIN?: string | null;
  shifNhifNumber?: string | null;
  nssfNumber?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  bankBranch?: string | null;
  helbNumber?: string | null;
}

export interface CreateContractTypeData {
  siteId?: string | null;
  name: string;
  durationMonths?: number | null;
  leavePolicies: Array<{ leaveType: LeaveType; totalDays: number }>;
}

export interface UpdateContractTypeData {
  name?: string;
  durationMonths?: number | null;
  isActive?: boolean;
  /** When provided, replaces the full leave-policy set for this contract type. */
  leavePolicies?: Array<{ leaveType: LeaveType; totalDays: number }>;
}

export interface CreateLeaveRequestData {
  employeeProfileId: string;
  leaveBalanceId: string;
  siteId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
}

export interface CreateDisciplinaryRecordData {
  employeeProfileId: string;
  siteId: string;
  incidentDate: Date;
  actionDate: Date;
  category: DisciplinaryCategory;
  description: string;
  actionTaken: DisciplinaryAction;
  outcome: string;
  issuedById: string;
  witnesses?: string;
  expiresAt?: Date;
}

// ─── Employee Profile ─────────────────────────────────────────────────────────

const profileWithUser = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      siteId: true,
      isActive: true,
      site: { select: { id: true, name: true } },
    },
  },
  reportingManager: {
    select: { id: true, name: true, role: true },
  },
  contractType: {
    select: { id: true, name: true, durationMonths: true, isActive: true },
  },
  leaveBalances: true,
} as const;

export async function findProfileByUserId(userId: string) {
  return prisma.employeeProfile.findUnique({
    where: { userId },
    include: profileWithUser,
  });
}

export async function findProfileById(id: string) {
  return prisma.employeeProfile.findUnique({
    where: { id },
    include: profileWithUser,
  });
}

export async function listProfiles(siteId?: string) {
  return prisma.employeeProfile.findMany({
    where: siteId
      ? { user: { siteId } }
      : undefined,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          siteId: true,
          isActive: true,
          site: { select: { id: true, name: true } },
        },
      },
      contractType: {
        select: { id: true, name: true, durationMonths: true, isActive: true },
      },
      leaveBalances: true,
      _count: { select: { documents: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });
}

export async function createProfile(data: CreateEmployeeProfileData) {
  return prisma.employeeProfile.create({
    data: {
      userId: data.userId,
      nationalId: data.nationalId,
      dateOfBirth: data.dateOfBirth,
      personalPhone: data.personalPhone,
      personalEmail: data.personalEmail,
      physicalAddress: data.physicalAddress,
      emergencyName: data.emergencyName,
      emergencyRelation: data.emergencyRelation,
      emergencyPhone: data.emergencyPhone,
      employmentType: data.employmentType,
      startDate: data.startDate,
      endDate: data.endDate,
      probationEndDate: data.probationEndDate,
      jobTitle: data.jobTitle,
      reportingManagerId: data.reportingManagerId,
      notes: data.notes,
    },
    include: profileWithUser,
  });
}

export async function updateProfile(id: string, data: UpdateEmployeeProfileData) {
  return prisma.employeeProfile.update({
    where: { id },
    data,
    include: profileWithUser,
  });
}

// ─── Leave Balances ───────────────────────────────────────────────────────────

export async function findLeaveBalances(employeeProfileId: string, leaveYear: number) {
  return prisma.leaveBalance.findMany({
    where: { employeeProfileId, leaveYear },
    orderBy: { leaveType: 'asc' },
  });
}

export async function findLeaveBalance(
  employeeProfileId: string,
  leaveType: LeaveType,
  leaveYear: number,
) {
  return prisma.leaveBalance.findUnique({
    where: { employeeProfileId_leaveType_leaveYear: { employeeProfileId, leaveType, leaveYear } },
  });
}

/**
 * Assign a contract type to a profile and sync leave balances for the given
 * year from the contract's LeavePolicy rows, atomically:
 * - policy leave types are upserted with the policy's totalDays
 * - existing balances for leave types NOT in the policy get totalDays: 0
 * - usedDays/pendingDays are never touched, so a downgrade below already-used
 *   days shows as negative availability rather than being silently clamped
 *
 * Passing contractTypeId: null clears the contract and leaves balances as-is.
 */
export async function assignContractAndSyncBalances(
  employeeProfileId: string,
  contractTypeId: string | null,
  leaveYear: number,
) {
  if (contractTypeId === null) {
    return prisma.employeeProfile.update({
      where: { id: employeeProfileId },
      data: { contractTypeId: null },
      include: profileWithUser,
    });
  }

  const policies = await prisma.leavePolicy.findMany({ where: { contractTypeId } });
  const existing = await prisma.leaveBalance.findMany({
    where: { employeeProfileId, leaveYear },
    select: { leaveType: true },
  });
  const policyTypes = new Set(policies.map((p) => p.leaveType));
  const orphanedTypes = existing.map((b) => b.leaveType).filter((t) => !policyTypes.has(t));

  // Balance writes run before the profile update so the returned profile's
  // leaveBalances include reflects the freshly synced values
  return prisma.$transaction(async (tx) => {
    for (const p of policies) {
      await tx.leaveBalance.upsert({
        where: {
          employeeProfileId_leaveType_leaveYear: {
            employeeProfileId,
            leaveType: p.leaveType,
            leaveYear,
          },
        },
        create: {
          employeeProfileId,
          leaveType: p.leaveType,
          totalDays: p.totalDays,
          leaveYear,
        },
        update: { totalDays: p.totalDays },
      });
    }
    for (const leaveType of orphanedTypes) {
      await tx.leaveBalance.update({
        where: {
          employeeProfileId_leaveType_leaveYear: { employeeProfileId, leaveType, leaveYear },
        },
        data: { totalDays: 0 },
      });
    }
    return tx.employeeProfile.update({
      where: { id: employeeProfileId },
      data: { contractTypeId },
      include: profileWithUser,
    });
  });
}

export async function updateLeaveBalance(
  employeeProfileId: string,
  leaveType: LeaveType,
  leaveYear: number,
  totalDays: number,
) {
  return prisma.leaveBalance.update({
    where: { employeeProfileId_leaveType_leaveYear: { employeeProfileId, leaveType, leaveYear } },
    data: { totalDays },
  });
}

export async function incrementLeaveUsed(
  employeeProfileId: string,
  leaveType: LeaveType,
  leaveYear: number,
  days: number,
) {
  return prisma.leaveBalance.update({
    where: { employeeProfileId_leaveType_leaveYear: { employeeProfileId, leaveType, leaveYear } },
    data: {
      usedDays: { increment: days },
      pendingDays: { decrement: days },
    },
  });
}

export async function incrementLeavePending(
  employeeProfileId: string,
  leaveType: LeaveType,
  leaveYear: number,
  days: number,
) {
  return prisma.leaveBalance.update({
    where: { employeeProfileId_leaveType_leaveYear: { employeeProfileId, leaveType, leaveYear } },
    data: { pendingDays: { increment: days } },
  });
}

export async function decrementLeavePending(
  employeeProfileId: string,
  leaveType: LeaveType,
  leaveYear: number,
  days: number,
) {
  return prisma.leaveBalance.update({
    where: { employeeProfileId_leaveType_leaveYear: { employeeProfileId, leaveType, leaveYear } },
    data: { pendingDays: { decrement: days } },
  });
}

// ─── Contract Types ───────────────────────────────────────────────────────────

const contractTypeInclude = {
  leavePolicies: { orderBy: { leaveType: 'asc' as const } },
  _count: { select: { employeeProfiles: true } },
} as const;

export async function listContractTypes(includeInactive = false) {
  return prisma.contractType.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: contractTypeInclude,
    orderBy: { name: 'asc' },
  });
}

export async function findContractTypeById(id: string) {
  return prisma.contractType.findUnique({
    where: { id },
    include: contractTypeInclude,
  });
}

export async function findContractTypeByName(name: string) {
  return prisma.contractType.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, isActive: true },
  });
}

export async function createContractType(data: CreateContractTypeData) {
  return prisma.contractType.create({
    data: {
      siteId: data.siteId ?? null,
      name: data.name,
      durationMonths: data.durationMonths ?? null,
      leavePolicies: {
        create: data.leavePolicies.map((p) => ({
          leaveType: p.leaveType,
          totalDays: p.totalDays,
        })),
      },
    },
    include: contractTypeInclude,
  });
}

export async function updateContractType(id: string, data: UpdateContractTypeData) {
  const { leavePolicies, ...fields } = data;

  if (!leavePolicies) {
    return prisma.contractType.update({
      where: { id },
      data: fields,
      include: contractTypeInclude,
    });
  }

  // Nested writes run in a single transaction — replaces the full policy set
  return prisma.contractType.update({
    where: { id },
    data: {
      ...fields,
      leavePolicies: {
        deleteMany: {},
        create: leavePolicies.map((p) => ({
          leaveType: p.leaveType,
          totalDays: p.totalDays,
        })),
      },
    },
    include: contractTypeInclude,
  });
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

const leaveRequestInclude = {
  employeeProfile: {
    include: {
      user: { select: { id: true, name: true, role: true, siteId: true } },
    },
  },
  leaveBalance: true,
  reviewedBy: { select: { id: true, name: true, role: true } },
  cancelledBy: { select: { id: true, name: true, role: true } },
} as const;

export async function createLeaveRequest(data: CreateLeaveRequestData) {
  return prisma.leaveRequest.create({
    data: {
      employeeProfileId: data.employeeProfileId,
      leaveBalanceId: data.leaveBalanceId,
      siteId: data.siteId,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays: data.totalDays,
      reason: data.reason,
    },
    include: leaveRequestInclude,
  });
}

export async function findLeaveRequestById(id: string, siteId?: string) {
  return prisma.leaveRequest.findFirst({
    where: { id, ...(siteId ? { siteId } : {}) },
    include: leaveRequestInclude,
  });
}

export async function listLeaveRequests(params: {
  siteId?: string;
  employeeProfileId?: string;
  status?: LeaveStatus;
  page: number;
  limit: number;
  /** Only return resolved (APPROVED/REJECTED) requests reviewed on/after this date. Ignored for PENDING. */
  resolvedSince?: Date;
  /** Exclude requests this user has already acknowledged. */
  excludeAcknowledgedBy?: string;
}) {
  const where = {
    ...(params.siteId ? { siteId: params.siteId } : {}),
    ...(params.employeeProfileId ? { employeeProfileId: params.employeeProfileId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.resolvedSince
      ? { OR: [{ status: 'PENDING' as const }, { reviewedAt: { gte: params.resolvedSince } }] }
      : {}),
    ...(params.excludeAcknowledgedBy
      ? { acknowledgements: { none: { userId: params.excludeAcknowledgedBy } } }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.leaveRequest.findMany({
      where,
      include: leaveRequestInclude,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { items, total, page: params.page, limit: params.limit };
}

export async function acknowledgeLeaveRequest(leaveRequestId: string, userId: string) {
  return prisma.leaveRequestAcknowledgement.upsert({
    where: { leaveRequestId_userId: { leaveRequestId, userId } },
    create: { leaveRequestId, userId },
    update: {},
  });
}

export async function acknowledgeAllResolvedLeaveRequests(params: {
  siteId?: string;
  userId: string;
}) {
  const resolved = await prisma.leaveRequest.findMany({
    where: {
      status: { in: ['APPROVED', 'REJECTED'] },
      ...(params.siteId ? { siteId: params.siteId } : {}),
    },
    select: { id: true },
  });

  if (resolved.length === 0) return { count: 0 };

  return prisma.leaveRequestAcknowledgement.createMany({
    data: resolved.map((r) => ({ leaveRequestId: r.id, userId: params.userId })),
    skipDuplicates: true,
  });
}

export async function approveLeaveRequest(
  id: string,
  siteId: string,
  reviewedById: string,
  comment?: string,
) {
  return prisma.leaveRequest.updateMany({
    where: { id, siteId },
    data: {
      status: 'APPROVED',
      reviewedById,
      reviewedAt: new Date(),
      reviewComment: comment,
    },
  });
}

export async function rejectLeaveRequest(
  id: string,
  siteId: string,
  reviewedById: string,
  comment?: string,
) {
  return prisma.leaveRequest.updateMany({
    where: { id, siteId },
    data: {
      status: 'REJECTED',
      reviewedById,
      reviewedAt: new Date(),
      reviewComment: comment,
    },
  });
}

export async function cancelLeaveRequest(
  id: string,
  siteId: string,
  cancelledById: string,
) {
  return prisma.leaveRequest.updateMany({
    where: { id, siteId },
    data: {
      status: 'CANCELLED',
      cancelledById,
      cancelledAt: new Date(),
    },
  });
}

export async function findOverlappingLeaveRequests(
  employeeProfileId: string,
  startDate: Date,
  endDate: Date,
  excludeId?: string,
) {
  return prisma.leaveRequest.findMany({
    where: {
      employeeProfileId,
      status: { in: ['PENDING', 'APPROVED'] },
      id: excludeId ? { not: excludeId } : undefined,
      AND: [
        { startDate: { lte: endDate } },
        { endDate: { gte: startDate } },
      ],
    },
  });
}

export async function findApprovedLeaveForCalendar(params: {
  siteId?: string;
  startDate: Date;
  endDate: Date;
}) {
  return prisma.leaveRequest.findMany({
    where: {
      ...(params.siteId ? { siteId: params.siteId } : {}),
      status: 'APPROVED',
      startDate: { lte: params.endDate },
      endDate: { gte: params.startDate },
    },
    include: {
      employeeProfile: {
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
      },
    },
    orderBy: { startDate: 'asc' },
  });
}

// ─── Shift conflict check ─────────────────────────────────────────────────────

export async function findShiftConflicts(userId: string, startDate: Date, endDate: Date) {
  return prisma.shiftAssignment.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    include: {
      shift: { select: { name: true, startTime: true, endTime: true } },
    },
    orderBy: { date: 'asc' },
  });
}

// ─── Disciplinary Records ─────────────────────────────────────────────────────

export async function createDisciplinaryRecord(data: CreateDisciplinaryRecordData) {
  return prisma.disciplinaryRecord.create({
    data,
    include: {
      issuedBy: { select: { id: true, name: true, role: true } },
      employeeProfile: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function listDisciplinaryRecords(employeeProfileId: string) {
  return prisma.disciplinaryRecord.findMany({
    where: { employeeProfileId },
    include: {
      issuedBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function acknowledgeDisciplinaryRecord(id: string, siteId: string) {
  return prisma.disciplinaryRecord.updateMany({
    where: { id, siteId },
    data: { acknowledged: true, acknowledgedAt: new Date() },
  });
}

export async function findDisciplinaryRecordById(id: string, siteId?: string) {
  return prisma.disciplinaryRecord.findFirst({
    where: { id, ...(siteId ? { siteId } : {}) },
    include: {
      issuedBy: { select: { id: true, name: true, role: true } },
      employeeProfile: {
        include: { user: { select: { id: true, name: true, siteId: true } } },
      },
    },
  });
}

// ─── HR Documents ─────────────────────────────────────────────────────────────

export async function createHrDocument(data: {
  employeeProfileId: string;
  leaveRequestId?: string;
  disciplinaryRecordId?: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  uploadedById: string;
}) {
  return prisma.hrDocument.create({
    data: {
      employeeProfileId: data.employeeProfileId,
      leaveRequestId: data.leaveRequestId,
      disciplinaryRecordId: data.disciplinaryRecordId,
      documentType: data.documentType as import('@prisma/client').HrDocumentType,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      uploadedById: data.uploadedById,
    },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
  });
}

export async function listHrDocuments(employeeProfileId: string) {
  return prisma.hrDocument.findMany({
    where: { employeeProfileId },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Existing documents of a given type on a profile — used to find what a re-upload would replace. */
export async function findHrDocumentsByProfileAndType(
  employeeProfileId: string,
  documentType: import('@prisma/client').HrDocumentType,
) {
  return prisma.hrDocument.findMany({
    where: { employeeProfileId, documentType },
  });
}

/**
 * Deletes `documentIds` and creates the new document in one transaction, so a
 * re-upload can never leave the profile with zero copies of that document type.
 */
export async function replaceHrDocuments(
  documentIds: string[],
  createData: {
    employeeProfileId: string;
    leaveRequestId?: string;
    disciplinaryRecordId?: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    uploadedById: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    if (documentIds.length > 0) {
      await tx.hrDocument.deleteMany({ where: { id: { in: documentIds } } });
    }
    return tx.hrDocument.create({
      data: {
        employeeProfileId: createData.employeeProfileId,
        leaveRequestId: createData.leaveRequestId,
        disciplinaryRecordId: createData.disciplinaryRecordId,
        documentType: createData.documentType as import('@prisma/client').HrDocumentType,
        fileName: createData.fileName,
        fileUrl: createData.fileUrl,
        uploadedById: createData.uploadedById,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });
  });
}

export async function findHrDocumentById(id: string) {
  return prisma.hrDocument.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
  });
}

export async function deleteHrDocument(id: string) {
  return prisma.hrDocument.delete({ where: { id } });
}

// ─── HR Dashboard aggregations ────────────────────────────────────────────────

export async function getHrDashboardStats(siteId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const orgFilter = siteId ? { siteId } : {};
  const userOrgFilter = siteId ? { user: { siteId } } : {};

  const [
    activeStaff,
    onLeaveToday,
    pendingLeave,
    activeWarnings,
    probationEnding,
  ] = await prisma.$transaction([
    prisma.employeeProfile.count({
      where: { ...userOrgFilter, user: { isActive: true, ...( siteId ? { siteId } : {} ) } },
    }),
    prisma.leaveRequest.count({
      where: {
        ...orgFilter,
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    }),
    prisma.leaveRequest.count({
      where: { ...orgFilter, status: 'PENDING' },
    }),
    prisma.disciplinaryRecord.count({
      where: {
        ...orgFilter,
        OR: [{ expiresAt: null }, { expiresAt: { gt: today } }],
        actionTaken: { in: ['VERBAL_WARNING', 'WRITTEN_WARNING', 'FINAL_WARNING'] },
      },
    }),
    prisma.employeeProfile.findMany({
      where: {
        ...userOrgFilter,
        probationEndDate: {
          gte: today,
          lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        user: { select: { id: true, name: true, siteId: true, site: { select: { name: true } } } },
      },
      take: 10,
    }),
  ]);

  return { activeStaff, onLeaveToday, pendingLeave, activeWarnings, probationEnding };
}

export async function getPendingLeaveRequestsForDashboard(siteId?: string) {
  return prisma.leaveRequest.findMany({
    where: {
      ...(siteId ? { siteId } : {}),
      status: 'PENDING',
    },
    include: {
      employeeProfile: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              site: { select: { id: true, name: true } },
            },
          },
        },
      },
      leaveBalance: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
}

export async function getStaffOnLeaveToday(siteId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.leaveRequest.findMany({
    where: {
      ...(siteId ? { siteId } : {}),
      status: 'APPROVED',
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: {
      employeeProfile: {
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
      },
    },
    orderBy: { endDate: 'asc' },
  });
}

// ─── Attendance Analytics ─────────────────────────────────────────────────────

export interface AttendanceStaffRow {
  userId: string;
  name: string;
  role: string;
  siteId: string | null;
  siteName: string | null;
  scheduled: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
}

export interface AttendanceDayRow {
  date: string;           // YYYY-MM-DD
  shiftId: string;
  shiftName: string;
  shiftStart: string;     // HH:MM
  shiftEnd: string;       // HH:MM
  clockInAt: string | null;
  clockOutAt: string | null;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  minutesLate: number;
}

// Minutes late threshold — clock-in must be within this window to count as on-time
const LATE_THRESHOLD_MINUTES = 15;

export async function getAttendanceSummary(
  startDate: Date,
  endDate: Date,
  siteId?: string,
  userId?: string,
): Promise<AttendanceStaffRow[]> {
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      ...(siteId ? { siteId } : {}),
      ...(userId ? { userId } : {}),
      date: { gte: startDate, lte: endDate },
      user: { isActive: true },
    },
    select: {
      userId: true,
      siteId: true,
      shift: { select: { startTime: true } },
      clockRecord: { select: { clockInAt: true } },
      user: {
        select: {
          name: true,
          role: true,
          site: { select: { name: true } },
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  // Aggregate per user
  const map = new Map<string, AttendanceStaffRow>();

  for (const a of assignments) {
    let row = map.get(a.userId);
    if (!row) {
      row = {
        userId: a.userId,
        name: a.user.name,
        role: a.user.role,
        siteId: a.siteId,
        siteName: a.user.site?.name ?? null,
        scheduled: 0,
        present: 0,
        absent: 0,
        late: 0,
        attendanceRate: 0,
      };
      map.set(a.userId, row);
    }

    row.scheduled++;

    if (!a.clockRecord?.clockInAt) {
      row.absent++;
    } else {
      row.present++;
      // Compare clock-in time against shift start time
      const [shiftHour, shiftMin] = a.shift.startTime.split(':').map(Number);
      const clockIn = new Date(a.clockRecord.clockInAt);
      const shiftStartMs =
        new Date(clockIn).setHours(shiftHour ?? 0, shiftMin ?? 0, 0, 0);
      const diffMinutes = Math.floor((clockIn.getTime() - shiftStartMs) / 60000);
      if (diffMinutes > LATE_THRESHOLD_MINUTES) row.late++;
    }
  }

  // Calculate attendance rate
  for (const row of map.values()) {
    row.attendanceRate =
      row.scheduled > 0 ? Math.round((row.present / row.scheduled) * 100) : 0;
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getStaffAttendanceDetail(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<AttendanceDayRow[]> {
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    select: {
      date: true,
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      clockRecord: { select: { clockInAt: true, clockOutAt: true } },
    },
    orderBy: { date: 'asc' },
  });

  return assignments.map((a) => {
    const dateStr = a.date.toISOString().slice(0, 10);
    const clockInAt = a.clockRecord?.clockInAt?.toISOString() ?? null;
    const clockOutAt = a.clockRecord?.clockOutAt?.toISOString() ?? null;

    let status: AttendanceDayRow['status'] = 'ABSENT';
    let minutesLate = 0;

    if (clockInAt) {
      const [shiftHour, shiftMin] = a.shift.startTime.split(':').map(Number);
      const clockIn = new Date(clockInAt);
      const shiftStartMs = new Date(clockIn).setHours(shiftHour ?? 0, shiftMin ?? 0, 0, 0);
      minutesLate = Math.max(0, Math.floor((clockIn.getTime() - shiftStartMs) / 60000));
      status = minutesLate > LATE_THRESHOLD_MINUTES ? 'LATE' : 'PRESENT';
    }

    return {
      date: dateStr,
      shiftId: a.shift.id,
      shiftName: a.shift.name,
      shiftStart: a.shift.startTime,
      shiftEnd: a.shift.endTime,
      clockInAt,
      clockOutAt,
      status,
      minutesLate,
    };
  });
}
