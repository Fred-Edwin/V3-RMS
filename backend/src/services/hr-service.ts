import { prisma } from '../config/database';
import * as hrRepository from '../repositories/hr-repository';
import { fcmService } from './fcm-service';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../utils/errors';
import { SELF_UPLOADABLE_DOCUMENT_TYPES } from '../utils/hr-constants';
import { destroyUploadedFile } from '../utils/cloudinary';
import type { UserRole } from '@prisma/client';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HrActor {
  id: string;
  role: UserRole;
  organizationId: string | null;
}

// ─── Access helpers ───────────────────────────────────────────────────────────

/** HR_MANAGER and DIRECTOR have cross-branch access. MANAGER is scoped to own branch. */
function canManageProfile(actor: HrActor, targetOrganizationId: string | null): boolean {
  if (actor.role === 'HR_MANAGER' || actor.role === 'DIRECTOR' || actor.role === 'SYSTEM_ADMIN') {
    return true;
  }
  if (actor.role === 'MANAGER') {
    return actor.organizationId === targetOrganizationId;
  }
  return false;
}

function isHrAuthority(role: UserRole): boolean {
  return role === 'HR_MANAGER' || role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
}

// ─── Employee Profile ─────────────────────────────────────────────────────────

export async function createEmployeeProfile(
  actor: HrActor,
  data: hrRepository.CreateEmployeeProfileData,
) {
  if (!isHrAuthority(actor.role)) {
    throw new ForbiddenError('Only HR Manager or Director can create employee profiles');
  }

  const existing = await hrRepository.findProfileByUserId(data.userId);
  if (existing) {
    throw new ConflictError('An employee profile already exists for this user');
  }

  // No leave balances seeded here — balances are contract-driven and populate
  // once HR assigns a contract type (see assignContract).
  const profile = await hrRepository.createProfile(data);

  logger.info({ profileId: profile.id, userId: data.userId }, 'Employee profile created');
  return profile;
}

export async function getEmployeeProfile(actor: HrActor, userId: string) {
  const profile = await hrRepository.findProfileByUserId(userId);
  if (!profile) throw new NotFoundError('Employee profile not found');

  // Self-access: any staff member can view their own profile
  if (actor.id === userId) return profile;

  if (!canManageProfile(actor, profile.user.organizationId)) {
    throw new ForbiddenError('Access denied to this employee profile');
  }

  return profile;
}

export async function listEmployeeProfiles(actor: HrActor) {
  if (isHrAuthority(actor.role)) {
    return hrRepository.listProfiles(); // all branches
  }
  if (actor.role === 'MANAGER') {
    if (!actor.organizationId) throw new ForbiddenError('Manager has no branch assigned');
    return hrRepository.listProfiles(actor.organizationId);
  }
  throw new ForbiddenError('Access denied');
}

export async function updateEmployeeProfile(
  actor: HrActor,
  userId: string,
  data: hrRepository.UpdateEmployeeProfileData,
) {
  if (!isHrAuthority(actor.role)) {
    throw new ForbiddenError('Only HR Manager or Director can update employee profiles');
  }

  const profile = await hrRepository.findProfileByUserId(userId);
  if (!profile) throw new NotFoundError('Employee profile not found');

  return hrRepository.updateProfile(profile.id, data);
}

/** Self-service: staff update their own personal details. HR-only fields are
 *  rejected at the validator layer (strict schema), so only allowlisted
 *  personal fields ever reach this function. */
export async function updateMyProfile(
  actor: HrActor,
  data: hrRepository.SelfServiceProfileData,
) {
  const profile = await hrRepository.findProfileByUserId(actor.id);
  if (!profile) {
    throw new NotFoundError('You do not have an employee profile set up yet. Contact HR.');
  }

  return hrRepository.updateProfile(profile.id, data);
}

// ─── Contract Types ───────────────────────────────────────────────────────────

export async function listContractTypes(actor: HrActor, includeInactive = false) {
  if (!isHrAuthority(actor.role)) {
    throw new ForbiddenError('Only HR Manager or Director can manage contract types');
  }
  return hrRepository.listContractTypes(includeInactive);
}

