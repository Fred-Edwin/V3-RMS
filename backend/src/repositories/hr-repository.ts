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
  employmentType: EmploymentType;
  startDate: Date;
  endDate?: Date;
  probationEndDate?: Date;
  jobTitle?: string;
  reportingManagerId?: string;
  notes?: string;
}

export interface UpdateEmployeeProfileData {
  nationalId?: string;
  dateOfBirth?: Date;
  personalPhone?: string;
  personalEmail?: string;
  physicalAddress?: string;
  emergencyName?: string;
  emergencyRelation?: string;
  emergencyPhone?: string;
  employmentType?: EmploymentType;
  startDate?: Date;
  endDate?: Date | null;
  probationEndDate?: Date | null;
  jobTitle?: string;
  reportingManagerId?: string | null;
  notes?: string;
}

export interface CreateLeaveRequestData {
  employeeProfileId: string;
  leaveBalanceId: string;
  organizationId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
}

export interface CreateDisciplinaryRecordData {
  employeeProfileId: string;
  organizationId: string;
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
      organizationId: true,
      isActive: true,
      organization: { select: { id: true, name: true } },
    },
  },
  reportingManager: {
    select: { id: true, name: true, role: true },
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

export async function listProfiles(organizationId?: string) {
  return prisma.employeeProfile.findMany({
    where: organizationId
      ? { user: { organizationId } }
      : undefined,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          organizationId: true,
          isActive: true,
          organization: { select: { id: true, name: true } },
        },
      },
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

export async function seedLeaveBalances(employeeProfileId: string, leaveYear: number) {
  const defaults: Array<{ leaveType: LeaveType; totalDays: number }> = [
    { leaveType: 'ANNUAL', totalDays: 21 },
    { leaveType: 'SICK', totalDays: 10 },
    { leaveType: 'EMERGENCY', totalDays: 5 },
    { leaveType: 'UNPAID', totalDays: 30 },
  ];

  return prisma.$transaction(
    defaults.map((d) =>
      prisma.leaveBalance.upsert({
        where: {
          employeeProfileId_leaveType_leaveYear: {
            employeeProfileId,
            leaveType: d.leaveType,
            leaveYear,
          },
        },
        create: {
          employeeProfileId,
          leaveType: d.leaveType,
          totalDays: d.totalDays,
          leaveYear,
        },
        update: {},
      }),
    ),
  );
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

// ─── Leave Requests ───────────────────────────────────────────────────────────

const leaveRequestInclude = {
  employeeProfile: {
    include: {
      user: { select: { id: true, name: true, role: true, organizationId: true } },
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
      organizationId: data.organizationId,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays: data.totalDays,
      reason: data.reason,
    },
    include: leaveRequestInclude,
  });
}

export async function findLeaveRequestById(id: string) {
  return prisma.leaveRequest.findUnique({
    where: { id },
    include: leaveRequestInclude,
  });
}

export async function listLeaveRequests(params: {
  organizationId?: string;
  employeeProfileId?: string;
  status?: LeaveStatus;
  page: number;
  limit: number;
}) {
  const where = {
    ...(params.organizationId ? { organizationId: params.organizationId } : {}),
    ...(params.employeeProfileId ? { employeeProfileId: params.employeeProfileId } : {}),
    ...(params.status ? { status: params.status } : {}),
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

export async function approveLeaveRequest(id: string, reviewedById: string, comment?: string) {
  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewedById,
      reviewedAt: new Date(),
      reviewComment: comment,
    },
    include: leaveRequestInclude,
  });
}

export async function rejectLeaveRequest(id: string, reviewedById: string, comment?: string) {
  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedById,
      reviewedAt: new Date(),
      reviewComment: comment,
    },
    include: leaveRequestInclude,
  });
}

export async function cancelLeaveRequest(id: string, cancelledById: string) {
  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledById,
      cancelledAt: new Date(),
    },
    include: leaveRequestInclude,
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
  organizationId?: string;
  startDate: Date;
  endDate: Date;
}) {
  return prisma.leaveRequest.findMany({
    where: {
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
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

export async function acknowledgeDisciplinaryRecord(id: string) {
  return prisma.disciplinaryRecord.update({
    where: { id },
    data: { acknowledged: true, acknowledgedAt: new Date() },
  });
}

export async function findDisciplinaryRecordById(id: string) {
  return prisma.disciplinaryRecord.findUnique({
    where: { id },
    include: {
      issuedBy: { select: { id: true, name: true, role: true } },
      employeeProfile: {
        include: { user: { select: { id: true, name: true, organizationId: true } } },
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

// ─── HR Dashboard aggregations ────────────────────────────────────────────────

export async function getHrDashboardStats(organizationId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const orgFilter = organizationId ? { organizationId } : {};
  const userOrgFilter = organizationId ? { user: { organizationId } } : {};

  const [
    activeStaff,
    onLeaveToday,
    pendingLeave,
    activeWarnings,
    probationEnding,
  ] = await prisma.$transaction([
    prisma.employeeProfile.count({
      where: { ...userOrgFilter, user: { isActive: true, ...( organizationId ? { organizationId } : {} ) } },
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
        user: { select: { id: true, name: true, organizationId: true, organization: { select: { name: true } } } },
      },
      take: 10,
    }),
  ]);

  return { activeStaff, onLeaveToday, pendingLeave, activeWarnings, probationEnding };
}

export async function getPendingLeaveRequestsForDashboard(organizationId?: string) {
  return prisma.leaveRequest.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
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
              organization: { select: { id: true, name: true } },
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

export async function getStaffOnLeaveToday(organizationId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.leaveRequest.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
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