export async function createContractType(
  actor: HrActor,
  data: hrRepository.CreateContractTypeData,
) {
  if (!isHrAuthority(actor.role)) {
    throw new ForbiddenError('Only HR Manager or Director can manage contract types');
  }

  const duplicate = await hrRepository.findContractTypeByName(data.name);
  if (duplicate) {
    throw new ConflictError(`A contract type named "${data.name}" already exists`);
  }

  const contractType = await hrRepository.createContractType(data);
  logger.info({ contractTypeId: contractType.id, name: data.name }, 'Contract type created');
  return contractType;
}

export async function updateContractType(
  actor: HrActor,
  id: string,
  data: hrRepository.UpdateContractTypeData,
) {
  if (!isHrAuthority(actor.role)) {
    throw new ForbiddenError('Only HR Manager or Director can manage contract types');
  }

  const existing = await hrRepository.findContractTypeById(id);
  if (!existing) throw new NotFoundError('Contract type not found');

  if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await hrRepository.findContractTypeByName(data.name);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError(`A contract type named "${data.name}" already exists`);
    }
  }

  const updated = await hrRepository.updateContractType(id, data);
  logger.info({ contractTypeId: id }, 'Contract type updated');
  return updated;
}

/**
 * HR assigns (or clears) a staff member's contract type. On assignment, leave
 * balances for the current leave year are synced from the contract's
 * LeavePolicy. usedDays/pendingDays are preserved — if the new policy grants
 * fewer days than already used, availability goes negative and HR corrects it
 * manually via the existing balance-adjustment endpoint (no silent clamping).
 */
export async function assignContract(
  actor: HrActor,
  userId: string,
  contractTypeId: string | null,
) {
  if (!isHrAuthority(actor.role)) {
    throw new ForbiddenError('Only HR Manager or Director can assign contracts');
  }

  const profile = await hrRepository.findProfileByUserId(userId);
  if (!profile) throw new NotFoundError('Employee profile not found');

  if (contractTypeId) {
    const contractType = await hrRepository.findContractTypeById(contractTypeId);
    if (!contractType) throw new NotFoundError('Contract type not found');
    if (!contractType.isActive) {
      throw new ValidationError('Cannot assign an inactive contract type');
    }
  }

  const leaveYear = new Date().getFullYear();
  const updated = await hrRepository.assignContractAndSyncBalances(
    profile.id,
    contractTypeId,
    leaveYear,
  );

  logger.info(
    { profileId: profile.id, userId, contractTypeId, assignedBy: actor.id },
    'Contract type assigned',
  );
  return updated;
}

// ─── Leave Balances ───────────────────────────────────────────────────────────

export async function getLeaveBalances(actor: HrActor, userId: string) {
  // Self-access allowed
  if (actor.id !== userId && !canManageProfile(actor, null)) {
    // Need to check the actual org
    const profile = await hrRepository.findProfileByUserId(userId);
    if (!profile) throw new NotFoundError('Employee profile not found');
    if (!canManageProfile(actor, profile.user.organizationId)) {
      throw new ForbiddenError('Access denied');
    }
  }

  const profile = await hrRepository.findProfileByUserId(userId);
  if (!profile) throw new NotFoundError('Employee profile not found');

  const currentYear = new Date().getFullYear();
  return hrRepository.findLeaveBalances(profile.id, currentYear);
}

export async function updateLeaveBalance(
  actor: HrActor,
  userId: string,
  leaveType: import('@prisma/client').LeaveType,
  leaveYear: number,
  totalDays: number,
) {
  if (!isHrAuthority(actor.role)) {
    throw new ForbiddenError('Only HR Manager or Director can update leave balances');
  }

  const profile = await hrRepository.findProfileByUserId(userId);
  if (!profile) throw new NotFoundError('Employee profile not found');

  const balance = await hrRepository.findLeaveBalance(profile.id, leaveType, leaveYear);
  if (!balance) {
    throw new NotFoundError(`No leave balance found for type ${leaveType} in ${leaveYear}`);
  }

  return hrRepository.updateLeaveBalance(profile.id, leaveType, leaveYear, totalDays);
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

/** Calculate working days between two dates (excludes weekends). */
function calculateWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function submitLeaveRequest(
  actor: HrActor,
  input: {
    leaveType: import('@prisma/client').LeaveType;
    startDate: Date;
    endDate: Date;
    reason: string;
  },
) {
  if (input.startDate > input.endDate) {
    throw new ValidationError('Start date must be before end date');
  }

  const profile = await hrRepository.findProfileByUserId(actor.id);
  if (!profile) {
    throw new NotFoundError('You do not have an employee profile set up yet. Contact HR.');
  }

  const leaveYear = input.startDate.getFullYear();
  const balance = await hrRepository.findLeaveBalance(profile.id, input.leaveType, leaveYear);
  if (!balance) {
    throw new NotFoundError(`No ${input.leaveType} leave balance configured for ${leaveYear}`);
  }

  const totalDays = calculateWorkingDays(input.startDate, input.endDate);
  if (totalDays === 0) {
    throw new ValidationError('Leave request must include at least one working day');
  }

  const available = Number(balance.totalDays) - Number(balance.usedDays) - Number(balance.pendingDays);
  if (input.leaveType !== 'UNPAID' && totalDays > available) {
    throw new ValidationError(
      `Insufficient ${input.leaveType} leave balance. Available: ${available} days, requested: ${totalDays} days`,
    );
  }

  // Overlap check
  const overlaps = await hrRepository.findOverlappingLeaveRequests(
    profile.id,
    input.startDate,
    input.endDate,
  );
  if (overlaps.length > 0) {
    throw new ConflictError('You already have a pending or approved leave request overlapping these dates');
  }

  // organizationId may be null for cross-branch roles (ACCOUNTANT). LeaveRequest.organizationId
  // is nullable to support system-wide employees — HR_MANAGER/DIRECTOR are notified instead.
  const organizationId = profile.user.organizationId ?? null;

  // Create request and increment pending days atomically
  const [request] = await prisma.$transaction([
    prisma.leaveRequest.create({
      data: {
        employeeProfileId: profile.id,
        leaveBalanceId: balance.id,
        ...(organizationId ? { organizationId } : {}),
        leaveType: input.leaveType,
        startDate: input.startDate,
        endDate: input.endDate,
        totalDays,
        reason: input.reason,
      },
      include: {
        employeeProfile: {
          include: { user: { select: { id: true, name: true, role: true, organizationId: true } } },
        },
        leaveBalance: true,
        reviewedBy: { select: { id: true, name: true, role: true } },
        cancelledBy: { select: { id: true, name: true, role: true } },
      },
    }),
    prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { pendingDays: { increment: totalDays } },
    }),
  ]);

  // Notify managers of this branch + HR_MANAGER + DIRECTOR
  void notifyManagementOfLeaveRequest(actor, request, organizationId);

  logger.info(
    { requestId: request.id, userId: actor.id, leaveType: input.leaveType, totalDays },
    'Leave request submitted',
  );

  return request;
}

export async function approveLeaveRequest(actor: HrActor, requestId: string, comment?: string) {
  const request = await hrRepository.findLeaveRequestById(requestId, actor.organizationId ?? undefined);
  if (!request) throw new NotFoundError('Leave request not found');
  if (request.status !== 'PENDING') {
    throw new ConflictError('Only pending leave requests can be approved');
  }

  const targetOrgId = request.organizationId;

  // Branch manager: own branch only. HR_MANAGER/DIRECTOR: any.
  if (actor.role === 'MANAGER' && actor.organizationId !== targetOrgId) {
    throw new ForbiddenError('You can only approve leave for your own branch');
  }
  if (!isHrAuthority(actor.role) && actor.role !== 'MANAGER') {
    throw new ForbiddenError('You do not have permission to approve leave requests');
  }

  // Branch manager approving their own leave must be blocked — escalate to HR/Director
  const employeeUserId = request.employeeProfile.user.id;
  if (actor.id === employeeUserId) {
    throw new ForbiddenError('You cannot approve your own leave request');
  }
  if (actor.role === 'MANAGER' && request.employeeProfile.user.role === 'MANAGER') {
    throw new ForbiddenError('A manager\'s leave must be approved by HR Manager or Director');
  }

  // Shift conflict check — warning only, not a blocker
  const shiftConflicts = await hrRepository.findShiftConflicts(
    employeeUserId,
    request.startDate,
    request.endDate,
  );

  // Atomically approve + update balance in one transaction
  await prisma.$transaction([
    prisma.leaveRequest.updateMany({
      where: { id: requestId, organizationId: targetOrgId },
      data: {
        status: 'APPROVED',
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewComment: comment,
      },
    }),
    prisma.leaveBalance.update({
      where: { id: request.leaveBalanceId },
      data: {
        pendingDays: { decrement: Number(request.totalDays) },
        usedDays: { increment: Number(request.totalDays) },
      },
    }),
  ]);

  const approved = await hrRepository.findLeaveRequestById(requestId, targetOrgId ?? undefined);

  // Notify the staff member
  void notifyStaffOfLeaveDecision(employeeUserId, 'APPROVED', actor, request.leaveType, comment);

  logger.info({ requestId, approvedBy: actor.id, shiftConflicts: shiftConflicts.length }, 'Leave request approved');

  return { ...approved, shiftConflicts };
}

export async function rejectLeaveRequest(actor: HrActor, requestId: string, comment?: string) {
  const request = await hrRepository.findLeaveRequestById(requestId, actor.organizationId ?? undefined);
  if (!request) throw new NotFoundError('Leave request not found');
  if (request.status !== 'PENDING') {
    throw new ConflictError('Only pending leave requests can be rejected');
  }

  const targetOrgId = request.organizationId;
  if (actor.role === 'MANAGER' && actor.organizationId !== targetOrgId) {
    throw new ForbiddenError('You can only reject leave for your own branch');
  }
  if (!isHrAuthority(actor.role) && actor.role !== 'MANAGER') {
    throw new ForbiddenError('You do not have permission to reject leave requests');
  }

  const employeeUserId = request.employeeProfile.user.id;
  if (actor.id === employeeUserId) throw new ForbiddenError('You cannot reject your own leave request');

  // Atomically reject + restore pending balance in one transaction
  await prisma.$transaction([
    prisma.leaveRequest.updateMany({
      where: { id: requestId, organizationId: targetOrgId },
      data: {
        status: 'REJECTED',
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewComment: comment,
      },
    }),
    prisma.leaveBalance.update({
      where: { id: request.leaveBalanceId },
      data: { pendingDays: { decrement: Number(request.totalDays) } },
    }),
  ]);

  const rejected = await hrRepository.findLeaveRequestById(requestId, targetOrgId ?? undefined);

  void notifyStaffOfLeaveDecision(employeeUserId, 'REJECTED', actor, request.leaveType, comment);

  logger.info({ requestId, rejectedBy: actor.id }, 'Leave request rejected');
  return rejected;
}

export async function cancelLeaveRequest(actor: HrActor, requestId: string) {
  const request = await hrRepository.findLeaveRequestById(requestId, actor.organizationId ?? undefined);
  if (!request) throw new NotFoundError('Leave request not found');

  const employeeUserId = request.employeeProfile.user.id;

  // Only owner (before start date) or HR authority can cancel
  const isSelf = actor.id === employeeUserId;
  if (!isSelf && !isHrAuthority(actor.role)) {
    throw new ForbiddenError('You do not have permission to cancel this leave request');
  }
  if (isSelf && request.startDate <= new Date()) {
    throw new ForbiddenError('You cannot cancel leave that has already started');
  }
  if (request.status === 'CANCELLED') {
    throw new ConflictError('Leave request is already cancelled');
  }
  if (request.status === 'REJECTED') {
    throw new ConflictError('Rejected leave requests cannot be cancelled');
  }

  const targetOrgId = request.organizationId;
  const balanceField = request.status === 'APPROVED' ? 'usedDays' : 'pendingDays';

  // Atomically cancel + restore balance in one transaction
  await prisma.$transaction([
    prisma.leaveRequest.updateMany({
      where: { id: requestId, organizationId: targetOrgId },
      data: { status: 'CANCELLED', cancelledById: actor.id, cancelledAt: new Date() },
    }),
    prisma.leaveBalance.update({
      where: { id: request.leaveBalanceId },
      data: { [balanceField]: { decrement: Number(request.totalDays) } },
    }),
  ]);

  const cancelled = await hrRepository.findLeaveRequestById(requestId, targetOrgId ?? undefined);

  logger.info({ requestId, cancelledBy: actor.id }, 'Leave request cancelled');
  return cancelled;
}

export async function revertLeaveRequest(actor: HrActor, requestId: string) {
  if (!isHrAuthority(actor.role)) {
    throw new ForbiddenError('Only HR Manager or Director can revert leave requests');
  }

  const request = await hrRepository.findLeaveRequestById(requestId, actor.organizationId ?? undefined);
  if (!request) throw new NotFoundError('Leave request not found');

  if (request.status !== 'APPROVED' && request.status !== 'REJECTED') {
    throw new ConflictError('Only approved or rejected leave requests can be reverted to pending');
  }

  const targetOrgId = request.organizationId;
  const totalDays = Number(request.totalDays);

  if (request.status === 'APPROVED') {
    // Move days from usedDays back to pendingDays
    await prisma.$transaction([
      prisma.leaveRequest.updateMany({
        where: { id: requestId, organizationId: targetOrgId },
        data: {
          status: 'PENDING',
          reviewedById: null,
          reviewedAt: null,
          reviewComment: null,
        },
      }),
      prisma.leaveBalance.update({
        where: { id: request.leaveBalanceId },
        data: {
          usedDays: { decrement: totalDays },
          pendingDays: { increment: totalDays },
        },
      }),
    ]);
  } else {
    // REJECTED: just restore pendingDays (they were decremented on rejection)
    await prisma.$transaction([
      prisma.leaveRequest.updateMany({
        where: { id: requestId, organizationId: targetOrgId },
        data: {
          status: 'PENDING',
          reviewedById: null,
          reviewedAt: null,
          reviewComment: null,
        },
      }),
      prisma.leaveBalance.update({
        where: { id: request.leaveBalanceId },
        data: { pendingDays: { increment: totalDays } },
      }),
    ]);
  }

  const reverted = await hrRepository.findLeaveRequestById(requestId, targetOrgId ?? undefined);

  logger.info({ requestId, revertedBy: actor.id, previousStatus: request.status }, 'Leave request reverted to pending');
  return reverted;
}

export async function listLeaveRequests(
  actor: HrActor,
  params: {
    organizationId?: string;
    status?: import('@prisma/client').LeaveStatus;
    page: number;
    limit: number;
    resolvedSince?: Date;
    excludeAcknowledgedByMe?: boolean;
  },
) {
  const { excludeAcknowledgedByMe, ...rest } = params;
  const excludeAcknowledgedBy = excludeAcknowledgedByMe ? actor.id : undefined;

  if (isHrAuthority(actor.role)) {
    return hrRepository.listLeaveRequests({ ...rest, excludeAcknowledgedBy });
  }
  if (actor.role === 'MANAGER') {
    return hrRepository.listLeaveRequests({
      ...rest,
      organizationId: actor.organizationId ?? undefined,
      excludeAcknowledgedBy,
    });
  }
  throw new ForbiddenError('Access denied');
}

export async function acknowledgeLeaveRequest(actor: HrActor, id: string) {
  if (!isHrAuthority(actor.role) && actor.role !== 'MANAGER') {
    throw new ForbiddenError('Access denied');
  }
  const request = await hrRepository.findLeaveRequestById(id, actor.role === 'MANAGER' ? (actor.organizationId ?? undefined) : undefined);
  if (!request) throw new NotFoundError('Leave request not found');

  return hrRepository.acknowledgeLeaveRequest(id, actor.id);
}

export async function acknowledgeAllResolvedLeaveRequests(actor: HrActor) {
  if (!isHrAuthority(actor.role) && actor.role !== 'MANAGER') {
    throw new ForbiddenError('Access denied');
  }
  return hrRepository.acknowledgeAllResolvedLeaveRequests({
    organizationId: actor.role === 'MANAGER' ? (actor.organizationId ?? undefined) : undefined,
    userId: actor.id,
  });
}

export async function getMyLeaveRequests(actor: HrActor, page: number, limit: number) {
  const profile = await hrRepository.findProfileByUserId(actor.id);
  if (!profile) return { items: [], total: 0, page, limit };

  return hrRepository.listLeaveRequests({ employeeProfileId: profile.id, page, limit });
}

export async function getLeaveCalendar(
  actor: HrActor,
  params: { organizationId?: string; year: number; month: number },
) {
  const startDate = new Date(params.year, params.month - 1, 1);
  const endDate = new Date(params.year, params.month, 0);

  let orgId: string | undefined;
  if (isHrAuthority(actor.role)) {
    orgId = params.organizationId;
  } else if (actor.role === 'MANAGER') {
    orgId = actor.organizationId ?? undefined;
  } else {
    throw new ForbiddenError('Access denied');
  }

  return hrRepository.findApprovedLeaveForCalendar({ organizationId: orgId, startDate, endDate });
}

// ─── Disciplinary Records ─────────────────────────────────────────────────────

export async function createDisciplinaryRecord(
  actor: HrActor,
  data: hrRepository.CreateDisciplinaryRecordData,
) {
  if (!isHrAuthority(actor.role) && actor.role !== 'MANAGER') {
    throw new ForbiddenError('You do not have permission to create disciplinary records');
  }

  const profile = await hrRepository.findProfileById(data.employeeProfileId);
  if (!profile) throw new NotFoundError('Employee profile not found');

  if (actor.role === 'MANAGER' && actor.organizationId !== profile.user.organizationId) {
    throw new ForbiddenError('You can only create disciplinary records for your own branch');
  }

  const record = await hrRepository.createDisciplinaryRecord({
    ...data,
    issuedById: actor.id,
  });

  // Send formal notice to the employee via Inbox
  void notifyStaffOfDisciplinaryAction(
    profile.user.id,
    record.actionTaken,
    data.description,
    actor,
  );

  logger.info(
    { recordId: record.id, employeeId: data.employeeProfileId, action: data.actionTaken },
    'Disciplinary record created',
  );

  return record;
}

export async function getDisciplinaryRecords(actor: HrActor, userId: string) {
  const profile = await hrRepository.findProfileByUserId(userId);
  if (!profile) throw new NotFoundError('Employee profile not found');

  // Self-access: only own records
  if (actor.id === userId) return hrRepository.listDisciplinaryRecords(profile.id);

  if (!canManageProfile(actor, profile.user.organizationId)) {
    throw new ForbiddenError('Access denied');
  }

  return hrRepository.listDisciplinaryRecords(profile.id);
}

export async function acknowledgeDisciplinaryRecord(actor: HrActor, recordId: string) {
  const record = await hrRepository.findDisciplinaryRecordById(recordId, actor.organizationId ?? undefined);
  if (!record) throw new NotFoundError('Disciplinary record not found');

  const employeeUserId = record.employeeProfile.user.id;
  if (actor.id !== employeeUserId) {
    throw new ForbiddenError('You can only acknowledge your own disciplinary records');
  }

  return hrRepository.acknowledgeDisciplinaryRecord(recordId, record.organizationId);
}

// ─── HR Documents ─────────────────────────────────────────────────────────────

/**
 * Permission check for HR document uploads.
 * - HR_MANAGER / DIRECTOR / SYSTEM_ADMIN: any profile, any document type
 * - MANAGER: own-branch profiles only, any document type
 * - All other staff: own profile only, self-serviceable document types only
 * Returns the target profile when allowed; throws otherwise.
 */
export async function authorizeDocumentUpload(
  actor: HrActor,
  employeeUserId: string,
  documentType: import('@prisma/client').HrDocumentType,
) {
  // Ownership/doc-type checks come before the profile lookup so non-privileged
  // staff get 403, not a 404 that leaks whether another user has a profile
  if (!isHrAuthority(actor.role) && actor.role !== 'MANAGER') {
    if (actor.id !== employeeUserId) {
      throw new ForbiddenError('You can only upload documents to your own profile');
    }
    if (!SELF_UPLOADABLE_DOCUMENT_TYPES.includes(documentType)) {
      throw new ForbiddenError(
        `Document type ${documentType} can only be uploaded by HR`,
      );
    }
  }

  const profile = await hrRepository.findProfileByUserId(employeeUserId);
  if (!profile) throw new NotFoundError('Employee profile not found');

  if (actor.role === 'MANAGER' && actor.organizationId !== profile.user.organizationId) {
    throw new ForbiddenError('You can only upload documents for staff in your own branch');
  }

  return profile;
}

/**
 * HR-only deletion. Documents linked to a disciplinary record or leave
 * request are case evidence and cannot be deleted, even by HR_AUTHORITY.
 */
export async function deleteHrDocument(documentId: string) {
  const document = await hrRepository.findHrDocumentById(documentId);
  if (!document) throw new NotFoundError('Document not found');

  if (document.disciplinaryRecordId || document.leaveRequestId) {
    throw new ConflictError(
      'This document is linked to a disciplinary record or leave request and cannot be deleted',
    );
  }

  // Best-effort: destroyUploadedFile never throws by design, but the DB
  // delete must proceed regardless if that contract is ever violated.
  await destroyUploadedFile(document.fileUrl).catch((error) =>
    logger.warn(`Cloudinary cleanup failed during document delete: ${error}`),
  );
  return hrRepository.deleteHrDocument(documentId);
}

// ─── Attendance Analytics ─────────────────────────────────────────────────────

export async function getAttendanceSummary(
  actor: HrActor,
  startDate: Date,
  endDate: Date,
  organizationId?: string,
  userId?: string,
) {
  if (!isHrAuthority(actor.role) && actor.role !== 'MANAGER') {
    throw new ForbiddenError('Access denied to attendance data');
  }
  // MANAGER is scoped to own branch only
  const resolvedOrgId =
    actor.role === 'MANAGER' ? (actor.organizationId ?? undefined) : organizationId;

  return hrRepository.getAttendanceSummary(startDate, endDate, resolvedOrgId, userId);
}

export async function getStaffAttendanceDetail(
  actor: HrActor,
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  if (!isHrAuthority(actor.role) && actor.role !== 'MANAGER') {
    throw new ForbiddenError('Access denied to attendance data');
  }
  return hrRepository.getStaffAttendanceDetail(userId, startDate, endDate);
}

// ─── HR Dashboard ─────────────────────────────────────────────────────────────

export async function getHrDashboard(actor: HrActor, organizationId?: string) {
  if (!isHrAuthority(actor.role)) throw new ForbiddenError('Access denied to HR dashboard');

  const [stats, pendingRequests, onLeaveToday] = await Promise.all([
    hrRepository.getHrDashboardStats(organizationId),
    hrRepository.getPendingLeaveRequestsForDashboard(organizationId),
    hrRepository.getStaffOnLeaveToday(organizationId),
  ]);

  return { stats, pendingRequests, onLeaveToday };
}

// ─── Notification helpers (fire-and-forget) ───────────────────────────────────

async function notifyManagementOfLeaveRequest(
  actor: HrActor,
  request: { id: string; leaveType: string; startDate: Date; endDate: Date; totalDays: unknown },
  organizationId: string | null,
) {
  try {
    // Notify branch managers (if branch-scoped) + HR_MANAGER + DIRECTOR (always system-wide)
    const managers = await prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          ...(organizationId ? [{ role: 'MANAGER' as const, organizationId }] : []),
          { role: 'HR_MANAGER' },
          { role: 'DIRECTOR' },
        ],
        id: { not: actor.id },
      },
      select: { id: true, fcmToken: true, name: true },
    });

    const leaveLabel = request.leaveType.replace('_', ' ').toLowerCase();
    // Leave dates are stored as UTC-midnight date-only values (see date-only.ts),
    // so format them in UTC — converting to Nairobi would shift them a day earlier.
    const startStr = request.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const endStr = request.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

    for (const manager of managers) {
      void fcmService.sendLeaveRequestPush(manager.id, {
        requesterName: actor.id,
        leaveType: leaveLabel,
        dateRange: `${startStr} – ${endStr}`,
        requestId: request.id,
      });
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to notify management of leave request');
  }
}

async function notifyStaffOfLeaveDecision(
  userId: string,
  decision: 'APPROVED' | 'REJECTED',
  reviewer: HrActor,
  leaveType: string,
  comment?: string,
) {
  try {
    void fcmService.sendLeaveDecisionPush(userId, {
      decision,
      leaveType: leaveType.replace('_', ' ').toLowerCase(),
      reviewerName: reviewer.id,
      comment,
    });
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to notify staff of leave decision');
  }
}

async function notifyStaffOfDisciplinaryAction(
  userId: string,
  actionTaken: string,
  description: string,
  issuer: HrActor,
) {
  try {
    const label = actionTaken.replace(/_/g, ' ').toLowerCase();
    void fcmService.sendDisciplinaryNoticePush(userId, {
      actionTaken: label,
      issuedBy: issuer.id,
    });
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to notify staff of disciplinary action');
  }
}
